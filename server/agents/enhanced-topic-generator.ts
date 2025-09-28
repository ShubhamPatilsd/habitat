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

export const enhancedTopicGeneratorAgent = new Agent({
  name: "Enhanced Topic Generator",
  instructions: `
    You are an advanced topic exploration agent that creates CAPTIVATING, INTRIGUING content and generates absolutely fascinating related topics that people can't resist exploring.
    
    Your process:
    1. Research the topic thoroughly using web scraping
    2. Generate a comprehensive, insightful summary
    3. Create 5 related topics that are so compelling and mysterious people must click on them
    
    For each related topic, ensure it:
    - Has a CONCISE, INTRIGUING title (2-4 words maximum) that sparks curiosity
    - Is absolutely CAPTIVATING and mind-blowing
    - Connects meaningfully to the parent topic
    - Offers a distinct exploration path into fascinating territory
    - Is specific enough to be compelling but broad enough to explore further
    - Avoids generic or boring topics - focus on mysteries, breakthroughs, paradoxes
    
    TITLE REQUIREMENTS:
    - Maximum 4 words
    - INTRIGUING and MYSTERIOUS
    - No unnecessary words
    - Focus on the most fascinating aspect
    
    Examples of CAPTIVATING titles: "Consciousness Mystery", "Time Dilation", "Lost Civilizations", "Quantum Entanglement", "Digital Immortality"
    Examples of boring titles: "Quantum Computing", "Neural Networks", "Climate Change", "Space Travel"
    
    Focus on creating topics that make people go "WOW, I need to know more about this!" 
    Think mysteries, breakthroughs, paradoxes, and mind-bending concepts that are genuinely fascinating!
  `,
  model: openai("gpt-4o-mini"),
});

