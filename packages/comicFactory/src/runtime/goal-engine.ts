import type { GoalRecord, TaskRecord } from "../schemas/runtime";
import { goalSchema, taskRecordSchema } from "../schemas/runtime";
import type { ProductionBible } from "../schemas/planning";
import { validateMasterProductionPlan } from "../planning";

export type GoalRepository = {
  get(goalId:string):GoalRecord|null;
  insert(goal:GoalRecord):void;
  update(goal:GoalRecord,expectedStatus?:GoalRecord["status"]):boolean;
};
export type GoalTaskRepository = {
  listByGoal(goalId:string):TaskRecord[];
};
export type GoalDecision = {
  status:GoalRecord["status"];
  progress:number;
  nextAction:"plan"|"preflight"|"execute"|"repair"|"complete"|"blocked"|"none";
  blockers:string[];
};

/** Deterministic goal supervisor: decides next action from persisted state, never from agent self-report. */
export function evaluateGoal(input:{
  goal:GoalRecord;
  tasks:TaskRecord[];
  productionBible?:ProductionBible;
  requiredTaskIds?:string[];
}):GoalDecision {
  const goal=goalSchema.parse(input.goal);
  const tasks=input.tasks.map(task=>taskRecordSchema.parse(task));
  const blockers:string[]=[];
  if(goal.spentUsd>goal.budgetUsd) blockers.push("Goal budget exceeded");
  if(tasks.some(task=>task.status==="failed")) blockers.push("One or more tasks permanently failed");
  const required=new Set(input.requiredTaskIds??tasks.map(task=>task.taskId));
  const completed=new Set(tasks.filter(task=>task.status==="succeeded").map(task=>task.taskId));
  const progress=required.size===0?0:completed.size/required.size;
  if(goal.status==="cancelled"||goal.status==="failed") return {status:goal.status,progress,nextAction:"none",blockers};
  if(blockers.length) return {status:"blocked",progress,nextAction:"blocked",blockers};
  if(goal.status==="draft") return {status:"planning",progress,nextAction:"plan",blockers};
  if(goal.status==="planning") return {status:"preflight",progress,nextAction:"preflight",blockers};
  if(goal.status==="preflight") {
    if(!input.productionBible) return {status:"blocked",progress,nextAction:"blocked",blockers:["Production Bible is missing"]};
    if(!input.productionBible.preflightPassed) return {status:"blocked",progress,nextAction:"blocked",blockers:["Production preflight has not been approved"]};
    const result=validateMasterProductionPlan(input.productionBible);
    if(!result.valid) return {status:"blocked",progress,nextAction:"blocked",blockers:result.errors};
    return {status:"running",progress,nextAction:"execute",blockers};
  }
  if(required.size>0&&[...required].every(id=>completed.has(id))) return {status:"completed",progress:1,nextAction:"complete",blockers};
  if(tasks.some(task=>task.status==="retry_wait"||task.status==="pending"||task.status==="ready")) return {status:"running",progress,nextAction:"execute",blockers};
  if(tasks.some(task=>task.status==="leased"||task.status==="running"||task.status==="validating")) return {status:"running",progress,nextAction:"execute",blockers};
  return {status:"blocked",progress,nextAction:"repair",blockers:["No runnable task or accepted completion state is available"]};
}

export function transitionGoal(goalInput:GoalRecord,decision:GoalDecision,now:string):GoalRecord {
  const goal=goalSchema.parse(goalInput);
  const allowed:Record<GoalRecord["status"],GoalRecord["status"][]> = {
    draft:["planning","cancelled"],planning:["preflight","blocked","cancelled"],
    preflight:["running","blocked","cancelled"],running:["blocked","completed","failed","cancelled"],
    blocked:["planning","preflight","running","failed","cancelled"],
    completed:[],failed:[],cancelled:[]
  };
  if(goal.status!==decision.status&&!allowed[goal.status].includes(decision.status)) throw new Error(`Invalid goal transition ${goal.status} -> ${decision.status}`);
  return goalSchema.parse({...goal,status:decision.status,updatedAt:now});
}
