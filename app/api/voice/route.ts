import { NextRequest, NextResponse } from "next/server";
import { generateVoice } from "@/app/lib/voice-service";
import { voiceHistory } from "@/app/lib/history";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const text = body.text as string;
    const language = (body.language as string) || "en";
    const voice = (body.voice as string) || "female";
    const speed = (body.speed as number) || 1;
    const pitch = (body.pitch as number) || 1;

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

    const audioUrl = `data:audio/mpeg;base64,${Buffer.from(result.audio).toString("base64")}`;

    voiceHistory.add({
      id: Date.now().toString(),
      text,
      audioUrl,
      provider: result.provider,
      createdAt: new Date().toISOString(),
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
  } catch (error) {
    console.error("VOICE API ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Voice generation failed.",
      },
      {
        status: 500,
      }
    );
  }
}
