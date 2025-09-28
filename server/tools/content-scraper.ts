import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";

export const contentScraperTool = createTool({
  id: "content-scraper",
  description:
    "Scrapes and summarizes real information about topics from the web",
  inputSchema: z.object({
    topic: z.string().describe("The topic to research and summarize"),
  }),
  execute: async ({ context }) => {
    const { topic } = context;
    try {
      console.log(`🔍 Searching for real Wikipedia content about: ${topic}`);

      let realContent = null;
      let sources = [];

      // Step 1: Use Wikipedia OpenSearch API to find the best matching article
      try {
        const searchQuery = encodeURIComponent(topic);
        const openSearchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${searchQuery}&limit=1&namespace=0&format=json`;

        console.log(`📚 Step 1 - OpenSearch API: ${openSearchUrl}`);
        const searchResponse = await fetch(openSearchUrl);

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();

          if (searchData[1] && searchData[1].length > 0) {
            const articleTitle = searchData[1][0];
            const articleUrl = searchData[3][0];

            console.log(`✅ Found Wikipedia article: ${articleTitle}`);

            // Step 2: Get the full article content using the article title
            const articleQuery = encodeURIComponent(articleTitle);
            const articleUrl_api = `https://en.wikipedia.org/api/rest_v1/page/summary/${articleQuery}`;

            console.log(
              `📖 Step 2 - Getting article content: ${articleUrl_api}`
            );
            const articleResponse = await fetch(articleUrl_api);

            if (articleResponse.ok) {
              const articleData = await articleResponse.json();

              if (
                articleData.extract &&
                !articleData.type?.includes("disambiguation")
              ) {
                console.log(
                  `✅ Successfully scraped Wikipedia content for: ${topic}`
                );

                // Extract key concepts from the content using AI
                const extract = articleData.extract;

                // Use AI to extract meaningful concepts from the Wikipedia content
                const keyConcepts = await extractKeyConcepts(extract, topic);

                realContent = {
                  overview: extract,
                  keyConcepts: keyConcepts,
                  applications: [],
                  currentResearch: [],
                  interestingFacts: [extract],
                  summary: extract,
                };
                sources = [articleUrl];
              }
            }
          }
        }
      } catch (wikiError) {
        console.log(
          `❌ Wikipedia scraping failed for ${topic}:`,
          wikiError.message
        );
      }

      // Fallback: Try the old Wikipedia summary API
      if (!realContent) {
        try {
          const wikiQuery = encodeURIComponent(topic);
          const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${wikiQuery}`;

          console.log(`🔄 Fallback - Wikipedia summary API: ${wikiUrl}`);
          const wikiResponse = await fetch(wikiUrl);

          if (wikiResponse.ok) {
            const wikiData = await wikiResponse.json();

            if (
              wikiData.extract &&
              !wikiData.type?.includes("disambiguation")
            ) {
              console.log(`✅ Found Wikipedia fallback content for: ${topic}`);
              realContent = {
                overview: wikiData.extract,
                keyConcepts: [],
                applications: [],
                currentResearch: [],
                interestingFacts: [wikiData.extract],
                summary: wikiData.extract,
              };
              sources = [
                wikiData.content_urls?.desktop?.page ||
                  `https://en.wikipedia.org/wiki/${wikiQuery}`,
              ];
            }
          }
        } catch (fallbackError) {
          console.log(
            `❌ Wikipedia fallback failed for ${topic}:`,
            fallbackError.message
          );
        }
      }

      // Final attempt: Try one more time with different approach
      if (!realContent) {
        console.log(
          `🔄 Final attempt - trying different search approach for: ${topic}`
        );
        try {
          realContent = await generateRichContent(topic);
          sources = [
            `https://en.wikipedia.org/wiki/${topic.replace(/\s+/g, "_")}`,
          ];
        } catch (error) {
          console.log(`❌ Final attempt failed: ${error.message}`);
          return {
            success: false,
            error: `No Wikipedia content found for: ${topic}`,
            content: null,
          };
        }
      }

      console.log(`✅ Successfully scraped REAL content for: ${topic}`);
      return {
        success: true,
        content: realContent,
        sources: sources,
      };
    } catch (error) {
      console.error("❌ Error scraping content:", error);
      return {
        success: false,
        error: "Failed to scrape content",
        content: null,
      };
    }
  },
});

