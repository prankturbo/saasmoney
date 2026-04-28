import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  void request;

  return NextResponse.json(
    { error: "Chat feature temporarily disabled" },
    { status: 503 }
  );
}
