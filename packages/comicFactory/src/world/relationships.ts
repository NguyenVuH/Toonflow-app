import { z } from "zod";
import { Database } from "bun:sqlite";

export const worldRelationshipSchema=z.object({
  relationshipId:z.string().min(1),
  seriesId:z.string().min(1),
  fromEntityId:z.string().min(1),
  toEntityId:z.string().min(1),
  type:z.enum(["OWNS","EQUIPPED","LOCATED_AT","MEMBER_OF","ALLIED_WITH","ENEMY_OF","KNOWS","LOVES","RELATED_TO","TRANSFERRED_TO","CREATED_BY","GUARDS","DESTROYED_BY"]),
  validFromChapter:z.string().optional(),
  validThroughChapter:z.string().optional(),
  status:z.enum(["active","ended","superseded"]).default("active"),
  attributes:z.record(z.string(),z.json()).default({}),
  version:z.number().int().positive().default(1),
  createdAt:z.string().datetime()
}).strict().superRefine((r,ctx)=>{
  if(r.fromEntityId===r.toEntityId)ctx.addIssue({code:"custom",path:["toEntityId"],message:"Self relationships are not allowed"});
});

export type WorldRelationship=z.infer<typeof worldRelationshipSchema>;

export class SqliteRelationshipRepository {
  private readonly db:Database;
  constructor(path:string){
    this.db=new Database(path,{create:true});
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
    this.db.exec(`CREATE TABLE IF NOT EXISTS comic_relationships(
      relationship_id TEXT PRIMARY KEY, series_id TEXT NOT NULL, from_entity_id TEXT NOT NULL,
      to_entity_id TEXT NOT NULL, relation_type TEXT NOT NULL, status TEXT NOT NULL,
      version INTEGER NOT NULL, payload TEXT NOT NULL,
      UNIQUE(series_id,from_entity_id,to_entity_id,relation_type,status));
      CREATE INDEX IF NOT EXISTS idx_comic_relationship_from ON comic_relationships(series_id,from_entity_id,status);
      CREATE INDEX IF NOT EXISTS idx_comic_relationship_to ON comic_relationships(series_id,to_entity_id,status);`);
  }
  upsert(input:WorldRelationship):WorldRelationship{
    const relation=worldRelationshipSchema.parse(input);
    const row=this.db.query("SELECT version FROM comic_relationships WHERE relationship_id=?").get(relation.relationshipId) as {version:number}|null;
    if(row&&relation.version!==row.version+1)throw new Error("Relationship version must increment exactly once");
    if(!row&&relation.version!==1)throw new Error("New relationship must start at version 1");
    this.db.query(`INSERT INTO comic_relationships(relationship_id,series_id,from_entity_id,to_entity_id,relation_type,status,version,payload)
      VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(relationship_id) DO UPDATE SET status=excluded.status,version=excluded.version,payload=excluded.payload
      WHERE comic_relationships.version=excluded.version-1`).run(relation.relationshipId,relation.seriesId,relation.fromEntityId,relation.toEntityId,relation.type,relation.status,relation.version,JSON.stringify(relation));
    return relation;
  }
  listFrom(seriesId:string,entityId:string):WorldRelationship[]{
    const rows=this.db.query("SELECT payload FROM comic_relationships WHERE series_id=? AND from_entity_id=? ORDER BY relation_type,relationship_id").all(seriesId,entityId) as {payload:string}[];
    return rows.map(row=>worldRelationshipSchema.parse(JSON.parse(row.payload)));
  }
  listTo(seriesId:string,entityId:string):WorldRelationship[]{
    const rows=this.db.query("SELECT payload FROM comic_relationships WHERE series_id=? AND to_entity_id=? ORDER BY relation_type,relationship_id").all(seriesId,entityId) as {payload:string}[];
    return rows.map(row=>worldRelationshipSchema.parse(JSON.parse(row.payload)));
  }
  close():void{this.db.close();}
}
