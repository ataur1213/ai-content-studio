import { NextResponse } from "next/server";
import { generateImage } from "@/app/lib/image-service";
import { imageHistory } from "@/app/lib/history";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = body.prompt as string;

    if (!prompt) {
      return NextResponse.json(
        {
          success: false,
          message: "Prompt is required",
        },
        { status: 400 }
      );
    }

    const image = await generateImage({ prompt });

    imageHistory.add({
      id: Date.now().toString(),
      prompt,
      image,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      image,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Image generation failed",
      },
      { status: 500 }
    );
  }
}
