import { describe, expect, test } from "bun:test";
import { autoConnectWorkflow, readyNodeIds, validateWorkflowGraph } from "../src/workflow";
import type { WorkflowNode } from "../src/schemas";

const nodes: WorkflowNode[] = [
  { nodeId: "brief", kind: "trigger", title: "Brief", capability: "input", inputs: [], outputs: [{ name: "brief", type: "text", semanticKey: "story_brief" }], dependsOn: [], config: {}, enabled: true },
  { nodeId: "plan", kind: "llm", title: "Plan", capability: "reasoning", inputs: [{ name: "brief", type: "text", semanticKey: "story_brief", required: true }], outputs: [{ name: "plan", type: "chapter_plan", semanticKey: "chapter_plan" }], dependsOn: ["brief"], config: {}, enabled: true },
  { nodeId: "render", kind: "renderer", title: "Render", capability: "rendering", inputs: [{ name: "plan", type: "chapter_plan", semanticKey: "chapter_plan", required: true }], outputs: [{ name: "file", type: "file" }], dependsOn: ["plan"], config: {}, enabled: true }
];

describe("AI workflow graph compiler", () => {
  test("auto-connects typed semantic ports and orders dependencies", () => {
    const graph = autoConnectWorkflow("wf-1", 1, nodes, "2026-11-26T00:00:00.000Z");
    expect(graph.edges).toHaveLength(2);
    expect(validateWorkflowGraph(graph).topologicalOrder).toEqual(["brief", "plan", "render"]);
  });

  test("rejects unconnected required inputs", () => {
    const graph = { workflowId: "wf-2", version: 1, nodes, edges: [], createdAt: "2026-11-26T00:00:00.000Z" };
    expect(validateWorkflowGraph(graph).issues.some(issue => issue.code === "UNCONNECTED_REQUIRED_INPUT")).toBe(true);
  });

  test("rejects cycles", () => {
    const cyclic = [
      { ...nodes[1], dependsOn: ["render"] },
      { ...nodes[2], dependsOn: ["plan"] }
    ];
    expect(() => autoConnectWorkflow("wf-3", 1, cyclic, "2026-11-26T00:00:00.000Z")).toThrow();
  });

  test("only returns nodes whose dependencies completed", () => {
    const graph = autoConnectWorkflow("wf-4", 1, nodes, "2026-11-26T00:00:00.000Z");
    expect(readyNodeIds(graph, ["brief"])).toEqual(["plan"]);
    expect(readyNodeIds(graph, ["brief", "plan"])).toEqual(["render"]);
  });
});
