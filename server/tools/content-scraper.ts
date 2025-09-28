import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";

export const contentScraperTool = createTool({
  id: "content-scraper",
  description: "Scrapes and summarizes rich content about a given topic",
  inputSchema: z.object({
    topic: z.string().describe("The topic to scrape content for"),
  }),
  execute: async ({ context }) => {
    const topic = context.topic;
    console.log(`🔄 Scraping content for: ${topic}`);

    try {
      // Get rich content using the PROPER Wikipedia full-text search
      const richContent = await generateRichContent(topic);

      // Extract key concepts using AI
      const keyConcepts = await extractKeyConcepts(richContent.overview, topic);

      return {
        success: true,
        content: {
          ...richContent,
          keyConcepts: keyConcepts,
        },
        sources: [
          `https://en.wikipedia.org/wiki/${topic.replace(/\s+/g, "_")}`,
        ],
      };
    } catch (error) {
      console.error("❌ Error scraping content:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        content: null,
      };
    }
  },
});

// PROPER Wikipedia scraping using FULL-TEXT SEARCH - NO MORE SLOP
async function generateRichContent(topic: string) {
  console.log(`🔄 Wikipedia full-text search for: ${topic}`);

  try {
    // Use Wikipedia REST API (the NEW and CLEAN one)
    const restSearchUrl = `https://en.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(
      topic
    )}&limit=5`;

    console.log(`📚 REST search URL: ${restSearchUrl}`);
    const searchResponse = await fetch(restSearchUrl);

    if (!searchResponse.ok) {
      throw new Error(`REST search API failed: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    const searchResults = searchData.pages;

    if (!searchResults || searchResults.length === 0) {
      throw new Error(`No search results found for: ${topic}`);
    }

    // Find the best match (first result is usually the most relevant)
    const bestMatch = searchResults[0];
    console.log(`🎯 Found best match: "${bestMatch.title}" for "${topic}"`);
    console.log(`📝 Excerpt: ${bestMatch.excerpt}`);
    console.log(`📄 Description: ${bestMatch.description}`);

    // Get the FULL article content using parse API
    const pageId = bestMatch.id;
    const parseUrl = `https://en.wikipedia.org/w/api.php?action=parse&pageid=${pageId}&prop=wikitext&format=json`;

    console.log(`📖 Getting FULL article content from: ${parseUrl}`);
    const parseResponse = await fetch(parseUrl);

    if (!parseResponse.ok) {
      throw new Error(`Parse API failed: ${parseResponse.status}`);
    }

    const parseData = await parseResponse.json();
    const fullWikitext = parseData.parse?.wikitext?.["*"];

    if (!fullWikitext) {
      throw new Error(`No wikitext found for: ${bestMatch.title}`);
    }

    console.log(
      `✅ Found FULL Wikipedia article for: ${bestMatch.title} (${fullWikitext.length} characters)`
    );

    // Clean the wikitext (remove markup, keep content)
    const cleanContent = cleanWikitext(fullWikitext);

    // Extract key concepts using AI from the full article
    const keyConcepts = await extractKeyConcepts(cleanContent, topic);

    return {
      topic,
      overview: cleanContent.substring(0, 500) + "...", // Truncated overview
      fullContent: cleanContent, // Full article content for topic generation
      keyConcepts: keyConcepts,
      applications: [],
      currentResearch: [],
      interestingFacts: [cleanContent.substring(0, 200) + "..."],
      summary: cleanContent.substring(0, 500) + "...",
    };
  } catch (error) {
    console.log(
      `❌ Wikipedia full-text search failed for "${topic}":`,
      error instanceof Error ? error.message : "Unknown error"
    );
    throw new Error(`No Wikipedia content available for: ${topic}`);
  }
}

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
      .substring(0, 8000)
  ); // Limit to 8000 chars for AI processing
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
