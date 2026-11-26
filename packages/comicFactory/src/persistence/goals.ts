import { Database } from "bun:sqlite";
import type { GoalRecord } from "../schemas/runtime";
import { goalSchema } from "../schemas/runtime";
import type { GoalRepository } from "../runtime/goal-engine";

export class SqliteGoalRepository implements GoalRepository {
  private readonly db: Database;
  constructor(path: string) {
    this.db = new Database(path, { create: true });
    this.db.exec("PRAGMA journal_mode=WAL;");
    this.db.exec(`CREATE TABLE IF NOT EXISTS comic_goals (
      goal_id TEXT PRIMARY KEY, series_id TEXT NOT NULL, status TEXT NOT NULL,
      version INTEGER NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL
    ); CREATE INDEX IF NOT EXISTS idx_comic_goals_status ON comic_goals(status,updated_at);`);
  }
  get(goalId: string): GoalRecord | null {
    const row = this.db.query("SELECT payload FROM comic_goals WHERE goal_id=?").get(goalId) as {payload:string}|null;
    return row ? goalSchema.parse(JSON.parse(row.payload)) : null;
  }
  insert(input: GoalRecord): void {
    const goal = goalSchema.parse(input);
    this.db.query("INSERT INTO comic_goals(goal_id,series_id,status,version,payload,updated_at) VALUES(?,?,?,?,?,?)")
      .run(goal.goalId,goal.seriesId,goal.status,1,JSON.stringify(goal),goal.updatedAt);
  }
  update(input: GoalRecord, expectedStatus?: GoalRecord["status"]): boolean {
    const goal = goalSchema.parse(input);
    const query = expectedStatus
      ? this.db.query("UPDATE comic_goals SET status=?,version=version+1,payload=?,updated_at=? WHERE goal_id=? AND status=?")
      : this.db.query("UPDATE comic_goals SET status=?,version=version+1,payload=?,updated_at=? WHERE goal_id=?");
    const result = expectedStatus
      ? query.run(goal.status,JSON.stringify(goal),goal.updatedAt,goal.goalId,expectedStatus)
      : query.run(goal.status,JSON.stringify(goal),goal.updatedAt,goal.goalId);
    return result.changes === 1;
  }
  close(): void { this.db.close(); }
}
