import { NextResponse } from "next/server";
import { generateImage } from "@/app/lib/image-service";
import { imageHistory } from "@/app/lib/history";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json(
        {
          success: false,
          message: "Prompt is required",
        },
        { status: 400 }
      );
    }

    const image = await generateImage(prompt);

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
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Image generation failed",
      },
      { status: 500 }
    );
  }
}