import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

// Verify OpenAI configuration
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('OPENAI_API_KEY is not configured');
  throw new Error('OpenAI API key is not configured. Please check your environment variables.');
}
console.log('OpenAI API key is configured');

console.log('Initializing topic generator agent with model: gpt-4');

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
  model: openai("gpt-4"),
});

// Helper function to generate topics
export async function generateRelatedTopics(
  topic: string
): Promise<Array<{ title: string; description: string }>> {
  console.log('Generating topics for:', topic);
  try {
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

    if (!response?.object?.topics) {
      console.error('Invalid response format:', response);
      throw new Error('Invalid response format from AI');
    }

    console.log('Generated topics:', response.object.topics);
    return response.object.topics;
  } catch (error) {
    console.error('Error in topic generation:', error);
    throw error;
  }
}
