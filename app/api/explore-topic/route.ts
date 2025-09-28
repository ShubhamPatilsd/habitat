import { NextRequest, NextResponse } from "next/server";
import {
  generateEnhancedTopics,
  getRichSummary,
} from "../../../server/agents/enhanced-topic-generator";

export async function POST(request: NextRequest) {
  console.log("Received topic exploration request");
  try {
    const { topic, journey = [], count = 3 } = await request.json();
    console.log("Processing topic:", topic, "with journey:", journey);

    if (!topic) {
      console.error("No topic provided in request");
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    // Build context from journey
    const journeyContext =
      journey.length > 0
        ? `\n\nUser's exploration journey so far: ${journey.join(" → ")}`
        : "";

    const topicsWithDescriptions = await generateEnhancedTopics(
      topic,
      journeyContext,
      count
    );

    return NextResponse.json({
      success: true,
      topics: topicsWithDescriptions, // Return full objects with title, description, and rich content
    });
  } catch (error) {
    console.error("Error generating topics:", error);
    console.error(
      "Error details:",
      error instanceof Error ? error.message : "Unknown error"
    );
    console.error(
      "Stack trace:",
      error instanceof Error ? error.stack : "No stack trace"
    );
    return NextResponse.json(
      { error: "Failed to generate topics" },
      { status: 500 }
    );
  }
}
