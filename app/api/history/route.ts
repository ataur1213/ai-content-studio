import { NextResponse } from "next/server";
import { imageHistory } from "@/app/lib/history";

export async function GET() {
  return NextResponse.json({
    success: true,
    history: imageHistory.getAll(),
  });
}