import type { TaskRecord } from "../schemas/runtime";
import { taskRecordSchema } from "../schemas/runtime";

export type TaskTransition =
  | { type: "lease"; workerId: string; now: string; leaseSeconds: number }
  | { type: "start"; workerId: string; now: string }
  | { type: "validate"; workerId: string; now: string }
  | { type: "succeed"; workerId: string; now: string; actualCostUsd: number }
  | { type: "fail"; workerId: string; now: string; error: string; retryable: boolean }
  | { type: "cancel"; now: string };

const activeStatuses = new Set(["leased", "running", "validating"]);

export function transitionTask(input: TaskRecord, event: TaskTransition): TaskRecord {
  const task = taskRecordSchema.parse(input);
  const next = { ...task, updatedAt: event.now };
  switch (event.type) {
    case "lease":
      if (!["pending", "ready", "retry_wait"].includes(task.status)) throw new Error(`Cannot lease task from ${task.status}`);
      if (task.attempts >= task.maxAttempts) throw new Error("Task exhausted its attempt budget");
      if (!Number.isFinite(event.leaseSeconds) || event.leaseSeconds < 10 || event.leaseSeconds > 3600) throw new Error("Lease duration must be between 10 and 3600 seconds");
      next.status = "leased";
      next.leaseOwner = event.workerId;
      next.leaseExpiresAt = new Date(Date.parse(event.now) + event.leaseSeconds * 1000).toISOString();
      next.attempts += 1;
      break;
    case "start":
      assertOwner(task, event.workerId);
      if (task.status !== "leased") throw new Error("Only leased tasks can start");
      next.status = "running";
      break;
    case "validate":
      assertOwner(task, event.workerId);
      if (task.status !== "running") throw new Error("Only running tasks can enter validation");
      next.status = "validating";
      break;
    case "succeed":
      assertOwner(task, event.workerId);
      if (task.status !== "validating") throw new Error("Task output must be validated before success");
      if (!Number.isFinite(event.actualCostUsd) || event.actualCostUsd < 0) throw new Error("Invalid actual cost");
      next.status = "succeeded";
      next.actualCostUsd = event.actualCostUsd;
      delete next.leaseOwner;
      delete next.leaseExpiresAt;
      delete next.lastError;
      break;
    case "fail":
      assertOwner(task, event.workerId);
      if (!activeStatuses.has(task.status)) throw new Error("Only active tasks can fail");
      next.lastError = event.error.slice(0, 4000);
      delete next.leaseOwner;
      delete next.leaseExpiresAt;
      next.status = event.retryable && task.attempts < task.maxAttempts ? "retry_wait" : "failed";
      break;
    case "cancel":
      if (["succeeded", "failed", "cancelled"].includes(task.status)) throw new Error("Terminal task cannot be cancelled");
      next.status = "cancelled";
      delete next.leaseOwner;
      delete next.leaseExpiresAt;
      break;
  }
  return taskRecordSchema.parse(next);
}

function assertOwner(task: TaskRecord, workerId: string): void {
  if (!task.leaseOwner || task.leaseOwner !== workerId) throw new Error("Worker does not own this task lease");
}

export function recoverExpiredLeases(tasks: TaskRecord[], now: string): TaskRecord[] {
  const nowMs = Date.parse(now);
  if (!Number.isFinite(nowMs)) throw new Error("Invalid recovery timestamp");
  return tasks.map(input => {
    const task = taskRecordSchema.parse(input);
    if (!task.leaseExpiresAt || !activeStatuses.has(task.status) || Date.parse(task.leaseExpiresAt) > nowMs) return task;
    return taskRecordSchema.parse({
      ...task,
      status: task.attempts < task.maxAttempts ? "retry_wait" : "failed",
      leaseOwner: undefined,
      leaseExpiresAt: undefined,
      lastError: "Worker lease expired; task recovered by scheduler",
      updatedAt: now
    });
  });
}

export function scheduleReadyTasks(tasks: TaskRecord[], completedIds: string[], now: string, limit: number): string[] {
  if (!Number.isInteger(limit) || limit < 1) throw new Error("Concurrency limit must be a positive integer");
  const completed = new Set(completedIds);
  const nowMs = Date.parse(now);
  return tasks.map(taskRecordSchema.parse).filter(task =>
    ["pending", "ready", "retry_wait"].includes(task.status) &&
    (!task.nextAttemptAt || Date.parse(task.nextAttemptAt) <= nowMs) &&
    task.dependencies.every(id => completed.has(id))
  ).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.taskId.localeCompare(b.taskId))
    .slice(0, limit).map(task => task.taskId);
}
