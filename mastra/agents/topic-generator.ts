import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

export const topicGeneratorAgent = new Agent({
  name: "Topic Generator",
  instructions: `
    You are a topic exploration agent. Given a topic, generate exactly 10 related topics that would be interesting to explore further.
    
    Make them diverse, intriguing, and lead to different rabbit holes. Think about:
    - Subtopics and related concepts
    - Historical context
    - Applications and use cases
    - Controversies or debates
    - Future implications
    - Cross-disciplinary connections
    
    Each topic should be a single, clear concept that someone could dive deeper into.
    Keep titles concise (2-4 words) and descriptions brief (1-2 sentences).
  `,
  model: openai("gpt-5"),
});

// Helper function to generate topics
export async function generateRelatedTopics(
  topic: string
): Promise<Array<{ title: string; description: string }>> {
  const response = await topicGeneratorAgent.generate(
    `Generate 10 interesting related topics to explore from "${topic}". Make them diverse and lead to different rabbit holes.`,
    {
      structuredOutput: {
        schema: z.object({
          topics: z.array(
            z.object({
              title: z.string(),
              description: z.string(),
            })
          ),
        }),
      },
    }
  );

  return response.object.topics;
}
