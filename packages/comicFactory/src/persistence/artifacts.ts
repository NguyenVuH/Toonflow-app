import { Database } from "bun:sqlite";
import { z } from "zod";
const artifactSchema=z.object({workflowId:z.string().min(1),nodeId:z.string().min(1),version:z.number().int().positive(),output:z.json(),contentHash:z.string().min(1),createdAt:z.string().datetime()}).strict();
export type WorkflowArtifact=z.infer<typeof artifactSchema>;
export class SqliteWorkflowArtifactRepository{
 private readonly db:Database;
 constructor(path:string){this.db=new Database(path,{create:true});this.db.exec("PRAGMA journal_mode=WAL;");this.db.exec(`CREATE TABLE IF NOT EXISTS comic_workflow_artifacts(workflow_id TEXT NOT NULL,node_id TEXT NOT NULL,version INTEGER NOT NULL,output_json TEXT NOT NULL,content_hash TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(workflow_id,node_id,version))`);}
 put(input:WorkflowArtifact):void{const a=artifactSchema.parse(input);const old=this.get(a.workflowId,a.nodeId,a.version);if(old&&old.contentHash!==a.contentHash)throw new Error("Artifact version exists with a different hash");this.db.query("INSERT OR IGNORE INTO comic_workflow_artifacts(workflow_id,node_id,version,output_json,content_hash,created_at) VALUES(?,?,?,?,?,?)").run(a.workflowId,a.nodeId,a.version,JSON.stringify(a.output),a.contentHash,a.createdAt);}
 get(workflowId:string,nodeId:string,version=1):WorkflowArtifact|null{const row=this.db.query("SELECT output_json,content_hash,created_at FROM comic_workflow_artifacts WHERE workflow_id=? AND node_id=? AND version=?").get(workflowId,nodeId,version) as {output_json:string;content_hash:string;created_at:string}|null;return row?artifactSchema.parse({workflowId,nodeId,version,output:JSON.parse(row.output_json),contentHash:row.content_hash,createdAt:row.created_at}):null;}
 close():void{this.db.close();}
}
