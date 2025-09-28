import { NextRequest, NextResponse } from "next/server";
import { generateTopicBranches } from "../../../server/agents/topic-branching-agent";

export async function POST(request: NextRequest) {
  console.log("🌳 Received topic branching request");
  
  try {
    const {
      topic,
      usedTopics = [],
    } = await request.json();

    if (!topic) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    console.log(`🚀 Generating branches for: "${topic}"`);

    // Generate 5 topic branches using the clean agent
    const topics = await generateTopicBranches(topic, usedTopics);

    console.log(`✅ Generated ${topics.length} branches for: "${topic}"`);

    return NextResponse.json({
      success: true,
      topic,
      topics: topics,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("❌ Error generating topic branches:", error);
    return NextResponse.json(
      { error: "Failed to generate topic branches" },
      { status: 500 }
    );
  }
}
