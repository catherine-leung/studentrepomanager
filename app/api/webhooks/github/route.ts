// app/api/webhooks/github/route.ts

import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createOrganization, deactivateLinksForOrg } from "@/lib/db";
import { applyOrgSecuritySettings } from "@/lib/org-settings";
import { isEmuLogin } from "@/lib/emu";
import { internalError } from "@/lib/api-errors";

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
        "[webhook] Signature verification failed; " +
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
      console.error("[webhook] Failed to parse JSON");
      return NextResponse.json(
        { error: "Invalid JSON" },
        { status: 400 }
      );
    }

    // 5. Get the event type
    const event = req.headers.get("x-github-event");
    const action = payload.action;

    // 6. Handle installation events
    if (event === "installation") {
      const installation = payload.installation;
      const account = payload.installation?.account;

      if (!installation || !account) {
        console.log(
          "[webhook] Skipping installation event: " +
          "missing installation or account"
        );
        return NextResponse.json({ ok: true });
      }

      const installationId = installation.id;
      const accountLogin = account.login;
      const accountType = account.type;

      // Only handle organization installations
      if (accountType !== "Organization") {
        console.log(
          `[webhook] Skipping non-org installation ` +
          `(type: ${accountType})`
        );
        return NextResponse.json({ ok: true });
      }

      if (action === "created") {
        console.log(
          `[webhook] App installed on org: ${accountLogin}`
        );

        try {
          // 1. Record the org in the database.
          //
          // `sender` is whoever clicked "Install" on GitHub --
          // if their own login is EMU-shaped, every member of
          // this org must be too (see lib/emu.ts). This is a
          // best-effort guess at install time; it's re-derived
          // and corrected the next time an owner opens the
          // dashboard, via /api/orgs/installed.
          const installerLogin: string | undefined =
            payload.sender?.login;

          await createOrganization(
            accountLogin,
            installationId,
            installerLogin
              ? isEmuLogin(installerLogin)
              : false
          );

          // 2. Apply org security settings
          await applyOrgSecuritySettings(
            installationId,
            accountLogin
          );

          return NextResponse.json({
            ok: true,
            message: `Installed on ${accountLogin}`,
          });
        } catch (err) {
          console.error(
            `[webhook] Error in installation.created:`,
            err
          );
          throw err;
        }
      }

      if (action === "deleted") {
        console.log(
          `[webhook] App uninstalled from org: ${accountLogin}`
        );

        try {
          // NEW: Deactivate all links for this org so students
          // don't get 500s when trying to redeem with a stale
          // installation ID.
          await deactivateLinksForOrg(accountLogin);

          return NextResponse.json({
            ok: true,
            message: `Uninstalled from ${accountLogin}; ` +
              `links deactivated`,
          });
        } catch (err) {
          console.error(
            `[webhook] Error in installation.deleted:`,
            err
          );
          throw err;
        }
      }

      if (action === "suspended") {
        console.log(
          `[webhook] App suspended on org: ${accountLogin}`
        );
        return NextResponse.json({
          ok: true,
          message: `Suspended on ${accountLogin}`,
        });
      }

      if (action === "unsuspended") {
        console.log(
          `[webhook] App unsuspended on org: ${accountLogin}`
        );
        return NextResponse.json({
          ok: true,
          message: `Unsuspended on ${accountLogin}`,
        });
      }

      console.log(
        `[webhook] Unrecognized installation action: ${action}`
      );
    }

    // 7. Ignore other events
    console.log(`[webhook] Ignoring event: ${event}`);
    return NextResponse.json({
      ok: true,
      event,
    });
  } catch (error) {
    return internalError(
      "POST /api/webhooks/github",
      error,
      "Webhook processing failed"
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Webhook endpoint (GET not supported)",
    status: "ok",
  });
}
