import { MindMapNode, Edge } from '../store/useMindMapStore';

/**
 * Builds a map of nodeId → hierarchical number string (e.g. "1", "1.2", "2.1.3").
 * The root node is assigned an empty string (no visible number).
 * Children of the root are numbered 1, 2, 3…
 * Their children are numbered 1.1, 1.2… and so on.
 */
export function computeNodeNumbers(
  nodes: Record<string, MindMapNode>,
  edges: Edge[],
): Record<string, string> {
  const childrenOf: Record<string, string[]> = {};
  const hasParentEdge = new Set<string>();

  for (const edge of edges) {
    if (!childrenOf[edge.from]) childrenOf[edge.from] = [];
    childrenOf[edge.from].push(edge.to);
    hasParentEdge.add(edge.to);
  }

  const rootId = Object.keys(nodes).find(id => !hasParentEdge.has(id));
  if (!rootId) return {};

  const result: Record<string, string> = {};

  function visit(nodeId: string, prefix: string) {
    result[nodeId] = prefix;
    const children = childrenOf[nodeId] ?? [];
    children.forEach((childId, i) => {
      const childNum = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
      visit(childId, childNum);
    });
  }

  visit(rootId, '');
  return result;
}
