import { NextResponse } from "next/server";
import { enhancePrompt } from "@/app/lib/ai-service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = body.prompt as string;

    const improvedPrompt = await enhancePrompt(prompt);

    return NextResponse.json({
      success: true,
      prompt: improvedPrompt,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Prompt enhancement failed",
      },
      {
        status: 500,
      }
    );
  }
}
