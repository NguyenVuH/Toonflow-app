import type { WorkflowGraph, WorkflowNode } from "../schemas/workflow";
import type { TaskRecord } from "../schemas/runtime";
import type { ToolExecutionContext, ToolPermission, ToolRegistry } from "../tools/registry";
import type { AgentSpec, TaskPackage } from "../schemas/agent";
import type { WorkerProfile } from "../agents/capability-matcher";
import type { DelegatedWorker } from "../agents/delegation";
import type { SkillRegistry } from "../skills/registry";
import { delegateAgentTask } from "../agents/delegation";

export type AgentNodeBinding = {
  spec: AgentSpec;
  task: TaskPackage;
  workers: WorkerProfile[];
  workerAdapters: DelegatedWorker[];
  validateOutput: (output: unknown, task: TaskPackage) => Promise<{ valid: boolean; errors: string[] }>;
};

export type WorkflowNodeExecutionContext = {
  workflowId: string;
  nodeId: string;
  task: TaskRecord;
  inputs: Record<string, unknown>;
  upstreamArtifacts: Array<{ nodeId: string; version: number; contentHash: string }>;
};

export type WorkflowNodeExecutionResult = { output: unknown; costUsd: number };

export type WorkflowNodeDispatcherOptions = {
  graph: WorkflowGraph;
  seriesId: string;
  tools: ToolRegistry;
  skillRegistry?: SkillRegistry;
  resolveAgent: (node: WorkflowNode, context: WorkflowNodeExecutionContext) => Promise<AgentNodeBinding>;
  resolveToolPermissions: (node: WorkflowNode, toolId: string) => ToolPermission[];
  triggerOutputs?: Record<string, unknown>;
  toolVersions?: Record<string, number>;
  signalForTask?: (task: TaskRecord) => AbortSignal | undefined;
};

/**
 * Connects the validated workflow DAG to registered tools and capability-matched agents.
 * The host must supply workspace-scoped credentials, permissions, and agent bindings.
 */
export function createWorkflowNodeDispatcher(options: WorkflowNodeDispatcherOptions) {
  const nodes = new Map(options.graph.nodes.map(node => [node.nodeId, node]));
  return async (context: WorkflowNodeExecutionContext): Promise<WorkflowNodeExecutionResult> => {
    const node = nodes.get(context.nodeId);
    if (!node || !node.enabled) throw new Error(`Workflow node is missing or disabled: ${context.nodeId}`);
    const signal = options.signalForTask?.(context.task);
    signal?.throwIfAborted();

    if (node.kind === "trigger") {
      const output = options.triggerOutputs?.[node.nodeId] ?? node.config.output;
      if (output === undefined) throw new Error(`Trigger node ${node.nodeId} has no host-provided output`);
      return { output, costUsd: 0 };
    }

    if (node.kind === "llm") {
      const binding = await options.resolveAgent(node, context);
      const result = await delegateAgentTask({
        ...binding,
        skillRegistry: options.skillRegistry,
        signal
      });
      return { output: result.output, costUsd: result.costUsd };
    }

    if (node.kind === "tool" || node.kind === "renderer" || node.kind === "validator" || node.kind === "publish") {
      const toolIds = node.requiredToolIds ?? [];
      if (toolIds.length !== 1) {
        throw new Error(`Node ${node.nodeId} must declare exactly one executable tool; found ${toolIds.length}`);
      }
      const toolId = toolIds[0]!;
      const toolContext: ToolExecutionContext = {
        taskId: context.task.taskId,
        seriesId: options.seriesId,
        agentId: typeof node.config.agentId === "string" ? node.config.agentId : "comic-factory-system",
        allowedToolIds: [toolId],
        permissions: options.resolveToolPermissions(node, toolId),
        ...(signal ? { signal } : {})
      };
      const configInput = node.config.input;
      const rawInput = {
        ...context.inputs,
        ...(configInput && typeof configInput === "object" && !Array.isArray(configInput)
          ? configInput as Record<string, unknown> : {})
      };
      const output = await options.tools.execute(toolId, options.toolVersions?.[toolId] ?? 1, rawInput, toolContext);
      return { output, costUsd: 0 };
    }

    if (node.kind === "merge" || node.kind === "parallel") {
      return { output: context.inputs, costUsd: 0 };
    }

    if (node.kind === "condition") {
      throw new Error("Conditional routing is not supported by the current DAG executor; refusing to execute as an unconditional node");
    }

    throw new Error(`Unsupported workflow node kind: ${node.kind}`);
  };
}
