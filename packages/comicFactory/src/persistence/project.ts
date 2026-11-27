import { Database } from "bun:sqlite";
import type { ProductionBible } from "../schemas/planning";
import { productionBibleSchema } from "../schemas/planning";
import type { WorkflowGraph } from "../schemas/workflow";
import { workflowGraphSchema } from "../schemas/workflow";

/** Per-workspace durable project store for Comic Factory planning artifacts. */
export class SqliteComicProjectRepository {
  private readonly db: Database;

  constructor(path: string) {
    this.db = new Database(path, { create: true });
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS comic_series_bibles (
        series_id TEXT PRIMARY KEY,
        version INTEGER NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS comic_workflows (
        workflow_id TEXT PRIMARY KEY,
        series_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(series_id) REFERENCES comic_series_bibles(series_id)
      );
      CREATE INDEX IF NOT EXISTS idx_comic_workflows_series ON comic_workflows(series_id, updated_at);
    `);
  }

  getBible(seriesId: string): ProductionBible | null {
    const row = this.db.query("SELECT payload FROM comic_series_bibles WHERE series_id=?").get(seriesId) as { payload: string } | null;
    return row ? productionBibleSchema.parse(JSON.parse(row.payload)) : null;
  }

  listBibles(): ProductionBible[] {
    const rows = this.db.query("SELECT payload FROM comic_series_bibles ORDER BY updated_at DESC, series_id").all() as { payload: string }[];
    return rows.map(row => productionBibleSchema.parse(JSON.parse(row.payload)));
  }

  putBible(input: ProductionBible): void {
    const bible = productionBibleSchema.parse(input);
    const existing = this.getBible(bible.seriesId);
    if (existing && bible.version <= existing.version) {
      throw Object.assign(new Error("Production Bible version must increase when updating a series"), { status: 409 });
    }
    const result = this.db.query(`
      INSERT INTO comic_series_bibles(series_id,version,payload,updated_at) VALUES(?,?,?,?)
      ON CONFLICT(series_id) DO UPDATE SET version=excluded.version,payload=excluded.payload,updated_at=excluded.updated_at
      WHERE comic_series_bibles.version < excluded.version
    `).run(bible.seriesId, bible.version, JSON.stringify(bible), bible.createdAt);
    if (result.changes !== 1) throw Object.assign(new Error("Production Bible changed concurrently; reload and retry"), { status: 409 });
  }

  getWorkflow(workflowId: string): WorkflowGraph | null {
    const row = this.db.query("SELECT payload FROM comic_workflows WHERE workflow_id=?").get(workflowId) as { payload: string } | null;
    return row ? workflowGraphSchema.parse(JSON.parse(row.payload)) : null;
  }

  listWorkflows(seriesId: string): WorkflowGraph[] {
    const rows = this.db.query("SELECT payload FROM comic_workflows WHERE series_id=? ORDER BY updated_at DESC, workflow_id").all(seriesId) as { payload: string }[];
    return rows.map(row => workflowGraphSchema.parse(JSON.parse(row.payload)));
  }

  putWorkflow(seriesId: string, input: WorkflowGraph): void {
    const graph = workflowGraphSchema.parse(input);
    if (!this.getBible(seriesId)) throw Object.assign(new Error("Series Production Bible does not exist"), { status: 404 });
    const existing = this.getWorkflow(graph.workflowId);
    if (existing && graph.version <= existing.version) {
      throw Object.assign(new Error("Workflow version must increase when updating a graph"), { status: 409 });
    }
    const result = this.db.query(`
      INSERT INTO comic_workflows(workflow_id,series_id,version,payload,updated_at) VALUES(?,?,?,?,?)
      ON CONFLICT(workflow_id) DO UPDATE SET series_id=excluded.series_id,version=excluded.version,payload=excluded.payload,updated_at=excluded.updated_at
      WHERE comic_workflows.version < excluded.version
    `).run(graph.workflowId, seriesId, graph.version, JSON.stringify(graph), graph.createdAt);
    if (result.changes !== 1) throw Object.assign(new Error("Workflow changed concurrently; reload and retry"), { status: 409 });
  }

  close(): void {
    this.db.close();
  }
}
