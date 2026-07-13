import { NextRequest, NextResponse } from "next/server";
import { generateVoice } from "@/app/lib/voice-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      text,
      language = "en",
      voice = "female",
      speed = 1,
      pitch = 1,
    } = body;

    if (!text || text.trim() === "") {
      return NextResponse.json(
        {
          success: false,
          message: "Text is required.",
        },
        {
          status: 400,
        }
      );
    }

    const result = await generateVoice({
      text,
      language,
      voice,
      speed,
      pitch,
    });

    return new Response(result.audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": 'inline; filename="voice.mp3"',
        "Cache-Control": "no-store",
        "Content-Length": String(result.audio.byteLength),
        "X-Provider": result.provider,
      },
    });
  } catch (error: any) {
    console.error("VOICE API ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Voice generation failed.",
      },
      {
        status: 500,
      }
    );
  }
}