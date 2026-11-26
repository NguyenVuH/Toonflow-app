import {describe,expect,test} from "bun:test";
import {ToolRegistry} from "../src/tools/registry";
import {registerToonflowMediaTools} from "../src/tools/toonflow-media";
import {delegateAgentTask} from "../src/agents/delegation";
import type {AgentSpec,TaskPackage} from "../src/schemas/agent";
const now="2026-11-26T00:00:00.000Z";
describe("Toonflow media bridge",()=>{
 test("registers image tool and validates selected model before calling provider",async()=>{
  const registry=new ToolRegistry();let called=false;
  registerToonflowMediaTools(registry,{
   listModels:async()=>[{providerId:"p",providerLabel:"P",modelId:"image-1",label:"Image",type:"image"}],
   generateImage:async request=>{called=true;expect(request.other?.negativePrompt).toEqual(["watermark"]);return [{path:"assets/panel.png",mimeType:"image/png",mediaType:"image"}];},
   generateAudio:async()=>[]
  });
  const result=await registry.execute("comic.generate_image",1,{providerId:"p",modelId:"image-1",prompt:"fantasy panel",negativePrompt:["watermark"],outputDirectory:"assets",references:[],parameters:{}},{taskId:"t",seriesId:"s",agentId:"artist",allowedToolIds:["comic.generate_image"],permissions:["write_asset"]});
  expect(called).toBe(true);expect((result as {files:unknown[]}).files).toHaveLength(1);
 });
 test("does not call a model that is not registered as image capable",async()=>{
  const registry=new ToolRegistry();let called=false;
  registerToonflowMediaTools(registry,{listModels:async()=>[],generateImage:async()=>{called=true;return[];},generateAudio:async()=>[]});
  await expect(registry.execute("comic.generate_image",1,{providerId:"p",modelId:"bad",prompt:"x",outputDirectory:"assets"},{taskId:"t",seriesId:"s",agentId:"a",allowedToolIds:["comic.generate_image"],permissions:["write_asset"]})).rejects.toThrow("not available");
  expect(called).toBe(false);
 });
});

describe("agent delegation",()=>{
 test("compiles instructions and validates worker output before returning",async()=>{
  const spec:AgentSpec={agentId:"writer",version:1,role:"Writer",objective:"Write scenes",responsibilities:["Write scenes"],prohibitedActions:["Change canon"],requiredCapabilities:["reasoning"],requiredContext:[],allowedToolIds:["story.read"],deniedToolIds:[],inputSchema:{type:"object"},outputSchema:{type:"object"},instructions:"Follow rules",acceptanceCriteria:["Valid scene"],timeoutSeconds:60,maxAttempts:2,active:true};
  const task:TaskPackage={taskId:"t1",idempotencyKey:"t1-idempotency",parentGoalId:"g1",agentId:"writer",agentSpecVersion:1,objective:"Write scene 1",scope:{seriesId:"s1"},dependencies:[],input:{},contextRefs:[],constitutionVersion:1,requiredRuleIds:[],assetRefs:[],allowedToolIds:["story.read"],outputSchema:{type:"object"},acceptanceCriteria:["Scene has objective"],timeoutSeconds:60,maxAttempts:2,createdAt:now};
  const result=await delegateAgentTask({
   spec,task,workers:[{workerId:"w1",capabilities:["reasoning"],provider:{providerId:"p",modelId:"m",modalities:["text"],supportsNegativePrompt:false,supportsImageReferences:false,maxImageReferences:0,supportsImageEditing:false,supportsSeed:false,supportsAsyncJobs:false,supportsCancellation:false,supportedRatios:[],supportedOutputFormats:[]},enabled:true,maxConcurrent:2,currentConcurrent:0}],
   workerAdapters:[{workerId:"w1",providerId:"p",modelId:"m",run:async input=>{expect(input.instruction).toContain("Write scene 1");return{output:{scene:"ok"},costUsd:0.01};}}],
   validateOutput:async output=>({valid:!!output,errors:[]})
  });
  expect(result.workerId).toBe("w1");
 });
});
