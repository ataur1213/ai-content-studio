import { NextResponse } from "next/server";
import { imageHistory, voiceHistory, videoHistory } from "@/app/lib/history";

export async function GET() {
  return NextResponse.json({
    success: true,
    history: {
      images: imageHistory.getAll(),
      voices: voiceHistory.getAll(),
      videos: videoHistory.getAll(),
    },
  });
}
