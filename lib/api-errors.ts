// lib/api-errors.ts

import { NextResponse } from "next/server";

/**
 * Return a generic 500 error response without leaking
 * internal details.
 *
 * @param context Where the error occurred (e.g., "POST /api/redeem/[linkId]")
 * @param error The caught error
 * @param publicMessage Safe message to return to client
 * @returns NextResponse with 500 status
 */
export function internalError(
  context: string,
  error: unknown,
  publicMessage = "An unexpected error occurred"
): NextResponse {
  console.error(`[${context}]`, error);
  return NextResponse.json(
    { error: publicMessage },
    { status: 500 }
  );
}
