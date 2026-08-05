import { NextResponse } from "next/server";
import { generateText } from "@/app/lib/ai-service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const topic = body.topic as string;

    if (!topic) {
      return NextResponse.json(
        {
          success: false,
          message: "Topic is required",
        },
        { status: 400 }
      );
    }

    const script = await generateText({
      systemPrompt: "You are a professional content writer for short-form videos. Write engaging scripts that are 30-60 seconds long. Include a hook in the first 3 seconds.",
      userPrompt: `Write a viral short video script about: ${topic}`,
    });

    return NextResponse.json({
      success: true,
      script,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Script generation failed",
      },
      {
        status: 500,
      }
    );
  }
}