// 100% Real Wikipedia scraping - NO MOCK CONTENT
async function generateRichContent(topic: string) {
  console.log(`🔄 100% Real Wikipedia scraping for: ${topic}`);

  // Try multiple search variations to find Wikipedia content
  const searchVariations = [
    topic,
    topic.replace(/\s+/g, "_"), // Replace spaces with underscores
    topic.toLowerCase(),
    topic.replace(/[^a-zA-Z0-9\s]/g, ""), // Remove special characters
    topic.split(" ")[0], // Just the first word
    topic.split(" ").slice(0, 2).join(" "), // First two words
  ];

  for (const searchTerm of searchVariations) {
    try {
      // Try direct Wikipedia API
      const wikiQuery = encodeURIComponent(searchTerm);
      const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${wikiQuery}`;

      console.log(`📚 Trying Wikipedia API: ${wikiUrl}`);
      const wikiResponse = await fetch(wikiUrl);

      if (wikiResponse.ok) {
        const wikiData = await wikiResponse.json();

        if (wikiData.extract && !wikiData.type?.includes("disambiguation")) {
          console.log(`✅ Found REAL Wikipedia content for: ${searchTerm}`);

          // Extract key concepts using AI
          const keyConcepts = await extractKeyConcepts(wikiData.extract, topic);

          return {
            topic,
            overview: wikiData.extract,
            keyConcepts: keyConcepts,
            applications: [],
            currentResearch: [],
            interestingFacts: [wikiData.extract],
            summary: wikiData.extract,
          };
        }
      }
    } catch (error) {
      console.log(`❌ Wikipedia API failed for ${searchTerm}:`, error.message);
    }
  }

  // If NO Wikipedia content found, return failure
  console.log(`❌ NO Wikipedia content found for: ${topic}`);
  throw new Error(`No Wikipedia content available for: ${topic}`);
}

// Create a Mastra agent for concept extraction
const conceptExtractionAgent = new Agent({
  name: "Concept Extractor",
  instructions: `You are a concept extraction agent. Extract key concepts from Wikipedia content.`,
  model: openai("gpt-4o-mini"),
});

// AI-powered concept extraction function using Mastra
async function extractKeyConcepts(
  wikipediaContent: string,
  topic: string
): Promise<string[]> {
  try {
    console.log(
      `🧠 Extracting key concepts from Wikipedia content for: ${topic}`
    );

    const response = await conceptExtractionAgent.generate(
      `Extract 5 key concepts from this Wikipedia content about "${topic}". Focus on the most important, specific concepts mentioned.

Wikipedia Content:
${wikipediaContent}

Extract 5 key concepts that are:
1. Specific and meaningful (not generic)
2. Directly mentioned in the content
3. Important for understanding the topic
4. Concise (1-3 words each)
5. Different from each other

Return only the concepts, one per line, no explanations.`,
      {
        structuredOutput: {
          schema: z.object({
            concepts: z
              .array(z.string())
              .describe("List of 5 key concepts extracted from the content"),
          }),
        },
      }
    );

    if (response?.object?.concepts) {
      console.log(`✅ Extracted concepts:`, response.object.concepts);
      return response.object.concepts;
    }
  } catch (error) {
    console.log(`❌ AI concept extraction failed:`, error);
  }

  // Fallback: Simple text-based extraction
  console.log(`🔄 Using fallback concept extraction`);
  const sentences = wikipediaContent.split(".").slice(0, 5);
  return sentences
    .map((s) => s.trim())
    .filter((s) => s.length > 20)
    .slice(0, 3);
}
