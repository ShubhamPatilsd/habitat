import { NextRequest, NextResponse } from "next/server";
import { generateRelatedTopics } from "../../../server/agents/topic-generator";

export async function POST(request: NextRequest) {
  console.log('Received topic exploration request');
  try {
    const { topic } = await request.json();
    console.log('Processing topic:', topic);

    if (!topic) {
      console.error('No topic provided in request');
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    const topicsWithDescriptions = await generateRelatedTopics(topic);
    const topics = topicsWithDescriptions.map(t => t.title); // Extract just the titles

    return NextResponse.json({
      success: true,
      topics: topics,
    });
  } catch (error) {
    console.error("Error generating topics:", error);
    console.error("Error details:", error instanceof Error ? error.message : 'Unknown error');
    console.error("Stack trace:", error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { error: "Failed to generate topics" },
      { status: 500 }
    );
  }
}
