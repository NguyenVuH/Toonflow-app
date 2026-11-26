import type { AgentSpec, TaskPackage } from "../schemas/agent";
import { agentSpecSchema, taskPackageSchema } from "../schemas/agent";
import type { WorkerProfile } from "./capability-matcher";
import { requireWorker } from "./capability-matcher";
import { compileAgentInstruction } from "./instructions";

export type DelegatedWorker = {
  workerId: string;
  providerId: string;
  modelId: string;
  run(input: {
    instruction: string;
    task: TaskPackage;
    allowedToolIds: string[];
    signal?: AbortSignal;
  }): Promise<{ output: unknown; costUsd: number; providerRequestId?: string }>;
};
export type DelegationResult = {
  taskId: string;
  workerId: string;
  providerId: string;
  modelId: string;
  output: unknown;
  costUsd: number;
  providerRequestId?: string;
};

/**
 * Capability-gated delegation. The worker receives a compiled, versioned instruction
 * and only task-authorized tools. Independent output validation is mandatory.
 */
export async function delegateAgentTask(input: {
  spec: AgentSpec;
  task: TaskPackage;
  workers: WorkerProfile[];
  workerAdapters: DelegatedWorker[];
  validateOutput: (output: unknown, task: TaskPackage) => Promise<{valid:boolean;errors:string[]}>;
  signal?: AbortSignal;
}): Promise<DelegationResult> {
  const spec=agentSpecSchema.parse(input.spec);
  const task=taskPackageSchema.parse(input.task);
  if(spec.agentId!==task.agentId)throw new Error("AgentSpec and TaskPackage identity mismatch");
  const selected=requireWorker(spec,input.workers,undefined);
  const adapter=input.workerAdapters.find(item=>item.workerId===selected.workerId);
  if(!adapter)throw new Error("Matched worker has no execution adapter");
  input.signal?.throwIfAborted();
  const compiled=compileAgentInstruction(spec,task);
  const result=await adapter.run({
    instruction:compiled.instruction,
    task,
    allowedToolIds:compiled.allowedToolIds,
    signal:input.signal
  });
  input.signal?.throwIfAborted();
  if(!Number.isFinite(result.costUsd)||result.costUsd<0)throw new Error("Worker returned invalid cost");
  const validation=await input.validateOutput(result.output,task);
  if(!validation.valid)throw new Error("Independent output validation failed: "+validation.errors.join("; "));
  return {
    taskId:task.taskId,workerId:adapter.workerId,providerId:adapter.providerId,modelId:adapter.modelId,
    output:result.output,costUsd:result.costUsd,...(result.providerRequestId?{providerRequestId:result.providerRequestId}:{})
  };
}
