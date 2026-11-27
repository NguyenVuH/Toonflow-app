import type { AgentSpec } from "../schemas/agent";
import { agentSpecSchema } from "../schemas/agent";
import type { ProviderCapability } from "../schemas/media";
import { providerCapabilitySchema } from "../schemas/media";

export type WorkerProfile = {
  workerId: string;
  capabilities: string[];
  provider: ProviderCapability;
  enabled: boolean;
  maxConcurrent: number;
  currentConcurrent: number;
  maxCostUsd?: number;
};

export function matchWorkers(specInput: AgentSpec, workersInput: WorkerProfile[], taskBudgetUsd?: number): WorkerProfile[] {
  const spec = agentSpecSchema.parse(specInput);
  return workersInput.map(worker => ({ ...worker, provider: providerCapabilitySchema.parse(worker.provider) }))
    .filter(worker => worker.enabled && worker.currentConcurrent < worker.maxConcurrent)
    .filter(worker => spec.requiredCapabilities.every(capability =>
      worker.capabilities.includes(capability) || worker.provider.modalities.includes(capability as never)))
    .filter(worker => taskBudgetUsd === undefined || worker.maxCostUsd === undefined || worker.maxCostUsd <= taskBudgetUsd)
    .sort((a, b) => a.currentConcurrent / a.maxConcurrent - b.currentConcurrent / b.maxConcurrent || a.workerId.localeCompare(b.workerId));
}

export function requireWorker(spec: AgentSpec, workers: WorkerProfile[], budgetUsd?: number): WorkerProfile {
  const matches = matchWorkers(spec, workers, budgetUsd);
  if (!matches.length) throw new Error(`No available worker satisfies capabilities for agent ${spec.agentId}`);
  return matches[0];
}