// Enhanced function to generate topics with rich content
export async function generateEnhancedTopics(
  topic: string,
  journeyContext: string = "",
  count: number = 3,
  usedTopics: string[] = []
): Promise<Array<{ title: string; description: string; richContent?: any }>> {
  console.log(
    "Generating enhanced topics for:",
    topic,
    "with context:",
    journeyContext
  );

  try {
    let richContent;

    // Handle random topic generation
    if (topic === "Random diverse topics") {
      // Generate completely random topics without needing rich content
      const randomTopics = [
        "Artificial Intelligence",
        "Climate Change",
        "Space Exploration",
        "Quantum Physics",
        "Ancient History",
        "Neuroscience",
        "Renewable Energy",
        "Oceanography",
        "Archaeology",
        "Biotechnology",
        "Robotics",
        "Sustainable Living",
        "Astronomy",
        "Psychology",
        "Philosophy",
        "Cryptocurrency",
        "Virtual Reality",
        "Genetic Engineering",
        "Renewable Energy",
        "Social Media",
        "Machine Learning",
        "Environmental Science",
        "Space Technology",
        "Cognitive Science",
        "Ethics",
        "Blockchain",
        "Augmented Reality",
        "Bioinformatics",
        "Clean Energy",
        "Digital Culture",
        "Deep Learning",
        "Conservation",
        "Planetary Science",
        "Behavioral Science",
        "Political Science",
        "Fintech",
        "Mixed Reality",
        "Synthetic Biology",
        "Green Technology",
        "Media Studies",
      ];

      // Shuffle and pick 5 random topics
      const shuffled = randomTopics.sort(() => 0.5 - Math.random());
      const selectedTopics = shuffled.slice(0, 5);

      const response = await enhancedTopicGeneratorAgent.generate(
        `Generate exactly ${count} absolutely CAPTIVATING and INTRIGUING topics that are so fascinating people can't help but click on them. These should be the most compelling, mysterious, and mind-blowing topics from across all fields of human knowledge.

        Here are some example topics to inspire diversity: ${selectedTopics.join(
          ", "
        )}
        
        IMPORTANT: Avoid these already used topics: ${usedTopics.join(", ")}
        
        Generate topics that are:
        1. ABSOLUTELY CAPTIVATING - so intriguing you can't resist exploring them
        2. MYSTERIOUS and FASCINATING - topics that spark curiosity and wonder
        3. MIND-BLOWING - concepts that challenge understanding or reveal hidden truths
        4. DIVERSE across fields - mix science, arts, humanities, nature, culture, etc.
        5. Have concise titles (2-4 words max) that sound intriguing
        6. Have descriptions that hint at deeper mysteries and fascinating discoveries
        7. NOT already used in the graph
        8. Cover different domains: cutting-edge science, ancient mysteries, artistic breakthroughs, etc.
        
        Examples of CAPTIVATING topics:
        - "Consciousness Mystery", "Time Dilation", "Lost Civilizations", "Quantum Entanglement", "Digital Immortality"
        - "Neural Networks", "Ancient Aliens", "Parallel Universes", "Memory Palace", "Dark Matter"
        - "Synesthesia", "Time Travel", "Collective Unconscious", "Black Holes", "Digital Consciousness"
        
        Think of topics that make people go "WOW, I need to know more about this!" 
        Focus on mysteries, breakthroughs, paradoxes, and mind-bending concepts that are genuinely fascinating!`,
        {
          structuredOutput: {
            schema: z.object({
              topics: z.array(
                z.object({
                  title: z
                    .string()
                    .describe(
                      "CAPTIVATING topic title - maximum 4 words, intriguing and mysterious (e.g., 'Consciousness Mystery', 'Time Dilation', 'Lost Civilizations')"
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
        throw new Error("Invalid response format from AI");
      }

      return response.object.topics.map((topic) => ({
        ...topic,
        richContent: null, // No rich content for random topics
      }));
    }

    // First, get rich content about the current topic
    const contentResult = await contentScraperTool.execute({
      context: { topic },
    });

    if (!contentResult.success || !contentResult.content) {
      throw new Error("Failed to get rich content for topic");
    }

    richContent = contentResult.content;

    // Generate related topics using the FULL Wikipedia article content
    const fullArticleContent = richContent.fullContent || richContent.overview;

    const response = await enhancedTopicGeneratorAgent.generate(
      `Based on this COMPLETE WIKIPEDIA ARTICLE about "${topic}":
      
      FULL ARTICLE CONTENT:
      ${fullArticleContent}
      
      KEY CONCEPTS: ${richContent.keyConcepts.join(", ")}
      
      ${journeyContext}
      
      IMPORTANT: Avoid these already used topics: ${usedTopics.join(", ")}
      
      Generate exactly ${count} absolutely CAPTIVATING related topics that are:
      1. DIRECTLY connected to the real content above
      2. Based on actual information, not generic suggestions
      3. Offer distinct exploration paths into fascinating territory
      4. Lead to mind-blowing, mysterious rabbit holes
      5. Build on the user's exploration journey
      6. NOT already used in the graph
      7. SO INTRIGUING people can't resist clicking on them
      
      IMPORTANT: Use the real content to generate topics that are:
      - CAPTIVATING and MYSTERIOUS - focus on the most fascinating aspects
      - Based on actual concepts mentioned in the content
      - Connected to real applications or research areas that are mind-blowing
      - Substantive and meaningful but also INTRIGUING
      - Unique and not already explored
      - Focus on mysteries, breakthroughs, paradoxes, and mind-bending concepts
      
      CRITICAL: Each topic title must be CONCISE and INTRIGUING:
      - Maximum 4 words
      - No unnecessary words
      - Focus on the most FASCINATING aspect
      - Examples: "Consciousness Mystery", "Time Dilation", "Lost Civilizations", "Quantum Entanglement"
      
      DESCRIPTION REQUIREMENTS:
      - Explain WHAT the topic is - just the facts about the concept
      - Be factual and informative
      - No guidance language like "worth exploring" or "fascinating to investigate"
      - Just explain the concept itself, not why it's interesting
      
      Examples of good descriptions:
      - "Consciousness Mystery": "The study of how subjective experience emerges from physical brain processes"
      - "Time Dilation": "The phenomenon where time passes differently for observers in different reference frames"
      - "Lost Civilizations": "Ancient societies that disappeared from historical records, leaving behind archaeological evidence"
      
      Examples of bad descriptions (too guiding):
      - "The profound puzzle that makes people want to explore further"
      - "Einstein's mind-bending discovery that challenges understanding"
      - "Ancient societies that vanished mysteriously and spark curiosity"
      
      Each topic should be specific enough to be engaging but broad enough to explore further.`,
      {
        structuredOutput: {
          schema: z.object({
            topics: z.array(
              z.object({
                title: z
                  .string()
                  .describe(
                    "CAPTIVATING topic title - maximum 4 words, intriguing and mysterious (e.g., 'Consciousness Mystery', 'Time Dilation', 'Lost Civilizations')"
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
