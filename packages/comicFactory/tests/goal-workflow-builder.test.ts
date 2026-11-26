import { describe, expect, test } from "bun:test";
import { createCoreNodeRegistry, buildWorkflowFromNaturalLanguage } from "../src/workflow/builder";
import { evaluateGoal, transitionGoal } from "../src/runtime/goal-engine";
import type { GoalRecord } from "../src/schemas/runtime";

const now="2026-11-26T00:00:00.000Z";
describe("AI workflow planner",()=>{
 test("builds a typed graph from a Vietnamese goal using registered node types",async()=>{
  const registry=createCoreNodeRegistry();
  const graph=await buildWorkflowFromNaturalLanguage({
   workflowId:"comic-series",version:1,goal:"Tạo series truyện tranh fantasy bằng tiếng Việt",
   language:"vi",constitutionVersion:1,constraints:["Không tạo panel trước preproduction"],
   registry,createdAt:now,
   plan:async input=>{
    expect(input.language).toBe("vi");
    return {nodes:[
     {nodeId:"brief",nodeType:"brief.input",title:"Ý tưởng",dependsOn:[]},
     {nodeId:"plan",nodeType:"story.preproduction",title:"Lập kế hoạch",dependsOn:["brief"]}
    ]};
   }
  });
  expect(graph.edges).toHaveLength(1);
 });
 test("rejects unknown node types rather than inventing unsafe nodes",async()=>{
  await expect(buildWorkflowFromNaturalLanguage({
   workflowId:"bad",version:1,goal:"x",constitutionVersion:1,constraints:[],registry:createCoreNodeRegistry(),
   plan:async()=>({nodes:[{nodeId:"x",nodeType:"not.registered",title:"x",dependsOn:[]}]})
  })).rejects.toThrow("Unknown node type");
 });
});

describe("goal supervisor",()=>{
 const goal:GoalRecord={goalId:"g1",seriesId:"s1",objective:"Produce a series",acceptanceCriteria:["All chapters exported"],status:"draft",planVersion:1,constitutionVersion:1,budgetUsd:100,spentUsd:0,createdAt:now,updatedAt:now};
 test("moves draft goal to planning and rejects invalid completion transition",()=>{
  const decision=evaluateGoal({goal,tasks:[]});
  expect(decision.nextAction).toBe("plan");
  const next=transitionGoal(goal,decision,now);
  expect(next.status).toBe("planning");
  expect(()=>transitionGoal(goal,{...decision,status:"completed",nextAction:"complete"},now)).toThrow("Invalid goal transition");
 });
});
