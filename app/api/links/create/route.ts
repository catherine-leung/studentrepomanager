// app/api/links/create/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/session";
import { requireRole } from "@/lib/role-detection";
import {
  getOrganizationByName,
  createOrganization,
  createRepoLink,
  deleteRepoLink,
  AssessmentNameTakenError,
} from "@/lib/db";
import { parseTemplateRepoUrl } from "@/lib/naming";
import { isEmuLogin } from "@/lib/emu";
import {
  provisionCoursedocsLink,
  CoursedocsRepoExistsError,
  CoursedocsTemplateError,
} from "@/lib/coursedocs";
import { internalError } from "@/lib/api-errors";
import {
  getInstallationIdForOrg,
  getInstallationOctokit,
} from "@/lib/github-app";

export const maxDuration = 60;

type LinkType = "solo" | "group" | "coursedocs";
type AccessLevel = "read" | "write" | "admin";

interface CreateLinkBody {
  orgName?: unknown;
  assessmentName?: unknown;
  linkType?: unknown;
  accessLevel?: unknown;
  templateRepoUrl?: unknown;
  maxTeamSize?: unknown;
  maxGroups?: unknown;
  expiresInDays?: unknown;
}

const TEMPLATE_URL_PATTERN =
  /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/;

function isLinkType(value: unknown): value is LinkType {
  return (
    value === "solo" ||
    value === "group" ||
    value === "coursedocs"
  );
}

function isAccessLevel(value: unknown): value is AccessLevel {
  return (
    value === "read" ||
    value === "write" ||
    value === "admin"
  );
}

class TemplateNotFoundError extends Error {
  constructor(url: string) {
    super(
      `Repository not found: ${url}. Please verify the URL ` +
      "is correct and the repository is accessible."
    );
    this.name = "TemplateNotFoundError";
  }
}

class NotATemplateError extends Error {
  constructor(url: string) {
    super(
      `The repository at ${url} is not marked as a ` +
      "template. Please enable 'Template repository' in " +
      "the repository settings on GitHub."
    );
    this.name = "NotATemplateError";
  }
}

async function validateTemplateRepository(
  templateRepoUrl: string,
  installationId: number
): Promise<void> {
  try {
    const { owner, repo } = parseTemplateRepoUrl(
      templateRepoUrl
    );
    const octokit = await getInstallationOctokit(
      installationId
    );
    const response = await octokit.request(
      "GET /repos/{owner}/{repo}",
      { owner, repo }
    );

    if (response.data.is_template !== true) {
      throw new NotATemplateError(templateRepoUrl);
    }
  } catch (error) {
    if (
      error instanceof TemplateNotFoundError ||
      error instanceof NotATemplateError
    ) {
      throw error;
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      (error as { status: unknown }).status === 404
    ) {
      throw new TemplateNotFoundError(templateRepoUrl);
    }

    console.error(
      "Unexpected error validating template:",
      error
    );
    throw new Error("Failed to validate template repository");
  }
}

