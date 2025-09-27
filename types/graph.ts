export interface TopicNode {
  id: string;
  title: string;
  description: string;
  x: number;
  y: number;
  parentId?: string;
  depth: number;
}

export interface KnowledgeGraph {
  nodes: Map<string, TopicNode>;
  connections: Map<string, string[]>;
}
