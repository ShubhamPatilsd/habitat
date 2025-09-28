import { TopicNode, KnowledgeGraph } from "./graph";

export class KnowledgeGraphManager {
  private graph: KnowledgeGraph;
  private nextId: number = 0;

  constructor() {
    this.graph = {
      nodes: new Map(),
      connections: new Map(),
    };
  }

  // Add initial topic
  addRootTopic(title: string, description: string): TopicNode {
    const node: TopicNode = {
      id: this.generateId(),
      title,
      description,
      x: 400, // Center of screen
      y: 300,
      depth: 0,
    };

    this.graph.nodes.set(node.id, node);
    this.graph.connections.set(node.id, []);
    return node;
  }

  // Spawn 10 related topics around a clicked node
  spawnRelatedTopics(
    parentId: string,
    relatedTopics: Array<{ title: string; description: string }>
  ): TopicNode[] {
    const parent = this.graph.nodes.get(parentId);
    if (!parent) throw new Error("Parent node not found");

    const newNodes: TopicNode[] = [];
    const children: string[] = [];

    relatedTopics.forEach((topic, index) => {
      const node: TopicNode = {
        id: this.generateId(),
        title: topic.title,
        description: topic.description,
        x: this.calculatePosition(
          parent.x,
          parent.y,
          index,
          relatedTopics.length
        ),
        y: this.calculatePosition(
          parent.y,
          parent.x,
          index,
          relatedTopics.length,
          true
        ),
        parentId: parentId,
        depth: parent.depth + 1,
      };

      this.graph.nodes.set(node.id, node);
      this.graph.connections.set(node.id, []);
      newNodes.push(node);
      children.push(node.id);
    });

    // Update parent's children
    this.graph.connections.set(parentId, children);
    return newNodes;
  }

  // Get all nodes
  getAllNodes(): TopicNode[] {
    return Array.from(this.graph.nodes.values());
  }

  // Get children of a node
  getChildren(nodeId: string): TopicNode[] {
    const childIds = this.graph.connections.get(nodeId) || [];
    return childIds.map((id) => this.graph.nodes.get(id)!).filter(Boolean);
  }

  // Get node by ID
  getNode(nodeId: string): TopicNode | undefined {
    return this.graph.nodes.get(nodeId);
  }

  // Clear the graph
  clear(): void {
    this.graph.nodes.clear();
    this.graph.connections.clear();
    this.nextId = 0;
  }

  private generateId(): string {
    return `topic-${this.nextId++}`;
  }

  private calculatePosition(
    centerX: number,
    centerY: number,
    index: number,
    total: number,
    isY: boolean = false
  ): number {
    const radius = 150 + Math.random() * 100; // Random distance from parent
    const angle = (index / total) * 2 * Math.PI + Math.random() * 0.5; // Spread around circle

    const offset = isY ? Math.sin(angle) * radius : Math.cos(angle) * radius;

    return centerX + offset;
  }
}
