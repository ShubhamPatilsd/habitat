import { NextRequest, NextResponse } from "next/server";
import { generateEnhancedTopics } from "../../../server/agents/enhanced-topic-generator";

export async function POST(request: NextRequest) {
  console.log("🔄 Preloading topics for:", request.url);

  try {
    const { topic, usedTopics = [] } = await request.json();

    if (!topic) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    console.log(`🚀 Preloading topics for: "${topic}"`);

    // Generate topics in the background
    const topicsWithDescriptions = await generateEnhancedTopics(
      topic,
      "", // No journey context for preloading
      5, // Always 5 topics
      usedTopics
    );

    console.log(
      `✅ Preloaded ${topicsWithDescriptions.length} topics for: "${topic}"`
    );

    return NextResponse.json({
      success: true,
      topic,
      topics: topicsWithDescriptions,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("❌ Error preloading topics:", error);
    return NextResponse.json(
      { error: "Failed to preload topics" },
      { status: 500 }
    );
  }
}
