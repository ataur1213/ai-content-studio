import { NextResponse } from "next/server";
import { enhancePrompt } from "@/app/lib/ai-service";

export async function POST(req: Request) {
  try {
    const { topic } = await req.json();

    if (!topic) {
      return NextResponse.json(
        {
          success: false,
          message: "Topic is required",
        },
        { status: 400 }
      );
    }

    const prompt = `
Write a viral short video script about:

${topic}

Requirements:
- Hook in first 3 seconds
- Simple English
- 30-60 seconds
- Strong ending
- Return only the script.
`;

    const script = await enhancePrompt(prompt);

    return NextResponse.json({
      success: true,
      script,
    });
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: error.message || "Script generation failed",
      },
      {
        status: 500,
      }
    );
  }
}