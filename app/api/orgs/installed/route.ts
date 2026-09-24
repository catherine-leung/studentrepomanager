// app/api/orgs/installed/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/session";
import { createOrganization } from "@/lib/db";
import { isEmuLogin } from "@/lib/emu";
import {
  listAppInstallations,
  getOrgRoleViaInstallation,
} from "@/lib/github-app";
import { internalError } from "@/lib/api-errors";

export const maxDuration = 60;

interface OwnedOrganization {
  login: string;
  id: number;
  installation_id: number;
}

export async function GET(req: NextRequest) {
  try {
    const authContext = await getAuthContext(req);

    if (!authContext) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 1. Where is the App installed? (App JWT, not user token)
    const installations = await listAppInstallations();

    const orgInstallations = installations.filter(
      (inst) => inst.accountType === "Organization"
    );

    // 2. Of those, which does this user own? (installation token)
    const checked = await Promise.all(
      orgInstallations.map(
        async (inst): Promise<OwnedOrganization | null> => {
          try {
            const role = await getOrgRoleViaInstallation(
              inst.installationId,
              inst.accountLogin,
              authContext.login
            );

            if (role !== "owner") {
              return null;
            }

            return {
              login: inst.accountLogin,
              id: inst.accountId,
              installation_id: inst.installationId,
            };
          } catch (error) {
            // Log skipped orgs so the issue is visible
            console.error(
              `Skipping ${inst.accountLogin}: ` +
              `role check failed`,
              error
            );
            return null;
          }
        }
      )
    );

    const organizations = checked.filter(
      (org): org is OwnedOrganization => org !== null
    );

    // 3. Keep installation_id (and EMU status) fresh in the DB.
    //
    // Every member of an Enterprise Managed Users (EMU) org must
    // itself be an EMU account, so checking whether *this*
    // owner's own login is EMU-shaped tells us whether the whole
    // org is EMU-only. That is later compared against each
    // student's login to catch students signed in with the
    // wrong kind of GitHub account. See lib/emu.ts.
    const connectingUserIsEmu = isEmuLogin(authContext.login);

    await Promise.all(
      organizations.map((org) =>
        createOrganization(
          org.login,
          org.installation_id,
          connectingUserIsEmu
        )
      )
    );

    return NextResponse.json(organizations);
  } catch (error) {
    return internalError(
      "GET /api/orgs/installed",
      error,
      "Failed to fetch organizations"
    );
  }
}
