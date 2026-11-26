import { z } from "zod";
import type { WorkflowNode, WorkflowGraph } from "../schemas/workflow";
import { workflowNodeSchema } from "../schemas/workflow";
import { autoConnectWorkflow, validateWorkflowGraph } from "./graph";

export const nodeDefinitionSchema = z.object({
  nodeType: z.string().min(1).max(128),
  kind: z.enum(["trigger","llm","tool","condition","parallel","merge","validator","renderer","publish"]),
  capability: z.string().min(1).max(128),
  title: z.string().min(1).max(200),
  inputs: z.array(z.object({name:z.string().min(1),type:z.string().min(1),required:z.boolean(),semanticKey:z.string().optional()}).strict()),
  outputs: z.array(z.object({name:z.string().min(1),type:z.string().min(1),semanticKey:z.string().optional()}).strict()),
  requiredTools: z.array(z.string().min(1)).default([]),
  requiredCapabilities: z.array(z.string().min(1)).default([])
}).strict();
export type NodeDefinition = z.infer<typeof nodeDefinitionSchema>;

export class NodeRegistry {
  private readonly definitions = new Map<string, NodeDefinition>();
  register(input: NodeDefinition): void {
    const definition = nodeDefinitionSchema.parse(input);
    if (this.definitions.has(definition.nodeType)) throw new Error(`Node type already registered: ${definition.nodeType}`);
    this.definitions.set(definition.nodeType, Object.freeze(structuredClone(definition)));
  }
  list(): NodeDefinition[] { return [...this.definitions.values()].map(value => structuredClone(value)); }
  get(nodeType: string): NodeDefinition {
    const result = this.definitions.get(nodeType);
    if (!result) throw new Error(`Unknown node type: ${nodeType}`);
    return structuredClone(result);
  }
}

const draftNodeSchema = z.object({
  nodeId: z.string().min(1),
  nodeType: z.string().min(1),
  title: z.string().min(1),
  dependsOn: z.array(z.string()).default([]),
  config: z.record(z.string(),z.json()).default({}),
  enabled: z.boolean().default(true)
}).strict();

export type WorkflowPlanAdapter = (input: {
  goal: string;
  language: string;
  constitutionVersion: number;
  availableNodes: NodeDefinition[];
  constraints: string[];
}) => Promise<unknown>;

/**
 * AI proposes the node plan. Only registered node definitions can be instantiated;
 * code generates typed ports and validates the complete DAG before execution.
 */
export async function buildWorkflowFromNaturalLanguage(input: {
  workflowId: string;
  version: number;
  goal: string;
  language?: string;
  constitutionVersion: number;
  constraints: string[];
  registry: NodeRegistry;
  plan: WorkflowPlanAdapter;
  createdAt?: string;
}): Promise<WorkflowGraph> {
  const definitions = input.registry.list();
  const raw = await input.plan({
    goal: input.goal, language: input.language ?? "vi",
    constitutionVersion: input.constitutionVersion,
    availableNodes: definitions, constraints: input.constraints
  });
  const draft = z.object({ nodes: z.array(draftNodeSchema).min(1) }).strict().parse(raw);
  const nodes: WorkflowNode[] = draft.nodes.map(item => {
    const definition = input.registry.get(item.nodeType);
    return workflowNodeSchema.parse({
      nodeId: item.nodeId, kind: definition.kind, title: item.title || definition.title,
      capability: definition.capability, inputs: definition.inputs, outputs: definition.outputs,
      dependsOn: item.dependsOn, config: item.config, enabled: item.enabled
    });
  });
  const graph = autoConnectWorkflow(input.workflowId,input.version,nodes,input.createdAt);
  const validation = validateWorkflowGraph(graph);
  if (!validation.valid) throw new Error(`AI workflow plan rejected: ${validation.issues.map(issue=>issue.message).join("; ")}`);
  return graph;
}

export function createCoreNodeRegistry(): NodeRegistry {
  const registry = new NodeRegistry();
  registry.register({nodeType:"brief.input",kind:"trigger",capability:"input",title:"Series brief",inputs:[],outputs:[{name:"brief",type:"text",semanticKey:"series_brief"}],requiredTools:[],requiredCapabilities:[]});
  registry.register({nodeType:"story.preproduction",kind:"llm",capability:"reasoning",title:"Pre-production planner",inputs:[{name:"brief",type:"text",required:true,semanticKey:"series_brief"}],outputs:[{name:"bible",type:"series_bible",semanticKey:"production_bible"}],requiredTools:["story.create_bible"],requiredCapabilities:["reasoning","text"]});
  registry.register({nodeType:"world.onboarding",kind:"tool",capability:"world",title:"World entity onboarding",inputs:[{name:"bible",type:"series_bible",required:true,semanticKey:"production_bible"}],outputs:[{name:"assets",type:"json",semanticKey:"registered_assets"}],requiredTools:["world.onboard_entities"],requiredCapabilities:["reasoning","image_generation","vision"]});
  registry.register({nodeType:"story.storyboard",kind:"llm",capability:"reasoning",title:"Storyboard planner",inputs:[{name:"bible",type:"series_bible",required:true,semanticKey:"production_bible"},{name:"assets",type:"json",required:true,semanticKey:"registered_assets"}],outputs:[{name:"panels",type:"json",semanticKey:"panel_plan"}],requiredTools:["story.create_storyboard"],requiredCapabilities:["reasoning","text"]});
  registry.register({nodeType:"comic.image",kind:"tool",capability:"image_generation",title:"Panel image generation",inputs:[{name:"panels",type:"json",required:true,semanticKey:"panel_plan"}],outputs:[{name:"images",type:"json",semanticKey:"panel_images"}],requiredTools:["comic.generate_panels"],requiredCapabilities:["image_generation"]});
  registry.register({nodeType:"comic.lettering",kind:"tool",capability:"rendering",title:"Dialogue and lettering",inputs:[{name:"images",type:"json",required:true,semanticKey:"panel_images"}],outputs:[{name:"pages",type:"json",semanticKey:"comic_pages"}],requiredTools:["comic.render_lettering"],requiredCapabilities:["text","rendering"]});
  registry.register({nodeType:"comic.qa",kind:"validator",capability:"vision",title:"Continuity and visual QA",inputs:[{name:"pages",type:"json",required:true,semanticKey:"comic_pages"}],outputs:[{name:"approved",type:"boolean",semanticKey:"qa_approved"}],requiredTools:["comic.validate_chapter"],requiredCapabilities:["vision","reasoning"]});
  registry.register({nodeType:"comic.export",kind:"publish",capability:"rendering",title:"Chapter export",inputs:[{name:"approved",type:"boolean",required:true,semanticKey:"qa_approved"}],outputs:[{name:"file",type:"file",semanticKey:"chapter_export"}],requiredTools:["comic.export_chapter"],requiredCapabilities:["rendering"]});
  return registry;
}
