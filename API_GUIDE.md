# Knowledge Graph API Guide

## Overview

This API generates related topics for knowledge graph exploration. Give it a topic, get back 10 related topics to explore.

## API Endpoint

### POST `/api/explore-topic`

**Request Body:**

```json
{
  "topic": "Artificial Intelligence"
}
```

**Response:**

```json
{
  "success": true,
  "topics": [
    {
      "title": "Machine Learning",
      "description": "Algorithms that enable computers to learn and make decisions from data without explicit programming."
    },
    {
      "title": "Neural Networks",
      "description": "Computing systems inspired by biological neural networks that can recognize patterns and solve complex problems."
    }
    // ... 8 more topics
  ]
}
```

## Usage Examples

### JavaScript/React

```javascript
const generateTopics = async (topic) => {
  const response = await fetch("/api/explore-topic", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ topic }),
  });

  const data = await response.json();
  return data.topics;
};

// Usage
const topics = await generateTopics("Quantum Computing");
```

### Python

```python
import requests

def generate_topics(topic):
    response = requests.post('http://localhost:3000/api/explore-topic',
                           json={'topic': topic})
    return response.json()['topics']

# Usage
topics = generate_topics("Space Exploration")
```

### cURL

```bash
curl -X POST http://localhost:3000/api/explore-topic \
  -H "Content-Type: application/json" \
  -d '{"topic": "Climate Change"}'
```

## Core Files

### 1. Topic Generator Agent (`mastra/agents/topic-generator.ts`)

- Uses GPT-4o to generate 10 diverse related topics
- Each topic has a title (2-4 words) and description (1-2 sentences)
- Designed to create interesting rabbit holes for exploration

### 2. Graph Manager (`lib/KnowledgeGraphManager.ts`)

- Handles graph data structure and node positioning
- Manages parent-child relationships between topics
- Calculates positions for new nodes in a circle around parent

### 3. API Route (`app/api/explore-topic/route.ts`)

- Simple endpoint that takes a topic and returns 10 related topics
- Handles errors gracefully

## Graph Data Structure

```typescript
interface TopicNode {
  id: string;
  title: string;
  description: string;
  x: number; // Screen position
  y: number; // Screen position
  parentId?: string; // Which node spawned this one
  depth: number; // How deep in the rabbit hole
}
```

## Frontend Integration Ideas

1. **Click to Spawn**: Click any topic node to spawn 10 new related topics around it
2. **Visual Connections**: Draw lines between parent and child nodes
3. **Hover Tooltips**: Show topic descriptions on hover
4. **Depth Visualization**: Use different colors/sizes for different depths
5. **Zoom/Pan**: Allow users to navigate large graphs
6. **Search**: Let users search for specific topics in the graph

## Tips for Frontend

- Use the `depth` field to create visual hierarchy
- Position nodes using the `x` and `y` coordinates from the graph manager
- Connect nodes using `parentId` to draw relationship lines
- Cache API responses to avoid regenerating the same topics
- Consider limiting graph depth to prevent infinite expansion

## Error Handling

The API returns standard HTTP status codes:

- `200`: Success
- `400`: Missing or invalid topic
- `500`: Server error (usually OpenAI API issues)

Always check the `success` field in the response before using `topics`.
