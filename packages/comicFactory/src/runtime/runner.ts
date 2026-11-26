import type { WorkflowGraph } from "../schemas/workflow";
import type { TaskRecord } from "../schemas/runtime";
import { scheduleReadyTasks, transitionTask } from "./scheduler";
import type { TaskRepository } from "../persistence/sqlite";
import { validateWorkflowGraph } from "../workflow/graph";

export type NodeExecutor = (nodeId: string, task: TaskRecord) => Promise<{ output: unknown; costUsd: number }>;
export type OutputValidator = (nodeId: string, output: unknown) => Promise<{ valid: boolean; errors: string[] }>;

export type RunnerOptions = {
  graph: WorkflowGraph;
  goalId: string;
  repository: TaskRepository;
  execute: NodeExecutor;
  validate: OutputValidator;
  workerId: string;
  concurrency: number;
  now?: () => string;
};

export type RunnerResult = { succeeded: string[]; failed: string[]; blocked: string[] };

export async function runReadyWorkflow(options: RunnerOptions): Promise<RunnerResult> {
  const graphResult = validateWorkflowGraph(options.graph);
  if (!graphResult.valid) throw new Error(`Workflow invalid: ${graphResult.issues.map(x => x.message).join("; ")}`);
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1) throw new Error("Concurrency must be positive");
  const now = options.now ?? (() => new Date().toISOString());
  const succeeded: string[] = [];
  const failed: string[] = [];
  const graphNodes = new Map(options.graph.nodes.map(node => [node.nodeId, node]));
  const allTasks = options.repository.listByGoal(options.goalId);
  const taskByNode = new Map(allTasks.map(task => [task.nodeId, task]));
  const completed = allTasks.filter(task => task.status === "succeeded").map(task => task.taskId);
  const failedIds = new Set(allTasks.filter(task => task.status === "failed" || task.status === "cancelled").map(task => task.taskId));

  const ready = scheduleReadyTasks(allTasks, completed, now(), options.concurrency);
  const candidates = ready.filter(taskId => {
    const task = allTasks.find(item => item.taskId === taskId)!;
    const node = graphNodes.get(task.nodeId);
    return !!node && node.enabled && !failedIds.has(taskId);
  });

  await Promise.all(candidates.map(async taskId => {
    let task = options.repository.get(taskId);
    if (!task) { failed.push(taskId); return; }
    try {
      task = transitionTask(task, { type: "lease", workerId: options.workerId, now: now(), leaseSeconds: 300 });
      if (!options.repository.update(task, "pending") && !options.repository.update(task, "ready") && !options.repository.update(task, "retry_wait")) {
        throw new Error("Task lease lost due to concurrent update");
      }
      task = transitionTask(task, { type: "start", workerId: options.workerId, now: now() });
      if (!options.repository.update(task, "leased")) throw new Error("Task start lost due to concurrent update");
      const result = await options.execute(task.nodeId, task);
      const validation = await options.validate(task.nodeId, result.output);
      if (!validation.valid) throw new Error(`Output validation failed: ${validation.errors.join("; ")}`);
      task = transitionTask(task, { type: "validate", workerId: options.workerId, now: now() });
      if (!options.repository.update(task, "running")) throw new Error("Task validation transition lost");
      task = transitionTask(task, { type: "succeed", workerId: options.workerId, now: now(), actualCostUsd: result.costUsd });
      if (!options.repository.update(task, "validating")) throw new Error("Task commit lost");
      succeeded.push(taskId);
    } catch (error) {
      const current = options.repository.get(taskId);
      if (current && ["leased", "running", "validating"].includes(current.status) && current.leaseOwner === options.workerId) {
        const failedTask = transitionTask(current, {
          type: "fail", workerId: options.workerId, now: now(),
          error: error instanceof Error ? error.message : String(error), retryable: true
        });
        options.repository.update(failedTask, current.status);
      }
      failed.push(taskId);
    }
  }));

  const finalTasks = options.repository.listByGoal(options.goalId);
  const terminalOrDone = new Set(finalTasks.filter(task => ["succeeded", "failed", "cancelled"].includes(task.status)).map(task => task.taskId));
  const blocked = finalTasks.filter(task => !terminalOrDone.has(task.taskId) && task.dependencies.some(dep => {
    const depTask = finalTasks.find(item => item.taskId === dep);
    return !depTask || depTask.status === "failed" || depTask.status === "cancelled";
  })).map(task => task.taskId);
  return { succeeded, failed, blocked };
}
