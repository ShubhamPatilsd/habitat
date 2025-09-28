import { Agent } from "@mastra/core/agent";
import { google } from "@ai-sdk/google";
import { z } from "zod";

export const burrower = new Agent({
  name: "Burrower",
  instructions: `
    You are an expert at analyzing text content and evaluating how closely related it is to a topic. Given a topic and text content, determine whether or not the text content belongs to a new topic. 
    
    If the text content belongs to a new topic, generate a 1-2 word title for the topic.
    
    Each topic should be a single, clear concept that someone could dive deeper into.
  `,
  model: google("gemini-2.5-flash"),
});

// Helper function to generate topics
export async function generateRelatedTopics(
  topic: string,
  data: string
): Promise<{ topicGood: boolean; newTopic: string }> {
  const response = await burrower.generate(
    `Return a boolean value describing if the text content "${data}" should be under the topic "${topic}." If the data shouldn't be under the topic "${topic}," return a 1-2 word string "topic" that describes the topic area of the given data`,
    {
      structuredOutput: {
        schema: z.object({
          topicGood: z.boolean(),
          newTopic: z.string(),
        }),
      },
    }
  );

  if (!response.object) {
    throw new Error(
      "Failed to generate related topics: response.object is undefined"
    );
  }
  return response.object;
}
