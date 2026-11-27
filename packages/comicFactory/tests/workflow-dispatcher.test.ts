import {describe,expect,test} from "bun:test";
import {z} from "zod";
import {createWorkflowNodeDispatcher} from "../src/runtime/node-dispatcher";
import {ToolRegistry} from "../src/tools/registry";
import type {WorkflowGraph} from "../src/schemas/workflow";
import type {TaskRecord} from "../src/schemas/runtime";

const now="2026-11-27T00:00:00.000Z";
const task:TaskRecord={
 taskId:"task-1",goalId:"goal-1",nodeId:"render",dependencies:[],status:"running",
 attempts:1,maxAttempts:3,leaseOwner:"worker-1",leaseExpiresAt:"2026-11-27T00:05:00.000Z",
 estimatedCostUsd:1,actualCostUsd:0,idempotencyKey:"task-1-idempotent",
 createdAt:now,updatedAt:now
};
const graph:WorkflowGraph={
 workflowId:"wf-1",version:1,createdAt:now,
 nodes:[
  {nodeId:"bible",kind:"trigger",title:"Bible",capability:"planning",inputs:[],outputs:[{name:"bible",type:"series_bible"}],dependsOn:[],config:{},enabled:true},
  {nodeId:"render",kind:"renderer",title:"Render",capability:"rendering",inputs:[{name:"pages",type:"json",required:true}],outputs:[{name:"file",type:"file"}],dependsOn:["bible"],requiredToolIds:["comic.render"],requiredCapabilities:["rendering"],config:{},enabled:true}
 ],
 edges:[]
};
describe("workflow node dispatcher",()=>{
 test("executes registered tools with explicit permission and task input",async()=>{
  const tools=new ToolRegistry();
  let called=false;
  tools.register({
   toolId:"comic.render",version:1,description:"Render chapter",
   inputSchema:z.object({pages:z.array(z.string())}),
   outputSchema:z.object({path:z.string()}),
   requiredPermissions:["render"],
   handler:async input=>{called=true;expect(input.pages).toEqual(["page-1"]);return{path:"chapter.html"};}
  });
  const dispatch=createWorkflowNodeDispatcher({
   graph,seriesId:"S1",tools,resolveAgent:async()=>{throw new Error("not used");},
   resolveToolPermissions:()=>["render"]
  });
  const result=await dispatch({workflowId:"wf-1",nodeId:"render",task,inputs:{pages:["page-1"]},upstreamArtifacts:[]});
  expect(called).toBe(true);
  expect(result).toEqual({output:{path:"chapter.html"},costUsd:0});
 });
 test("refuses nodes without one registered tool binding",async()=>{
  const tools=new ToolRegistry();
  const broken:WorkflowGraph={...graph,nodes:[{...graph.nodes[1]!,requiredToolIds:[]}]};
  const dispatch=createWorkflowNodeDispatcher({
   graph:broken,seriesId:"S1",tools,resolveAgent:async()=>{throw new Error("not used");},
   resolveToolPermissions:()=>[]
  });
  await expect(dispatch({workflowId:"wf-1",nodeId:"render",task,inputs:{},upstreamArtifacts:[]})).rejects.toThrow("exactly one executable tool");
 });
 test("returns only host-provided trigger output",async()=>{
  const tools=new ToolRegistry();
  const dispatch=createWorkflowNodeDispatcher({
   graph,seriesId:"S1",tools,resolveAgent:async()=>{throw new Error("not used");},
   resolveToolPermissions:()=>[],triggerOutputs:{bible:{seriesId:"S1",version:1}}
  });
  const result=await dispatch({workflowId:"wf-1",nodeId:"bible",task:{...task,nodeId:"bible"},inputs:{},upstreamArtifacts:[]});
  expect(result.output).toEqual({seriesId:"S1",version:1});
 });
 test("does not silently execute conditional nodes without edge semantics",async()=>{
  const conditional:WorkflowGraph={...graph,nodes:[{...graph.nodes[1]!,kind:"condition"}]};
  const dispatch=createWorkflowNodeDispatcher({
   graph:conditional,seriesId:"S1",tools,resolveAgent:async()=>{throw new Error("not used");},
   resolveToolPermissions:()=>[]
  });
  await expect(dispatch({workflowId:"wf-1",nodeId:"render",task,inputs:{},upstreamArtifacts:[]})).rejects.toThrow("Conditional routing is not supported");
 });
});
