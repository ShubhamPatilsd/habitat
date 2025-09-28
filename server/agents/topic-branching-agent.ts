import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";

// Tool 1: Search for Wikipedia articles
const wikipediaSearchTool = createTool({
  id: "wikipedia-search",
  description: "Search for Wikipedia articles by topic",
  inputSchema: z.object({
    query: z.string().describe("The search query for Wikipedia articles"),
  }),
  execute: async ({ context }) => {
    const { query } = context;
    console.log(`🚀 TOOL EXECUTING: wikipedia-search with query: "${query}"`);

    try {
      const searchUrl = `https://en.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(
        query.toLowerCase()
      )}&limit=5`;
      console.log(`🔍 Searching Wikipedia for: ${query}`);
      console.log(`🔗 Full URL: ${searchUrl}`);

      const response = await fetch(searchUrl, {
        headers: {
          "User-Agent":
            "Habitat-Knowledge-Graph/1.0 (https://github.com/your-repo)",
        },
      });

      // Log response details regardless of status
      console.log(`📊 Response status: ${response.status}`);
      console.log(
        `📊 Response headers:`,
        Object.fromEntries(response.headers.entries())
      );

      // Try to get response body even on errors
      let responseText = "";
      try {
        responseText = await response.text();
        console.log(`📊 Response body:`, responseText);
      } catch (e) {
        console.log(`📊 Could not read response body:`, e.message);
      }

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limited - wait longer and retry
          console.log(`⏳ Rate limited, waiting 10 seconds...`);
          await new Promise((resolve) => setTimeout(resolve, 10000));
          const retryResponse = await fetch(searchUrl, {
            headers: {
              "User-Agent":
                "Habitat-Knowledge-Graph/1.0 (https://github.com/your-repo)",
            },
          });
          if (!retryResponse.ok) {
            if (retryResponse.status === 429) {
              // Still rate limited - wait even longer
              console.log(`⏳ Still rate limited, waiting 20 seconds...`);
              await new Promise((resolve) => setTimeout(resolve, 20000));
              const finalResponse = await fetch(searchUrl, {
                headers: {
                  "User-Agent":
                    "Habitat-Knowledge-Graph/1.0 (https://github.com/your-repo)",
                },
              });
              if (!finalResponse.ok) {
                if (finalResponse.status === 429) {
                  // Final attempt with even longer wait
                  console.log(
                    `⏳ Final rate limit attempt, waiting 30 seconds...`
                  );
                  await new Promise((resolve) => setTimeout(resolve, 30000));
                  const lastResponse = await fetch(searchUrl, {
                    headers: {
                      "User-Agent":
                        "Habitat-Knowledge-Graph/1.0 (https://github.com/your-repo)",
                    },
                  });
                  if (!lastResponse.ok) {
                    throw new Error(
                      `Wikipedia search failed after all retries: ${lastResponse.status}`
                    );
                  }
                  const lastData = await lastResponse.json();
                  return { success: true, articles: lastData.pages || [] };
                }
                throw new Error(
                  `Wikipedia search failed after retries: ${finalResponse.status}`
                );
              }
              const finalData = await finalResponse.json();
              return { success: true, articles: finalData.pages || [] };
            }
            throw new Error(`Wikipedia search failed: ${retryResponse.status}`);
          }
          const retryData = await retryResponse.json();
          return { success: true, articles: retryData.pages || [] };
        }
        throw new Error(`Wikipedia search failed: ${response.status}`);
      }

      // Parse the response text as JSON
      let data;
      try {
        data = JSON.parse(responseText);
        console.log(
          `✅ Found ${data.pages?.length || 0} articles for: ${query}`
        );
        console.log(
          `📋 Wikipedia API Response:`,
          JSON.stringify(data, null, 2)
        );
      } catch (e) {
        console.log(`❌ Failed to parse JSON:`, e.message);
        throw new Error(`Invalid JSON response: ${responseText}`);
      }

      return {
        success: true,
        articles: data.pages || [],
      };
    } catch (error) {
      console.error(`❌ Wikipedia search error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        articles: [],
      };
    }
  },
});

// Tool 2: Get full article content
const wikipediaContentTool = createTool({
  id: "wikipedia-content",
  description: "Get the full content of a Wikipedia article by page ID",
  inputSchema: z.object({
    pageId: z.number().describe("The Wikipedia page ID"),
    title: z.string().describe("The article title for context"),
  }),
  execute: async ({ context }) => {
    const { pageId, title } = context;
    console.log(
      `🚀 TOOL EXECUTING: wikipedia-content with pageId: ${pageId}, title: "${title}"`
    );

    try {
      const parseUrl = `https://en.wikipedia.org/w/api.php?action=parse&pageid=${pageId}&prop=wikitext&format=json`;
      console.log(`📖 Getting full content for: ${title} (ID: ${pageId})`);
      console.log(`🔗 Full URL: ${parseUrl}`);

      const response = await fetch(parseUrl, {
        headers: {
          "User-Agent":
            "Habitat-Knowledge-Graph/1.0 (https://github.com/your-repo)",
        },
      });

      if (!response.ok) {
        throw new Error(`Wikipedia parse failed: ${response.status}`);
      }

      const data = await response.json();
      console.log(
        `📖 Wikipedia Parse API Response:`,
        JSON.stringify(data, null, 2)
      );

      const wikitext = data.parse?.wikitext?.["*"];

      if (!wikitext) {
        throw new Error(`No content found for: ${title}`);
      }

      // Clean the wikitext
      const cleanContent = cleanWikitext(wikitext);
      console.log(
        `✅ Got ${cleanContent.length} characters of content for: ${title}`
      );
      console.log(
        `📝 First 500 chars of clean content:`,
        cleanContent.substring(0, 500)
      );

      return {
        success: true,
        content: cleanContent,
        title: title,
        pageId: pageId,
      };
    } catch (error) {
      console.error(`❌ Wikipedia content error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        content: null,
      };
    }
  },
});

// Clean Wikipedia wikitext markup
function cleanWikitext(wikitext: string): string {
  return (
    wikitext
      // Remove wiki markup
      .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2") // [[Link|Text]] → Text
      .replace(/\[\[([^\]]+)\]\]/g, "$1") // [[Link]] → Link
      .replace(/'''([^']+)'''/g, "$1") // '''Bold''' → Bold
      .replace(/''([^']+)''/g, "$1") // ''Italic'' → Italic
      .replace(/<ref[^>]*>.*?<\/ref>/g, "") // Remove references
      .replace(/<ref[^>]*\/>/g, "") // Remove self-closing references
      .replace(/{{[^}]+}}/g, "") // Remove templates
      .replace(/={2,6}\s*([^=]+)\s*={2,6}/g, "$1") // Remove headers
      .replace(/^\*+\s*/gm, "") // Remove bullet points
      .replace(/^#+\s*/gm, "") // Remove numbered lists
      .replace(/^\|\s*/gm, "") // Remove table markup
      .replace(/\n{3,}/g, "\n\n") // Collapse multiple newlines
      .replace(/^\s+|\s+$/g, "") // Trim whitespace
      .substring(0, 8000) // Limit to 8000 chars for AI processing
  );
}

// Create the topic branching agent
export const topicBranchingAgent = new Agent({
  name: "Topic Branching Agent",
  instructions: `You are a topic branching agent that creates 5 related topics from a given topic.

Your process:
1. Search for Wikipedia articles related to the given topic (ONLY ONE SEARCH)
2. Get the full content of the most relevant article (ONLY ONE ARTICLE)
3. Generate 5 captivating, related topics based on that single article content

CRITICAL: Only make ONE search call and ONE content call. Do not search multiple times.

Each topic should be:
- CAPTIVATING and intriguing (2-4 words max)
- Based on real information from the Wikipedia article
- Offer distinct exploration paths
- Have clear, factual descriptions
- Be specific enough to be compelling

Examples of good topics: "Consciousness Mystery", "Time Dilation", "Lost Civilizations", "Quantum Entanglement", "Digital Immortality"

Focus on creating topics that make people go "WOW, I need to know more about this!"`,
  model: openai("gpt-4o-mini"),
  tools: { wikipediaSearchTool, wikipediaContentTool },
});

// Main function to generate 5 topics from a given topic
export async function generateTopicBranches(
  topic: string,
  usedTopics: string[] = []
): Promise<Array<{ title: string; description: string }>> {
  console.log(`🌳 Generating topic branches for: "${topic}"`);

  // Handle special case for initial random topic generation
  if (topic === "Random diverse topics") {
    console.log(`🎲 Generating AI-powered random diverse starting topics...`);

    const exampleTopics = [
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

    // Shuffle and pick 5 random example topics
    const shuffled = exampleTopics.sort(() => 0.5 - Math.random());
    const selectedExamples = shuffled.slice(0, 5);

    const response = await topicBranchingAgent.generate(
      `Generate exactly 5 absolutely CAPTIVATING and INTRIGUING topics that are so fascinating people can't help but click on them. These should be the most compelling, mysterious, and mind-blowing topics from across all fields of human knowledge.

      Here are some example topics to inspire diversity: ${selectedExamples.join(
        ", "
      )}
      
      IMPORTANT: Avoid these already used topics: ${usedTopics.join(", ")}
      
      Generate topics that are:
      1. ABSOLUTELY CAPTIVATING - so intriguing you can't resist exploring them
      2. MYSTERIOUS and FASCINATING - topics that spark curiosity and wonder
      3. MIND-BLOWING - concepts that challenge understanding or reveal hidden truths
      4. DIVERSE across fields - mix science, arts, humanities, nature, culture, etc.
      5. Have concise titles (2-4 words max) that sound intriguing
      6. Have purely informative descriptions that explain what the topic is
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
            topics: z
              .array(
                z.object({
                  title: z
                    .string()
                    .describe(
                      "CAPTIVATING topic title - maximum 4 words, intriguing and mysterious (e.g., 'Consciousness Mystery', 'Time Dilation', 'Lost Civilizations')"
                    ),
                  description: z
                    .string()
                    .describe(
                      "Purely informative description that explains what this topic is - just the facts, no persuasive language"
                    ),
                })
              )
              .length(5),
          }),
        },
      }
    );

    if (response?.object?.topics) {
      console.log(
        `✅ Generated ${response.object.topics.length} AI-powered random starting topics`
      );
      return response.object.topics;
    }

    // Fallback if AI fails
    const fallbackTopics = [
      {
        title: "Consciousness Mystery",
        description:
          "The study of how subjective experience emerges from physical brain processes",
      },
      {
        title: "Time Dilation",
        description:
          "The phenomenon where time passes differently for observers in different reference frames",
      },
      {
        title: "Lost Civilizations",
        description:
          "Ancient societies that disappeared from historical records, leaving behind archaeological evidence",
      },
      {
        title: "Quantum Entanglement",
        description:
          "The quantum mechanical phenomenon where particles become interconnected regardless of distance",
      },
      {
        title: "Digital Immortality",
        description:
          "The concept of preserving human consciousness or identity in digital form",
      },
    ];

    console.log(`✅ Using fallback random starting topics`);
    return fallbackTopics;
  }

  try {
    const response = await topicBranchingAgent.generate(
      `Generate 5 captivating topics related to "${topic}".

IMPORTANT: Avoid these already used topics: ${usedTopics.join(", ")}

CRITICAL INSTRUCTIONS:
1. Use wikipedia-search tool ONCE with the exact topic: "${topic}"
2. Use wikipedia-content tool ONCE with the first result from the search
3. Generate 5 topics based on that single article content
4. DO NOT make multiple searches or content calls

Each topic should be:
1. CAPTIVATING and intriguing (2-4 words max)
2. Based on real Wikipedia content from the single article
3. Offer distinct exploration paths
4. Have purely informative descriptions that explain what the topic is
5. NOT already used in the graph

Start by searching for: "${topic}"`,
      {
        structuredOutput: {
          schema: z.object({
            topics: z
              .array(
                z.object({
                  title: z
                    .string()
                    .describe(
                      "CAPTIVATING topic title - maximum 4 words, intriguing and mysterious"
                    ),
                  description: z
                    .string()
                    .describe(
                      "Purely informative description that explains what this topic is - just the facts, no persuasive language"
                    ),
                })
              )
              .length(5),
          }),
        },
      }
    );

    if (response?.object?.topics) {
      console.log(
        `✅ Generated ${response.object.topics.length} topics for: "${topic}"`
      );
      return response.object.topics;
    }

    throw new Error("No topics generated");
  } catch (error) {
    console.error(`❌ Error generating topic branches:`, error);

    // Fallback topics if everything fails
    const fallbackTopics = [
      {
        title: "Research",
        description: "The systematic investigation of this subject",
      },
      {
        title: "Applications",
        description: "Practical uses and implementations",
      },
      {
        title: "History",
        description: "The chronological development of this field",
      },
      {
        title: "Future",
        description: "Upcoming trends and potential developments",
      },
      {
        title: "Theory",
        description: "The fundamental principles underlying this concept",
      },
    ];

    return fallbackTopics;
  }
}
