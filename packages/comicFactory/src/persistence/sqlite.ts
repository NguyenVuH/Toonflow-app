import { Database } from "bun:sqlite";
import type { TaskRecord } from "../schemas/runtime";
import { taskRecordSchema } from "../schemas/runtime";

export interface TaskRepository {
  get(taskId: string): TaskRecord | null;
  listByGoal(goalId: string): TaskRecord[];
  insert(task: TaskRecord): void;
  update(task: TaskRecord, expectedStatus?: TaskRecord["status"]): boolean;
}

/**
 * Bun SQLite persistence adapter. Keep the database on durable app/server storage,
 * never in Android cache. Each update is transactional and can use optimistic status checks.
 */
export class SqliteTaskRepository implements TaskRepository {
  private readonly db: Database;
  constructor(path: string) {
    this.db = new Database(path, { create: true });
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS comic_tasks (
        task_id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_comic_tasks_goal_status ON comic_tasks(goal_id, status);
    `);
  }

  get(taskId: string): TaskRecord | null {
    const row = this.db.query("SELECT payload FROM comic_tasks WHERE task_id = ?").get(taskId) as { payload: string } | null;
    return row ? taskRecordSchema.parse(JSON.parse(row.payload)) : null;
  }

  listByGoal(goalId: string): TaskRecord[] {
    const rows = this.db.query("SELECT payload FROM comic_tasks WHERE goal_id = ? ORDER BY updated_at, task_id").all(goalId) as { payload: string }[];
    return rows.map(row => taskRecordSchema.parse(JSON.parse(row.payload)));
  }

  insert(input: TaskRecord): void {
    const task = taskRecordSchema.parse(input);
    this.db.query("INSERT INTO comic_tasks(task_id, goal_id, status, payload, updated_at) VALUES (?, ?, ?, ?, ?)")
      .run(task.taskId, task.goalId, task.status, JSON.stringify(task), task.updatedAt);
  }

  update(input: TaskRecord, expectedStatus?: TaskRecord["status"]): boolean {
    const task = taskRecordSchema.parse(input);
    const statement = expectedStatus
      ? this.db.query("UPDATE comic_tasks SET status = ?, payload = ?, updated_at = ? WHERE task_id = ? AND status = ?")
      : this.db.query("UPDATE comic_tasks SET status = ?, payload = ?, updated_at = ? WHERE task_id = ?");
    const result = expectedStatus
      ? statement.run(task.status, JSON.stringify(task), task.updatedAt, task.taskId, expectedStatus)
      : statement.run(task.status, JSON.stringify(task), task.updatedAt, task.taskId);
    return result.changes === 1;
  }

  close(): void { this.db.close(); }
}
