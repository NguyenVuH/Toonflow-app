import { z } from "zod";
import type { WorkflowGraph } from "../schemas/workflow";
import type { TaskRecord } from "../schemas/runtime";
import type { TaskRepository } from "../persistence/sqlite";
import type { SqliteWorkflowArtifactRepository } from "../persistence/artifacts";
import { scheduleReadyTasks, transitionTask } from "./scheduler";
import { validateWorkflowGraph } from "../workflow/graph";

export type WorkflowNodeContext={workflowId:string;nodeId:string;task:TaskRecord;inputs:Record<string,unknown>;upstreamArtifacts:Array<{nodeId:string;version:number;contentHash:string}>};
export type WorkflowNodeResult={output:unknown;costUsd:number};
export type WorkflowExecutionResult={status:"completed"|"blocked"|"max_rounds";succeededNodeIds:string[];failedNodeIds:string[];blockedNodeIds:string[];rounds:number};

/** Executes dependency waves, persists validated node artifacts and resumes from succeeded tasks. */
export async function runWorkflowToCompletion(input:{
 graph:WorkflowGraph;goalId:string;repository:TaskRepository;artifacts:SqliteWorkflowArtifactRepository;
 workerId:string;concurrency:number;execute:(context:WorkflowNodeContext)=>Promise<WorkflowNodeResult>;
 validate:(nodeId:string,output:unknown)=>Promise<{valid:boolean;errors:string[]}>;
 now?:()=>string;maxRounds?:number;
}):Promise<WorkflowExecutionResult>{
 const graphCheck=validateWorkflowGraph(input.graph);
 if(!graphCheck.valid)throw new Error("Invalid workflow: "+graphCheck.issues.map(issue=>issue.message).join("; "));
 if(!Number.isInteger(input.concurrency)||input.concurrency<1)throw new Error("Concurrency must be positive");
 const now=input.now??(()=>new Date().toISOString()),maxRounds=input.maxRounds??100;
 const nodeById=new Map(input.graph.nodes.map(node=>[node.nodeId,node]));
 const taskIdByNode=new Map(input.graph.nodes.map(node=>[node.nodeId,input.graph.workflowId+":"+node.nodeId]));
 for(const node of input.graph.nodes){
  const taskId=taskIdByNode.get(node.nodeId)!;
  if(!input.repository.get(taskId)){
   const dependencies=[...new Set([...node.dependsOn,...input.graph.edges.filter(edge=>edge.toNodeId===node.nodeId).map(edge=>edge.fromNodeId)])].map(id=>taskIdByNode.get(id)??input.graph.workflowId+":"+id);
   input.repository.insert({taskId,goalId:input.goalId,nodeId:node.nodeId,dependencies,status:"pending",attempts:0,maxAttempts:3,estimatedCostUsd:0,actualCostUsd:0,idempotencyKey:input.graph.workflowId+":"+node.nodeId+":v"+input.graph.version,createdAt:now(),updatedAt:now()});
  }
 }
 let rounds=0;
 while(rounds<maxRounds){
  rounds++;
  const tasks=input.graph.nodes.map(node=>input.repository.get(taskIdByNode.get(node.nodeId)!)).filter((task):task is TaskRecord=>!!task);
  if(tasks.length===input.graph.nodes.length&&tasks.every(task=>task.status==="succeeded"))return {status:"completed",succeededNodeIds:tasks.map(task=>task.nodeId),failedNodeIds:[],blockedNodeIds:[],rounds};
  const failed=tasks.filter(task=>task.status==="failed"||task.status==="cancelled");
  if(failed.length){
   const failedIds=new Set(failed.map(task=>task.taskId));
   return {status:"blocked",succeededNodeIds:tasks.filter(task=>task.status==="succeeded").map(task=>task.nodeId),failedNodeIds:failed.map(task=>task.nodeId),blockedNodeIds:tasks.filter(task=>task.status!=="succeeded"&&!failedIds.has(task.taskId)&&task.dependencies.some(id=>failedIds.has(id))).map(task=>task.nodeId),rounds};
  }
  const succeededIds=tasks.filter(task=>task.status==="succeeded").map(task=>task.taskId);
  const ready=scheduleReadyTasks(tasks,succeededIds,now(),input.concurrency);
  if(!ready.length)return {status:"blocked",succeededNodeIds:tasks.filter(task=>task.status==="succeeded").map(task=>task.nodeId),failedNodeIds:[],blockedNodeIds:tasks.filter(task=>task.status!=="succeeded").map(task=>task.nodeId),rounds};
  await Promise.all(ready.map(async taskId=>{
   let task=input.repository.get(taskId);if(!task)return;
   const node=nodeById.get(task.nodeId);if(!node||!node.enabled)return;
   try{
    const previousStatus=task.status;
    task=transitionTask(task,{type:"lease",workerId:input.workerId,now:now(),leaseSeconds:300});
    if(!input.repository.update(task,previousStatus))throw new Error("Task lease lost to another worker");
    task=transitionTask(task,{type:"start",workerId:input.workerId,now:now()});
    if(!input.repository.update(task,"leased"))throw new Error("Task start transition lost");
    const inputs:Record<string,unknown>={},upstream:Array<{nodeId:string;version:number;contentHash:string}>=[];
    for(const edge of input.graph.edges.filter(edge=>edge.toNodeId===node.nodeId)){
     const artifact=input.artifacts.get(input.graph.workflowId,edge.fromNodeId,input.graph.version);
     if(!artifact)throw new Error("Missing upstream artifact from "+edge.fromNodeId);
     inputs[edge.toPort]=artifact.output;upstream.push({nodeId:edge.fromNodeId,version:artifact.version,contentHash:artifact.contentHash});
    }
    const result=await input.execute({workflowId:input.graph.workflowId,nodeId:node.nodeId,task,inputs,upstreamArtifacts:upstream});
    const checked=await input.validate(node.nodeId,result.output);
    if(!checked.valid)throw new Error("Output validation failed: "+checked.errors.join("; "));
    if(!Number.isFinite(result.costUsd)||result.costUsd<0)throw new Error("Invalid execution cost");
    const serializableOutput=z.json().parse(result.output);
    const hash=await sha256(JSON.stringify(serializableOutput));
    input.artifacts.put({workflowId:input.graph.workflowId,nodeId:node.nodeId,version:input.graph.version,output:serializableOutput,contentHash:hash,createdAt:now()});
    task=transitionTask(task,{type:"validate",workerId:input.workerId,now:now()});
    if(!input.repository.update(task,"running"))throw new Error("Task validation transition lost");
    task=transitionTask(task,{type:"succeed",workerId:input.workerId,now:now(),actualCostUsd:result.costUsd});
    if(!input.repository.update(task,"validating"))throw new Error("Task completion transition lost");
   }catch(error){
    const current=input.repository.get(taskId);
    if(current&&["leased","running","validating"].includes(current.status)&&current.leaseOwner===input.workerId){
     const retry=transitionTask(current,{type:"fail",workerId:input.workerId,now:now(),error:error instanceof Error?error.message:String(error),retryable:true});
     input.repository.update(retry,current.status);
    }
   }
  }));
 }
 const tasks=input.graph.nodes.map(node=>input.repository.get(taskIdByNode.get(node.nodeId)!)).filter((task):task is TaskRecord=>!!task);
 return {status:"max_rounds",succeededNodeIds:tasks.filter(task=>task.status==="succeeded").map(task=>task.nodeId),failedNodeIds:tasks.filter(task=>task.status==="failed").map(task=>task.nodeId),blockedNodeIds:tasks.filter(task=>task.status!=="succeeded").map(task=>task.nodeId),rounds};
}
async function sha256(value:string):Promise<string>{const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");}
