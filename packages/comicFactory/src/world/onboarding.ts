import type { WorldEntity } from "../schemas/world";
import { worldEntitySchema } from "../schemas/world";
import type { SqliteWorldRepository } from "./sqlite";

export type GeneratedReference = {assetId:string;version:number;role:string;providerId?:string;modelId?:string};
export async function onboardWorldEntity(input:{
  entity:WorldEntity;
  repository:SqliteWorldRepository;
  generateReferences:(entity:WorldEntity,roles:string[])=>Promise<GeneratedReference[]>;
  validateReferences:(entity:WorldEntity,refs:GeneratedReference[])=>Promise<{valid:boolean;errors:string[]}>;
}):Promise<WorldEntity>{
  let entity=worldEntitySchema.parse(input.entity);
  const existing=input.repository.findByName(entity.type,entity.canonicalName);
  if(existing)return existing;
  entity=worldEntitySchema.parse({...entity,lifecycle:"reference_generating"});
  const refs=await input.generateReferences(entity,entity.requiredReferenceRoles);
  const result=await input.validateReferences(entity,refs);
  if(!result.valid)throw new Error(`Reference QA failed: ${result.errors.join("; ")}`);
  const roles=new Set(refs.map(ref=>ref.role));
  const missing=entity.requiredReferenceRoles.filter(role=>!roles.has(role));
  if(missing.length)throw new Error(`Missing required reference roles: ${missing.join(", ")}`);
  entity=worldEntitySchema.parse({...entity,lifecycle:"ready",assetRefs:[...entity.assetRefs,...refs]});
  return input.repository.register(entity).entity;
}
