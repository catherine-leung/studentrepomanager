// app/api/auth/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: "Auth endpoint placeholder",
    status: "ok",
  });
}
