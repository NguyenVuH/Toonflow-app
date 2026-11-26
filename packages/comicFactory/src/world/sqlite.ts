import { Database } from "bun:sqlite";
import type { WorldEntity, WorldEvent } from "../schemas/world";
import { worldEntitySchema, worldEventSchema } from "../schemas/world";

export class SqliteWorldRepository {
  private readonly db: Database;
  constructor(path: string) {
    this.db = new Database(path, { create: true });
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
    this.db.exec(`CREATE TABLE IF NOT EXISTS comic_entities (
      entity_id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, canonical_name TEXT NOT NULL,
      normalized_name TEXT NOT NULL, aliases_json TEXT NOT NULL, version INTEGER NOT NULL,
      lifecycle TEXT NOT NULL, payload TEXT NOT NULL, UNIQUE(entity_type, normalized_name));
      CREATE TABLE IF NOT EXISTS comic_world_events (
      event_id TEXT PRIMARY KEY, series_id TEXT NOT NULL, chapter_id TEXT NOT NULL,
      sequence INTEGER NOT NULL, payload TEXT NOT NULL, UNIQUE(series_id, chapter_id, sequence));
      CREATE INDEX IF NOT EXISTS idx_comic_events_chapter ON comic_world_events(series_id, chapter_id, sequence);`);
  }
  find(entityId: string): WorldEntity | null {
    const row = this.db.query("SELECT payload FROM comic_entities WHERE entity_id=?").get(entityId) as {payload:string}|null;
    return row ? worldEntitySchema.parse(JSON.parse(row.payload)) : null;
  }
  findByName(type: WorldEntity["type"], name: string): WorldEntity | null {
    const normalized = normalizeName(name);
    const row = this.db.query("SELECT payload FROM comic_entities WHERE entity_type=? AND normalized_name=?").get(type, normalized) as {payload:string}|null;
    if (row) return worldEntitySchema.parse(JSON.parse(row.payload));
    const rows = this.db.query("SELECT payload FROM comic_entities WHERE entity_type=?").all(type) as {payload:string}[];
    for (const candidate of rows) {
      const entity = worldEntitySchema.parse(JSON.parse(candidate.payload));
      if (entity.aliases.some(alias => normalizeName(alias) === normalized)) return entity;
    }
    return null;
  }
  register(input: WorldEntity): {entity:WorldEntity; duplicateOf?:string} {
    const entity = worldEntitySchema.parse(input);
    const duplicate = this.findByName(entity.type, entity.canonicalName) ??
      entity.aliases.map(alias => this.findByName(entity.type, alias)).find(Boolean) ?? null;
    if (duplicate) return {entity:duplicate, duplicateOf:duplicate.entityId};
    this.db.query("INSERT INTO comic_entities(entity_id,entity_type,canonical_name,normalized_name,aliases_json,version,lifecycle,payload) VALUES(?,?,?,?,?,?,?,?)")
      .run(entity.entityId,entity.type,entity.canonicalName,normalizeName(entity.canonicalName),JSON.stringify(entity.aliases),entity.version,entity.lifecycle,JSON.stringify(entity));
    return {entity};
  }
  update(input: WorldEntity, expectedVersion: number): boolean {
    const entity = worldEntitySchema.parse(input);
    if (entity.version !== expectedVersion + 1) throw new Error("Entity version must increment exactly once");
    const result = this.db.query("UPDATE comic_entities SET canonical_name=?,normalized_name=?,aliases_json=?,version=?,lifecycle=?,payload=? WHERE entity_id=? AND version=?")
      .run(entity.canonicalName,normalizeName(entity.canonicalName),JSON.stringify(entity.aliases),entity.version,entity.lifecycle,JSON.stringify(entity),entity.entityId,expectedVersion);
    return result.changes === 1;
  }
  appendEvent(input: WorldEvent): void {
    const event = worldEventSchema.parse(input);
    for (const id of [...event.actorEntityIds,...event.targetEntityIds]) if (!this.find(id)) throw new Error(`Unknown world entity: ${id}`);
    this.db.query("INSERT INTO comic_world_events(event_id,series_id,chapter_id,sequence,payload) VALUES(?,?,?,?,?)")
      .run(event.eventId,event.seriesId,event.chapterId,event.sequence,JSON.stringify(event));
  }
  listEvents(seriesId:string,chapterId:string):WorldEvent[] {
    const rows=this.db.query("SELECT payload FROM comic_world_events WHERE series_id=? AND chapter_id=? ORDER BY sequence").all(seriesId,chapterId) as {payload:string}[];
    return rows.map(row=>worldEventSchema.parse(JSON.parse(row.payload)));
  }
  close():void { this.db.close(); }
}
function normalizeName(value:string):string { return value.normalize("NFC").trim().toLocaleLowerCase("vi").replace(/\s+/g," "); }
