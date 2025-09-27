import { NextRequest, NextResponse } from "next/server";
import { generateRelatedTopics } from "../../../mastra/agents/topic-generator";

export async function POST(request: NextRequest) {
  try {
    const { topic } = await request.json();

    if (!topic) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    const relatedTopics = await generateRelatedTopics(topic);

    return NextResponse.json({
      success: true,
      topics: relatedTopics,
    });
  } catch (error) {
    console.error("Error generating topics:", error);
    return NextResponse.json(
      { error: "Failed to generate topics" },
      { status: 500 }
    );
  }
}
