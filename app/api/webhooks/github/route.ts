// app/api/webhooks/github/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: "Webhook endpoint (GET)",
    status: "ok",
  });
}

export async function POST(request: NextRequest) {
  return NextResponse.json({
    message: "Webhook endpoint (POST)",
    status: "received",
  });
}
