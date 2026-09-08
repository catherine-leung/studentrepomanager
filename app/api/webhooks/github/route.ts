// app/api/webhooks/github/route.ts

import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createOrganization } from "@/lib/db";
import { getInstallationOctokit } from "@/lib/github-app";

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

/**
 * Configure organization settings for security and app
 * functionality. Called automatically when the app is
 * installed on an org.
 */
async function configureOrgSettings(
  installationId: number,
  orgName: string
): Promise<void> {
  try {
    console.log(
      `[configureOrgSettings] Starting for ${orgName} ` +
      `(installationId: ${installationId})`
    );

    const octokit = await getInstallationOctokit(
      installationId
    );

    console.log(
      `[configureOrgSettings] Got octokit, making PATCH request`
    );

    await octokit.request("PATCH /orgs/{org}", {
      org: orgName,
      // Base permissions: students only see repos they're granted
      default_repository_permission: "none",
      // Disable repo creation by members
      members_can_create_repositories: false,
      // Disable public repo creation
      members_can_create_public_repositories: false,
      // Disable private repo creation
      members_can_create_private_repositories: false,
      // Disable repo visibility changes
      members_can_change_repo_visibility: false,
      // Disable repo deletion
      members_can_delete_repositories: false,
      // Disable repo transfer
      members_can_transfer_repositories: false,
      // Disable team creation
      members_can_create_teams: false,

    });

    console.log(
      `[configureOrgSettings] Successfully configured ` +
      `org settings for ${orgName}`
    );
  } catch (error) {
    console.error(
      `[configureOrgSettings] Failed to configure ` +
      `org settings for ${orgName}:`,
      error
    );
    // Don't throw — installation should succeed even if
    // this fails. The professor can fix it manually.
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log("[webhook] ===== WEBHOOK POST CALLED =====");

    // 1. Get the raw body (required for signature verification)
    const body = await req.text();
    console.log("[webhook] Body received, length:", body.length);

    // 2. Get the signature header
    const signature =
      req.headers.get("x-hub-signature-256") || "";
    console.log("[webhook] Signature header present:", !!signature);

    // 3. Verify the signature
    if (!verifyWebhookSignature(body, signature)) {
      console.warn(
        "[webhook] Webhook signature verification failed; " +
        "rejecting request"
      );
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    console.log("[webhook] Signature verified");

    // 4. Parse the body
    let payload;
    try {
      payload = JSON.parse(body);
      console.log("[webhook] Payload parsed successfully");
    } catch {
      console.error("[webhook] Failed to parse JSON");
      return NextResponse.json(
        { error: "Invalid JSON" },
        { status: 400 }
      );
    }

    // 5. Get the event type
    const event = req.headers.get("x-github-event");
    console.log("[webhook] Event type:", event);
    console.log("[webhook] Event action:", payload.action);

    // 6. Handle installation events
    if (event === "installation") {
      console.log("=== INSTALLATION EVENT ===");
      console.log("Payload action:", payload.action);
      console.log("Installation:", payload.installation);
      console.log("Account:", payload.installation?.account);

      const action = payload.action;
      const installation = payload.installation;
      const account = payload.installation?.account;

      console.log("Action:", action);
      console.log("Installation ID:", installation?.id);
      console.log("Account login:", account?.login);
      console.log("Account type:", account?.type);

      if (!installation || !account) {
        console.log(
          "EARLY RETURN: Missing installation or account"
        );
        return NextResponse.json({ ok: true });
      }

      const installationId = installation.id;
      const accountLogin = account.login;
      const accountType = account.type;

      console.log("Proceeding with:", {
        installationId,
        accountLogin,
        accountType,
      });

      // Only handle organization installations
      if (accountType !== "Organization") {
        console.log(
          `SKIPPING: Not an organization (type: ${accountType})`
        );
        return NextResponse.json({ ok: true });
      }

      if (action === "created") {
        console.log(
          `App installed on organization: ${accountLogin}`
        );

        try {
          // 1. Record the org in the database
          console.log("Creating organization in DB...");
          await createOrganization(accountLogin, installationId);
          console.log("Organization created in DB");

          // 2. Configure org settings for security
          console.log("Configuring organization settings...");
          await configureOrgSettings(
            installationId,
            accountLogin
          );
          console.log("Organization settings configured");

          return NextResponse.json({
            ok: true,
            message: `Installed on ${accountLogin}`,
          });
        } catch (err) {
          console.error(
            "ERROR in installation.created handler:",
            err
          );
          throw err;
        }
      }

      if (action === "deleted") {
        console.log(
          `App uninstalled from organization: ${accountLogin}`
        );
        return NextResponse.json({
          ok: true,
          message: `Uninstalled from ${accountLogin}`,
        });
      }

      if (action === "suspended") {
        console.log(
          `App suspended on organization: ${accountLogin}`
        );
        return NextResponse.json({
          ok: true,
          message: `Suspended on ${accountLogin}`,
        });
      }

      if (action === "unsuspended") {
        console.log(
          `App unsuspended on organization: ${accountLogin}`
        );
        return NextResponse.json({
          ok: true,
          message: `Unsuspended on ${accountLogin}`,
        });
      }

      console.log("Action not recognized:", action);
    }

    // 7. Ignore other events
    console.log("[webhook] Ignoring event type:", event);
    return NextResponse.json({
      ok: true,
      event,
    });
  } catch (error) {
    console.error("[webhook] Unhandled error:", error);

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
