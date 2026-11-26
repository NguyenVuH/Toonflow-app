import { describe, expect, test } from "bun:test";
import { recoverExpiredLeases, scheduleReadyTasks, transitionTask } from "../src/runtime";
import type { TaskRecord } from "../src/schemas";

const base: TaskRecord = {
  taskId: "task-1", goalId: "goal-1", nodeId: "node-1", dependencies: [],
  status: "pending", attempts: 0, maxAttempts: 3, estimatedCostUsd: 0,
  actualCostUsd: 0, idempotencyKey: "task-1-idempotent",
  createdAt: "2026-11-26T00:00:00.000Z", updatedAt: "2026-11-26T00:00:00.000Z"
};

describe("task runtime", () => {
  test("requires lease ownership and validation before success", () => {
    const leased = transitionTask(base, { type: "lease", workerId: "worker-a", now: "2026-11-26T00:01:00.000Z", leaseSeconds: 60 });
    const running = transitionTask(leased, { type: "start", workerId: "worker-a", now: "2026-11-26T00:01:01.000Z" });
    expect(() => transitionTask(running, { type: "succeed", workerId: "worker-a", now: "2026-11-26T00:01:02.000Z", actualCostUsd: 0 })).toThrow("validated");
    const validating = transitionTask(running, { type: "validate", workerId: "worker-a", now: "2026-11-26T00:01:02.000Z" });
    expect(transitionTask(validating, { type: "succeed", workerId: "worker-a", now: "2026-11-26T00:01:03.000Z", actualCostUsd: 0.02 }).status).toBe("succeeded");
  });

  test("rejects a different worker attempting to complete a task", () => {
    const leased = transitionTask(base, { type: "lease", workerId: "worker-a", now: "2026-11-26T00:01:00.000Z", leaseSeconds: 60 });
    expect(() => transitionTask(leased, { type: "start", workerId: "worker-b", now: "2026-11-26T00:01:01.000Z" })).toThrow("does not own");
  });

  test("recovers expired worker leases without losing attempts", () => {
    const leased = transitionTask(base, { type: "lease", workerId: "worker-a", now: "2026-11-26T00:01:00.000Z", leaseSeconds: 10 });
    const recovered = recoverExpiredLeases([leased], "2026-11-26T00:02:00.000Z");
    expect(recovered[0].status).toBe("retry_wait");
    expect(recovered[0].attempts).toBe(1);
    expect(recovered[0].leaseOwner).toBeUndefined();
  });

  test("only schedules tasks with completed dependencies", () => {
    const dependent = { ...base, taskId: "task-2", dependencies: ["task-1"] };
    expect(scheduleReadyTasks([base, dependent], [], "2026-11-26T00:01:00.000Z", 5)).toEqual(["task-1"]);
    expect(scheduleReadyTasks([base, dependent], ["task-1"], "2026-11-26T00:01:00.000Z", 5)).toEqual(["task-1", "task-2"]);
  });
});
