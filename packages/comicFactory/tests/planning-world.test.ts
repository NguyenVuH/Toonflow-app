import {describe,expect,test} from "bun:test";
import {createMasterProductionPlan,validateMasterProductionPlan} from "../src/planning";
import {SqliteWorldRepository,onboardWorldEntity} from "../src/world";
import type {ProductionBible} from "../src/schemas/planning";
import type {WorldEntity} from "../src/schemas/world";
const now="2026-11-26T00:00:00.000Z";
const node=(planId:string,level:"season"|"chapter",parentPlanId?:string)=>({planId,parentPlanId,level,title:planId,objective:"Advance story",status:"ready" as const,dependencies:[],requiredEntityIds:[],requiredAssetIds:[],preconditions:[],expectedStateChanges:[],acceptanceCriteria:["Continuity"],constitutionVersion:1,revision:1});
const bible:ProductionBible={seriesId:"S1",version:1,brief:"Một pháp sư xuyên không",language:"vi",genre:["fantasy"],audience:"young adult",worldBibleRef:"world-1",constitutionVersion:1,styleProfileId:"manhwa",seasonPlans:[node("season-1","season")],chapterPlans:[node("chapter-1","chapter","season-1")],assetPlanRefs:["asset-plan-1"],budgetUsd:100,concurrencyLimit:4,preflightPassed:true,createdAt:now};
describe("production planning",()=>{
test("validates a complete Vietnamese preproduction bible",()=>expect(validateMasterProductionPlan(bible).valid).toBe(true));
test("rejects dependency cycles",()=>{const bad={...bible,chapterPlans:[{...bible.chapterPlans[0],dependencies:["chapter-2"]},{...bible.chapterPlans[0],planId:"chapter-2",dependencies:["chapter-1"]}]};expect(validateMasterProductionPlan(bad).valid).toBe(false);});
test("calls planner adapter with Vietnamese and no-panel constraint",async()=>{const result=await createMasterProductionPlan({brief:bible.brief,compile:async input=>{expect(input.language).toBe("vi");expect(input.constraints.noPanelGenerationDuringPreproduction).toBe(true);return bible;}});expect(result.seriesId).toBe("S1");expect(result.preflightPassed).toBe(false);});
});
describe("world entity onboarding",()=>{
test("deduplicates canonical names and aliases",()=>{const repo=new SqliteWorldRepository(":memory:");const entity:WorldEntity={entityId:"CHAR_1",version:1,type:"character",canonicalName:"Elara",aliases:["Nữ kiếm sĩ"],description:"Guardian",lifecycle:"ready",assetRefs:[{assetId:"face-1",version:1,role:"face"}],requiredReferenceRoles:["face"],canonFacts:{},createdAt:now};repo.register(entity);expect(repo.register({...entity,entityId:"CHAR_2",canonicalName:"Nữ kiếm sĩ",aliases:[]}).duplicateOf).toBe("CHAR_1");repo.close();});
test("registers entity only after required references pass QA",async()=>{const repo=new SqliteWorldRepository(":memory:");const entity:WorldEntity={entityId:"ITEM_1",version:1,type:"item",canonicalName:"Huyết Nguyệt",aliases:[],description:"Crimson sword",lifecycle:"discovered",assetRefs:[],requiredReferenceRoles:["orthographic","detail"],canonFacts:{},createdAt:now};const ready=await onboardWorldEntity({entity,repository:repo,generateReferences:async()=>[{assetId:"a1",version:1,role:"orthographic"},{assetId:"a2",version:1,role:"detail"}],validateReferences:async()=>({valid:true,errors:[]})});expect(ready.lifecycle).toBe("ready");expect(repo.find("ITEM_1")?.assetRefs).toHaveLength(2);repo.close();});
});
