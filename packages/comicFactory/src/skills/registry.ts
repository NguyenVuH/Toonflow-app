import type { SkillSpec } from "../schemas/skill";
import { skillSpecSchema } from "../schemas/skill";

export class SkillRegistry {
  private readonly skills = new Map<string, SkillSpec>();

  register(input: SkillSpec): void {
    const skill = skillSpecSchema.parse(input);
    const key = `${skill.skillId}@${skill.version}`;
    if (this.skills.has(key)) throw new Error(`Skill version already registered: ${key}`);
    this.skills.set(key, Object.freeze(structuredClone(skill)));
  }

  get(skillId: string, version: number): SkillSpec {
    const skill = this.skills.get(`${skillId}@${version}`);
    if (!skill || !skill.active) throw new Error(`Skill unavailable: ${skillId}@${version}`);
    return structuredClone(skill);
  }

  list(domain?: string): SkillSpec[] {
    return [...this.skills.values()]
      .filter(skill => skill.active && (!domain || skill.domains.includes(domain)))
      .map(skill => structuredClone(skill));
  }

  compileInstruction(skillId: string, version: number, context: {
    taskObjective: string;
    constitutionVersion: number;
    contextRefs: string[];
    allowedToolIds: string[];
  }): string {
    const skill = this.get(skillId, version);
    const allowed = new Set(context.allowedToolIds);
    const missing = skill.toolIds.filter(id => !allowed.has(id));
    if (missing.length) throw new Error(`Task is missing required skill tools: ${missing.join(", ")}`);
    return [
      `SKILL: ${skill.name} (${skill.skillId}@${skill.version})`,
      `PURPOSE: ${skill.purpose}`,
      `TASK OBJECTIVE: ${context.taskObjective}`,
      `CONSTITUTION VERSION: ${context.constitutionVersion}`,
      `REQUIRED CONTEXT: ${skill.requiredContext.join(", ") || "none"}`,
      `AVAILABLE CONTEXT REFERENCES: ${context.contextRefs.join(", ") || "none"}`,
      "MANDATORY INSTRUCTION:",
      skill.instruction,
      "PROCEDURE:",
      ...skill.procedure.map((step, index) => `${index + 1}. [${step.required ? "REQUIRED" : "OPTIONAL"}] ${step.instruction}`),
      "ACCEPTANCE CRITERIA:",
      ...skill.acceptanceCriteria.map(item => `- ${item}`),
      `FAILURE POLICY: ${skill.failurePolicy}`,
      "Do not claim completion. Return structured output for independent validation."
    ].join("\n");
  }
}
