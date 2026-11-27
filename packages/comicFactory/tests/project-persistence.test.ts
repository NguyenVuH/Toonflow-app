import { describe, expect, test } from "bun:test";
import { SqliteComicProjectRepository } from "../src/persistence";
import type { ProductionBible } from "../src/schemas/planning";
import type { WorkflowGraph } from "../src/schemas/workflow";

const now = "2026-11-27T00:00:00.000Z";
const bible: ProductionBible = {
  seriesId: "series-1", version: 1, brief: "Một truyện fantasy", language: "vi",
  genre: ["fantasy"], audience: "young adult", worldBibleRef: "world-1",
  constitutionVersion: 1, styleProfileId: "manga", seasonPlans: [{
    planId: "season-1", level: "season", title: "Mùa 1", objective: "Mở đầu",
    status: "ready", dependencies: [], requiredEntityIds: [], requiredAssetIds: [],
    preconditions: [], expectedStateChanges: [], acceptanceCriteria: ["Giữ continuity"],
    constitutionVersion: 1, revision: 1
  }], chapterPlans: [{
    planId: "chapter-1", parentPlanId: "season-1", level: "chapter", title: "Chương 1", objective: "Giới thiệu",
    status: "ready", dependencies: [], requiredEntityIds: [], requiredAssetIds: [],
    preconditions: [], expectedStateChanges: [], acceptanceCriteria: ["Có mở đầu"],
    constitutionVersion: 1, revision: 1
  }], assetPlanRefs: ["asset-plan-1"], budgetUsd: 100, concurrencyLimit: 4,
  preflightPassed: false, createdAt: now
};
const graph: WorkflowGraph = {
  workflowId: "workflow-1", version: 1, createdAt: now,
  nodes: [{ nodeId: "brief", kind: "trigger", title: "Brief", capability: "input", inputs: [],
    outputs: [{ name: "brief", type: "text", semanticKey: "series_brief" }], dependsOn: [], config: {}, enabled: true }],
  edges: []
};

describe("Comic Factory project persistence", () => {
  test("persists series bibles and workflow graphs", () => {
    const repo = new SqliteComicProjectRepository(":memory:");
    repo.putBible(bible);
    repo.putWorkflow(bible.seriesId, graph);
    expect(repo.getBible(bible.seriesId)?.brief).toBe(bible.brief);
    expect(repo.listBibles()).toHaveLength(1);
    expect(repo.getWorkflow(graph.workflowId)?.nodes[0]?.nodeId).toBe("brief");
    expect(repo.listWorkflows(bible.seriesId)).toHaveLength(1);
    repo.close();
  });

  test("rejects stale bible versions", () => {
    const repo = new SqliteComicProjectRepository(":memory:");
    repo.putBible(bible);
    expect(() => repo.putBible(bible)).toThrow("version must increase");
    repo.close();
  });

  test("requires the series bible before saving a workflow", () => {
    const repo = new SqliteComicProjectRepository(":memory:");
    expect(() => repo.putWorkflow("missing-series", graph)).toThrow("does not exist");
    repo.close();
  });
});
