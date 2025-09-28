import { NextRequest, NextResponse } from "next/server";
import { getRichSummary } from "../../../server/agents/enhanced-topic-generator";

export async function POST(request: NextRequest) {
  console.log("Received summary request");
  try {
    const { topic } = await request.json();
    console.log("Getting summary for topic:", topic);

    if (!topic) {
      console.error("No topic provided in request");
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    const summary = await getRichSummary(topic);

    return NextResponse.json({
      success: true,
      summary: summary,
    });
  } catch (error) {
    console.error("Error getting summary:", error);
    console.error(
      "Error details:",
      error instanceof Error ? error.message : "Unknown error"
    );
    console.error(
      "Stack trace:",
      error instanceof Error ? error.stack : "No stack trace"
    );
    return NextResponse.json(
      { error: "Failed to get summary" },
      { status: 500 }
    );
  }
}
