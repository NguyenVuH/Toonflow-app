import { workflowGraphSchema, type WorkflowEdge, type WorkflowGraph, type WorkflowNode } from "../schemas/workflow";

export type GraphIssue = { code: string; message: string; nodeIds: string[] };
export type GraphValidation = { valid: boolean; issues: GraphIssue[]; topologicalOrder: string[] };

function port<T extends { name: string }>(ports: T[], name: string): T | undefined {
  return ports.find(item => item.name === name);
}

export function validateWorkflowGraph(input: WorkflowGraph): GraphValidation {
  const graph = workflowGraphSchema.parse(input);
  const issues: GraphIssue[] = [];
  const ids = new Set<string>();
  for (const node of graph.nodes) {
    if (ids.has(node.nodeId)) issues.push({ code: "DUPLICATE_NODE", message: `Duplicate node ID: ${node.nodeId}`, nodeIds: [node.nodeId] });
    ids.add(node.nodeId);
    const inputNames = node.inputs.map(p => p.name);
    const outputNames = node.outputs.map(p => p.name);
    if (new Set(inputNames).size !== inputNames.length) issues.push({ code: "DUPLICATE_INPUT_PORT", message: `Duplicate input port on ${node.nodeId}`, nodeIds: [node.nodeId] });
    if (new Set(outputNames).size !== outputNames.length) issues.push({ code: "DUPLICATE_OUTPUT_PORT", message: `Duplicate output port on ${node.nodeId}`, nodeIds: [node.nodeId] });
  }

  const incoming = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const id of ids) { incoming.set(id, 0); adjacency.set(id, []); }
  const seenEdges = new Set<string>();
  for (const edge of graph.edges) {
    const edgeKey = `${edge.fromNodeId}:${edge.fromPort}->${edge.toNodeId}:${edge.toPort}`;
    if (seenEdges.has(edgeKey)) issues.push({ code: "DUPLICATE_EDGE", message: `Duplicate edge: ${edgeKey}`, nodeIds: [edge.fromNodeId, edge.toNodeId] });
    seenEdges.add(edgeKey);
    const from = graph.nodes.find(n => n.nodeId === edge.fromNodeId);
    const to = graph.nodes.find(n => n.nodeId === edge.toNodeId);
    if (!from || !to) { issues.push({ code: "MISSING_NODE", message: `Edge references missing node: ${edgeKey}`, nodeIds: [edge.fromNodeId, edge.toNodeId] }); continue; }
    const out = port(from.outputs, edge.fromPort);
    const inputPort = port(to.inputs, edge.toPort);
    if (!out || !inputPort) { issues.push({ code: "MISSING_PORT", message: `Edge references missing port: ${edgeKey}`, nodeIds: [from.nodeId, to.nodeId] }); continue; }
    if (out.type !== inputPort.type || edge.valueType !== out.type) issues.push({ code: "TYPE_MISMATCH", message: `Incompatible port types: ${edgeKey}`, nodeIds: [from.nodeId, to.nodeId] });
    if (adjacency.get(from.nodeId)!.includes(to.nodeId)) continue;
    adjacency.get(from.nodeId)!.push(to.nodeId);
    incoming.set(to.nodeId, incoming.get(to.nodeId)! + 1);
  }

  for (const node of graph.nodes) {
    for (const dependency of node.dependsOn) {
      if (!ids.has(dependency)) issues.push({ code: "MISSING_DEPENDENCY", message: `Node ${node.nodeId} depends on missing node ${dependency}`, nodeIds: [node.nodeId, dependency] });
      else if (!adjacency.get(dependency)!.includes(node.nodeId)) {
        adjacency.get(dependency)!.push(node.nodeId);
        incoming.set(node.nodeId, incoming.get(node.nodeId)! + 1);
      }
    }
    for (const inputPort of node.inputs) {
      if (inputPort.required && !graph.edges.some(e => e.toNodeId === node.nodeId && e.toPort === inputPort.name)) {
        issues.push({ code: "UNCONNECTED_REQUIRED_INPUT", message: `Required input ${node.nodeId}.${inputPort.name} is not connected`, nodeIds: [node.nodeId] });
      }
    }
  }

  const queue = [...incoming.entries()].filter(([, count]) => count === 0).map(([id]) => id).sort();
  const order: string[] = [];
  while (queue.length) {
    const current = queue.shift()!;
    order.push(current);
    for (const next of adjacency.get(current) ?? []) {
      incoming.set(next, incoming.get(next)! - 1);
      if (incoming.get(next) === 0) { queue.push(next); queue.sort(); }
    }
  }
  if (order.length !== graph.nodes.length) issues.push({ code: "CYCLE", message: "Workflow graph contains a cycle", nodeIds: graph.nodes.filter(n => !order.includes(n.nodeId)).map(n => n.nodeId) });
  return { valid: issues.length === 0, issues, topologicalOrder: order };
}

/**
 * Auto-connect nodes using explicit semanticKey matches and declared dependencies.
 * Ambiguous matches are rejected rather than guessed. The AI may propose nodes/config,
 * but this compiler owns edge construction and validation.
 */
export function autoConnectWorkflow(
  workflowId: string,
  version: number,
  nodesInput: WorkflowNode[],
  createdAt = new Date().toISOString()
): WorkflowGraph {
  const nodes = nodesInput.map(node => ({ ...node, inputs: [...node.inputs], outputs: [...node.outputs], dependsOn: [...node.dependsOn] }));
  const edges: WorkflowEdge[] = [];
  const nodeIds = new Set(nodes.map(n => n.nodeId));
  if (nodeIds.size !== nodes.length) throw new Error("Workflow contains duplicate node IDs");

  for (const node of nodes) {
    for (const dependency of node.dependsOn) {
      if (!nodeIds.has(dependency)) throw new Error(`Missing dependency ${dependency} for ${node.nodeId}`);
      const source = nodes.find(n => n.nodeId === dependency)!;
      const candidates = source.outputs.flatMap(out => node.inputs
        .filter(input => input.required && input.semanticKey && input.semanticKey === out.semanticKey && input.type === out.type)
        .map(input => ({ out, input })));
      if (candidates.length > 1) throw new Error(`Ambiguous semantic connection from ${dependency} to ${node.nodeId}`);
      if (candidates.length === 1) {
        const { out, input } = candidates[0];
        if (!edges.some(e => e.toNodeId === node.nodeId && e.toPort === input.name)) {
          edges.push({ edgeId: `auto:${dependency}:${out.name}:${node.nodeId}:${input.name}`, fromNodeId: dependency, fromPort: out.name, toNodeId: node.nodeId, toPort: input.name, valueType: out.type, autoGenerated: true });
        }
      }
    }
  }
  const graph = workflowGraphSchema.parse({ workflowId, version, nodes, edges, createdAt });
  const validation = validateWorkflowGraph(graph);
  if (!validation.valid) throw new Error(`Invalid auto-built workflow: ${validation.issues.map(i => i.message).join("; ")}`);
  return graph;
}

export function readyNodeIds(graphInput: WorkflowGraph, completed: string[], failed: string[] = []): string[] {
  const graph = workflowGraphSchema.parse(graphInput);
  const done = new Set(completed);
  const blocked = new Set(failed);
  return graph.nodes.filter(node => node.enabled && !done.has(node.nodeId) && !blocked.has(node.nodeId))
    .filter(node => {
      const deps = new Set([...node.dependsOn, ...graph.edges.filter(e => e.toNodeId === node.nodeId).map(e => e.fromNodeId)]);
      return [...deps].every(id => done.has(id));
    }).map(node => node.nodeId).sort();
}
