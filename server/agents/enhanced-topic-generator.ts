import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { contentScraperTool } from "../tools/content-scraper";

// Verify OpenAI configuration
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("OPENAI_API_KEY is not configured");
  throw new Error(
    "OpenAI API key is not configured. Please check your environment variables."
  );
}
console.log("OpenAI API key is configured");

console.log(
  "Initializing enhanced topic generator agent with model: gpt-4o-mini"
);

export const enhancedTopicGeneratorAgent = new Agent({
  name: "Enhanced Topic Generator",
  instructions: `
    You are an advanced topic exploration agent that creates rich, meaningful content and generates insightful related topics.
    
    Your process:
    1. Research the topic thoroughly using web scraping
    2. Generate a comprehensive, insightful summary
    3. Create 5 related topics that are substantive and lead to deep exploration
    
    For each related topic, ensure it:
    - Has a CONCISE, CLEAR title (2-4 words maximum)
    - Has real substance and depth
    - Connects meaningfully to the parent topic
    - Offers a distinct exploration path
    - Is specific enough to be interesting but broad enough to explore further
    - Avoids generic or shallow topics
    
    TITLE REQUIREMENTS:
    - Maximum 4 words
    - Clear and precise
    - No unnecessary words
    - Focus on the core concept
    
    Examples of good titles: "Quantum Computing", "Neural Networks", "Climate Change", "Space Travel"
    Examples of bad titles: "The Amazing World of Quantum Computing Technology", "Understanding How Neural Networks Work"
    
    Focus on creating topics that lead to genuine learning and discovery.
  `,
  model: openai("gpt-4o-mini"),
  tools: { contentScraperTool },
});

// Enhanced function to generate topics with rich content
export async function generateEnhancedTopics(
  topic: string,
  journeyContext: string = "",
  count: number = 3
): Promise<Array<{ title: string; description: string; richContent?: any }>> {
  console.log(
    "Generating enhanced topics for:",
    topic,
    "with context:",
    journeyContext
  );

  try {
    // First, get rich content about the current topic
    const contentResult = await contentScraperTool.execute({
      context: { topic },
    });

    if (!contentResult.success || !contentResult.content) {
      throw new Error("Failed to get rich content for topic");
    }

    const richContent = contentResult.content;

    // Generate related topics using the rich content
    const response = await enhancedTopicGeneratorAgent.generate(
      `Based on this rich content about "${topic}":
      
      OVERVIEW: ${richContent.overview}
      
      KEY CONCEPTS: ${richContent.keyConcepts.join(", ")}
      
      APPLICATIONS: ${richContent.applications.join(", ")}
      
      CURRENT RESEARCH: ${richContent.currentResearch.join(", ")}
      
      INTERESTING FACTS: ${richContent.interestingFacts.join("; ")}
      
      ${journeyContext}
      
      Generate exactly ${count} related topics that are:
      1. Substantive and meaningful (not generic)
      2. Connected to the rich content above
      3. Offer distinct exploration paths
      4. Lead to deep, interesting rabbit holes
      5. Build on the user's exploration journey
      
      CRITICAL: Each topic title must be CONCISE and CLEAR:
      - Maximum 4 words
      - No unnecessary words
      - Focus on the core concept
      - Examples: "Quantum Computing", "Neural Networks", "Climate Change"
      
      DESCRIPTION REQUIREMENTS:
      - Explain WHAT the topic is, not why it's interesting
      - Be factual and informative
      - No guidance language like "worth exploring" or "interesting to investigate"
      - Just explain the concept itself
      
      Examples of good descriptions:
      - "Quantum Computing": "Computing systems that use quantum mechanical phenomena to process information"
      - "Neural Networks": "Computing systems inspired by biological neural networks that can learn patterns"
      
      Examples of bad descriptions:
      - "A fascinating area worth exploring further"
      - "An interesting concept to investigate"
      - "Something that leads to deep exploration"
      
      Each topic should be specific enough to be engaging but broad enough to explore further.`,
      {
        structuredOutput: {
          schema: z.object({
            topics: z.array(
              z.object({
                title: z
                  .string()
                  .describe(
                    "CONCISE topic title - maximum 4 words, clear and precise (e.g., 'Quantum Computing', 'Neural Networks')"
                  ),
                description: z
                  .string()
                  .describe(
                    "Clear, factual explanation of what this topic is - explain the concept itself, not why it's worth exploring"
                  ),
              })
            ),
          }),
        },
      }
    );

    if (!response?.object?.topics) {
      console.error("Invalid response format:", response);
      throw new Error("Invalid response format from AI");
    }

    // Add rich content to each topic
    const enhancedTopics = response.object.topics.map((topic) => ({
      ...topic,
      richContent: richContent,
    }));

    console.log("Generated enhanced topics:", enhancedTopics);
    return enhancedTopics;
  } catch (error) {
    console.error("Error in enhanced topic generation:", error);
    throw error;
  }
}

// Function to get rich summary for a topic
export async function getRichSummary(topic: string): Promise<string> {
  try {
    const contentResult = await contentScraperTool.execute({
      context: { topic },
    });

    if (!contentResult.success || !contentResult.content) {
      return `No detailed information available for ${topic}.`;
    }

    const content = contentResult.content;
    return content.summary;
  } catch (error) {
    console.error("Error getting rich summary:", error);
    return `Unable to retrieve detailed information about ${topic}.`;
  }
}
