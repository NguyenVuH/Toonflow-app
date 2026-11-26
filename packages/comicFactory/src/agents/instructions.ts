import type { AgentSpec, TaskPackage } from "../schemas/agent";
import { agentSpecSchema, taskPackageSchema } from "../schemas/agent";

export type CompiledAgentInstruction = {
  agentId: string;
  agentSpecVersion: number;
  taskId: string;
  constitutionVersion: number;
  instruction: string;
  allowedToolIds: string[];
  input: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  acceptanceCriteria: string[];
};

/** Compile a task-scoped instruction only after validating both the AgentSpec and TaskPackage. */
export function compileAgentInstruction(specInput: AgentSpec, taskInput: TaskPackage): CompiledAgentInstruction {
  const spec = agentSpecSchema.parse(specInput);
  const task = taskPackageSchema.parse(taskInput);
  if (!spec.active) throw new Error(`Agent is inactive: ${spec.agentId}`);
  if (spec.agentId !== task.agentId) throw new Error("Task agentId does not match AgentSpec");
  if (spec.version !== task.agentSpecVersion) throw new Error("Task references a different AgentSpec version");
  const allowed = new Set(spec.allowedToolIds);
  const denied = new Set(spec.deniedToolIds);
  const tools = task.allowedToolIds.filter(id => allowed.has(id) && !denied.has(id));
  if (tools.length !== task.allowedToolIds.length) throw new Error("Task requests a tool outside the AgentSpec permission scope");
  const instruction = [
    `ROLE: ${spec.role}`,
    `OBJECTIVE: ${task.objective}`,
    `AGENT OBJECTIVE: ${spec.objective}`,
    "RESPONSIBILITIES:",
    ...spec.responsibilities.map(x => `- ${x}`),
    "PROHIBITED ACTIONS:",
    ...spec.prohibitedActions.map(x => `- ${x}`),
    `CONSTITUTION VERSION: ${task.constitutionVersion}`,
    `REQUIRED RULE IDS: ${task.requiredRuleIds.join(", ") || "none"}`,
    `CONTEXT REFERENCES: ${task.contextRefs.map(x => `${x.kind}:${x.id}`).join(", ") || "none"}`,
    `ASSET REFERENCES: ${task.assetRefs.map(x => `${x.assetId}@${x.version} (${x.role})`).join(", ") || "none"}`,
    "TASK INPUT:",
    JSON.stringify(task.input),
    "INSTRUCTIONS:",
    spec.instructions,
    "ACCEPTANCE CRITERIA:",
    ...task.acceptanceCriteria.map(x => `- ${x}`),
    "Return output matching the supplied output schema. Do not claim success; the execution system validates your output independently."
  ].join("\n");
  return {
    agentId: spec.agentId,
    agentSpecVersion: spec.version,
    taskId: task.taskId,
    constitutionVersion: task.constitutionVersion,
    instruction,
    allowedToolIds: tools,
    input: task.input,
    outputSchema: task.outputSchema,
    acceptanceCriteria: task.acceptanceCriteria
  };
}
