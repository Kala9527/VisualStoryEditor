import type { ID } from "../domain/types/project";
import type { RuntimeContext } from "../domain/types/runtime";
import type { WorkflowEdge, WorkflowGraph, WorkflowNode } from "../domain/types/workflow";
import { evaluateCondition } from "../domain/expression/evaluator";

export interface GraphValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface EdgeResolution {
  edge: WorkflowEdge;
  nextNode: WorkflowNode;
}

export class GraphResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphResolutionError";
  }
}

export function getNode(graph: WorkflowGraph, nodeId: ID): WorkflowNode {
  const node = graph.nodes[nodeId];
  if (!node) {
    throw new GraphResolutionError(`Workflow node "${nodeId}" was not found`);
  }
  return node;
}

export function getOutgoingEdges(
  graph: WorkflowGraph,
  fromNodeId: ID,
  outputPort?: string,
): WorkflowEdge[] {
  return graph.edges.filter((edge) => {
    if (edge.from.nodeId !== fromNodeId) {
      return false;
    }
    return outputPort === undefined || edge.from.port === outputPort;
  });
}

export function resolveNextEdge(
  graph: WorkflowGraph,
  fromNodeId: ID,
  outputPort: string,
  ctx: RuntimeContext,
): EdgeResolution | null {
  const edges = getOutgoingEdges(graph, fromNodeId, outputPort);

  for (const edge of edges) {
    if (!edge.guard || evaluateCondition(edge.guard, ctx)) {
      return {
        edge,
        nextNode: getNode(graph, edge.to.nodeId),
      };
    }
  }

  return null;
}

export function resolveNextNodeId(
  graph: WorkflowGraph,
  fromNodeId: ID,
  outputPort: string,
  ctx: RuntimeContext,
): ID | null {
  return resolveNextEdge(graph, fromNodeId, outputPort, ctx)?.nextNode.id ?? null;
}

export const resolveNextNode = resolveNextNodeId;

export function assertPortExists(node: WorkflowNode, port: string, direction: "input" | "output"): void {
  const ports = direction === "input" ? node.inputPorts : node.outputPorts;
  if (!ports.includes(port)) {
    throw new GraphResolutionError(`${node.id} does not have ${direction} port "${port}"`);
  }
}

export function validateGraph(graph: WorkflowGraph): GraphValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodeIds = new Set(Object.keys(graph.nodes));

  if (!graph.startNodeId || !nodeIds.has(graph.startNodeId)) {
    errors.push(`startNodeId "${graph.startNodeId}" does not exist`);
  }

  const startNodes = Object.values(graph.nodes).filter((node) => node.type === "start");
  if (startNodes.length !== 1) {
    errors.push(`graph must contain exactly one start node, got ${startNodes.length}`);
  }

  for (const node of Object.values(graph.nodes)) {
    validateNodePorts(node, errors);
  }

  graph.edges.forEach((edge) => validateEdge(edge, graph, errors));
  validateReachability(graph, warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateNodePorts(node: WorkflowNode, errors: string[]): void {
  if (!Array.isArray(node.inputPorts)) {
    errors.push(`node "${node.id}" inputPorts must be an array`);
  }
  if (!Array.isArray(node.outputPorts)) {
    errors.push(`node "${node.id}" outputPorts must be an array`);
  }

  if (node.type === "condition") {
    for (const branch of node.branches) {
      if (!node.outputPorts.includes(branch.port)) {
        errors.push(`node "${node.id}" missing condition output port "${branch.port}"`);
      }
    }
    if (!node.outputPorts.includes(node.fallbackPort)) {
      errors.push(`node "${node.id}" missing fallback output port "${node.fallbackPort}"`);
    }
  }

  if (node.type === "random") {
    for (const branch of node.branches) {
      if (branch.weight <= 0) {
        errors.push(`node "${node.id}" random branch "${branch.port}" must have positive weight`);
      }
      if (!node.outputPorts.includes(branch.port)) {
        errors.push(`node "${node.id}" missing random output port "${branch.port}"`);
      }
    }
  }
}

function validateEdge(edge: WorkflowEdge, graph: WorkflowGraph, errors: string[]): void {
  const fromNode = graph.nodes[edge.from.nodeId];
  const toNode = graph.nodes[edge.to.nodeId];

  if (!fromNode) {
    errors.push(`edge "${edge.id}" references missing from node "${edge.from.nodeId}"`);
  } else if (!fromNode.outputPorts.includes(edge.from.port)) {
    errors.push(`edge "${edge.id}" references missing output port "${edge.from.port}" on "${fromNode.id}"`);
  }

  if (!toNode) {
    errors.push(`edge "${edge.id}" references missing to node "${edge.to.nodeId}"`);
  } else if (!toNode.inputPorts.includes(edge.to.port)) {
    errors.push(`edge "${edge.id}" references missing input port "${edge.to.port}" on "${toNode.id}"`);
  }
}

function validateReachability(graph: WorkflowGraph, warnings: string[]): void {
  if (!graph.nodes[graph.startNodeId]) {
    return;
  }

  const visited = new Set<ID>();
  const queue: ID[] = [graph.startNodeId];

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId || visited.has(nodeId)) {
      continue;
    }

    visited.add(nodeId);
    for (const edge of graph.edges) {
      if (edge.from.nodeId === nodeId && !visited.has(edge.to.nodeId)) {
        queue.push(edge.to.nodeId);
      }
    }
  }

  for (const nodeId of Object.keys(graph.nodes)) {
    if (!visited.has(nodeId)) {
      warnings.push(`node "${nodeId}" is unreachable from start`);
    }
  }
}
