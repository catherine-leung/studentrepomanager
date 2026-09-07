// app/api/webhooks/github/route.ts

import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

/**
 * Verify GitHub webhook signature.
 *
 * GitHub sends X-Hub-Signature-256 header with HMAC-SHA256
 * of the request body, signed with the webhook secret.
 *
 * @param body Raw request body (as string/buffer)
 * @param signature X-Hub-Signature-256 header value
 * @returns true if signature is valid
 */
function verifyWebhookSignature(
  body: string | Buffer,
  signature: string
): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!secret) {
    console.error(
      "GITHUB_WEBHOOK_SECRET not configured; " +
      "webhook verification disabled"
    );
    return false;
  }

  // GitHub sends "sha256=<hex>"
  if (!signature.startsWith("sha256=")) {
    return false;
  }

  const givenSignature = signature.slice(7); // Remove "sha256=" prefix

  // Compute expected signature
  const expectedSignature = createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  // Use timing-safe comparison to prevent timing attacks
  const givenBuffer = Buffer.from(givenSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (givenBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(givenBuffer, expectedBuffer);
}

export async function POST(req: NextRequest) {
  try {
    // 1. Get the raw body (required for signature verification)
    const body = await req.text();

    // 2. Get the signature header
    const signature =
      req.headers.get("x-hub-signature-256") || "";

    // 3. Verify the signature
    if (!verifyWebhookSignature(body, signature)) {
      console.warn(
        "Webhook signature verification failed; " +
        "rejecting request"
      );
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // 4. Parse the body
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON" },
        { status: 400 }
      );
    }

    // 5. Get the event type
    const event = req.headers.get("x-github-event");

    console.log(`Webhook received: ${event}`, {
      action: payload.action,
      repository: payload.repository?.name,
    });

    // 6. Handle specific events
    // (Add event handlers here as needed)

    switch (event) {
      case "installation":
        // Handle app installation/uninstallation
        // TODO: Invalidate cached installation_id if deleted/suspended
        console.log(
          `Installation event: ${payload.action}`
        );
        break;

      case "repository":
        // Handle repository events
        console.log(
          `Repository event: ${payload.action}`
        );
        break;

      default:
        // Ignore other events
        break;
    }

    return NextResponse.json({
      ok: true,
      event,
    });
  } catch (error) {
    console.error("Webhook error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Webhook endpoint (GET not supported)",
    status: "ok",
  });
}