function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);

    if (!authContext) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    let body: CreateLinkBody;

    try {
      body = (await request.json()) as CreateLinkBody;
    } catch {
      return badRequest("Invalid JSON body");
    }

    const {
      orgName: rawOrgName,
      assessmentName: rawAssessmentName,
      linkType: rawLinkType,
      accessLevel: rawAccessLevel,
      templateRepoUrl: rawTemplateRepoUrl,
      maxTeamSize: rawMaxTeamSize,
      maxGroups: rawMaxGroups,
      expiresInDays: rawExpiresInDays,
    } = body;

    // --- Common validation --------------------------------

    if (
      typeof rawOrgName !== "string" ||
      rawOrgName.trim().length === 0
    ) {
      return badRequest("orgName is required");
    }

    if (
      typeof rawAssessmentName !== "string" ||
      rawAssessmentName.trim().length === 0
    ) {
      return badRequest("assessmentName is required");
    }

    if (rawAssessmentName.length > 255) {
      return badRequest(
        "assessmentName must be 255 characters or less"
      );
    }

    if (!isLinkType(rawLinkType)) {
      return badRequest(
        "linkType must be 'solo', 'group', or 'coursedocs'"
      );
    }

    const isCoursedocs = rawLinkType === "coursedocs";

    let expiresAt: Date | undefined;

    if (
      rawExpiresInDays !== undefined &&
      rawExpiresInDays !== null &&
      rawExpiresInDays !== ""
    ) {
      const expiresInDays = Number(rawExpiresInDays);

      if (
        !Number.isInteger(expiresInDays) ||
        expiresInDays < 1 ||
        expiresInDays > 365
      ) {
        return badRequest(
          "expiresInDays must be an integer between 1 and " +
          "365, or left blank"
        );
      }

      expiresAt = new Date(
        Date.now() + expiresInDays * 24 * 60 * 60 * 1000
      );
    }

    // --- Template URL (all link types) ------------------

    if (
      rawTemplateRepoUrl !== undefined &&
      rawTemplateRepoUrl !== null &&
      typeof rawTemplateRepoUrl !== "string"
    ) {
      return badRequest("templateRepoUrl must be a string");
    }

    const templateRepoUrl =
      typeof rawTemplateRepoUrl === "string"
        ? rawTemplateRepoUrl.trim()
        : "";

    if (
      templateRepoUrl &&
      !TEMPLATE_URL_PATTERN.test(templateRepoUrl)
    ) {
      return badRequest(
        "templateRepoUrl must be a valid GitHub repository URL"
      );
    }

    const orgName = rawOrgName.trim();
    const assessmentName = rawAssessmentName.trim();

    // --- Authorization ------------------------------------

    const isOwner = await requireRole(
      authContext,
      orgName,
      "owner"
    );

    if (!isOwner) {
      return NextResponse.json(
        {
          error:
            "Forbidden: you must be an owner of " +
            `'${orgName}' to create links`,
        },
        { status: 403 }
      );
    }

    const installationId =
      await getInstallationIdForOrg(orgName);

    let organization = await getOrganizationByName(orgName);

    if (!organization) {
      organization = await createOrganization(
        orgName,
        installationId,
        isEmuLogin(authContext.login)
      );
    }

    // --- Template must exist and be a template ----------
    // Runs before any rows or GitHub resources are created,
    // for every link type.

    if (templateRepoUrl) {
      try {
        await validateTemplateRepository(
          templateRepoUrl,
          installationId
        );
      } catch (error) {
        return badRequest(
          error instanceof Error
            ? error.message
            : "Failed to validate template repository"
        );
      }
    }

    // --- Coursedocs: pre-create team + repo -----------

    if (isCoursedocs) {
      // 1. Create the link first. A duplicate assessment
      //    name throws AssessmentNameTakenError here and is
      //    mapped to 409 by the outer catch.
      const link = await createRepoLink(
        organization.id,
        "coursedocs",
        "read",
        authContext.login,
        templateRepoUrl || undefined,
        undefined,
        expiresAt,
        assessmentName,
        1
      );

      // 2. Provision GitHub team + repo (from template if
      //    one was supplied)
      try {
        await provisionCoursedocsLink({
          linkDbId: link.id,
          linkId: link.link_id,
          orgName,
          installationId,
          assessmentName,
          templateRepoUrl: templateRepoUrl || null,
        });
      } catch (error) {
        // GitHub resources were already rolled back inside
        // provisionCoursedocsLink. Remove the link row too,
        // otherwise the dashboard shows a link with no team.
        try {
          await deleteRepoLink(link.link_id);
        } catch (cleanupError) {
          console.error(
            "Failed to remove coursedocs link " +
            `${link.link_id} after provisioning failure:`,
            cleanupError
          );
        }

        if (error instanceof CoursedocsRepoExistsError) {
          return NextResponse.json(
            { error: error.message },
            { status: 409 }
          );
        }

        if (error instanceof CoursedocsTemplateError) {
          return badRequest(error.message);
        }

        throw error;
      }

      return NextResponse.json(link, { status: 201 });
    }

    // --- Solo / group validation --------------------------

    if (!isAccessLevel(rawAccessLevel)) {
      return badRequest(
        "accessLevel must be 'read', 'write', or 'admin'"
      );
    }

    const maxTeamSizeProvided =
      rawMaxTeamSize !== undefined &&
      rawMaxTeamSize !== null &&
      rawMaxTeamSize !== "";
    const maxGroupsProvided =
      rawMaxGroups !== undefined &&
      rawMaxGroups !== null &&
      rawMaxGroups !== "";

    const maxTeamSize = maxTeamSizeProvided
      ? Number(rawMaxTeamSize)
      : undefined;
    const maxGroups = maxGroupsProvided
      ? Number(rawMaxGroups)
      : undefined;

    if (rawLinkType === "group") {
      if (
        maxTeamSizeProvided &&
        (!Number.isInteger(maxTeamSize) || maxTeamSize! < 2)
      ) {
        return badRequest(
          "maxTeamSize must be an integer of 2 or more, " +
          "or left blank for unlimited"
        );
      }

      if (
        maxGroupsProvided &&
        (!Number.isInteger(maxGroups) || maxGroups! < 1)
      ) {
        return badRequest(
          "maxGroups must be an integer of 1 or more, " +
          "or left blank for unlimited"
        );
      }
    }

    const link = await createRepoLink(
      organization.id,
      rawLinkType,
      rawAccessLevel,
      authContext.login,
      templateRepoUrl || undefined,
      rawLinkType === "group" ? maxTeamSize : undefined,
      expiresAt,
      assessmentName,
      rawLinkType === "group" ? maxGroups : undefined
    );

    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    // Map typed errors to HTTP status codes
    if (error instanceof AssessmentNameTakenError) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }

    if (error instanceof CoursedocsRepoExistsError) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }

    if (error instanceof CoursedocsTemplateError) {
      return badRequest(error.message);
    }

    return internalError(
      "POST /api/links/create",
      error,
      "Failed to create link"
    );
  }
}
