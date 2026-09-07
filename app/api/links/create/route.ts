// app/api/links/create/route.ts

import {
  getInstallationIdForOrg,
  getInstallationOctokit,
} from "@/lib/github-app";
import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/session";
import { requireRole } from "@/lib/role-detection";
import {
  getOrganizationByName,
  createOrganization,
  createRepoLink,
} from "@/lib/db";
import { parseTemplateRepoUrl } from "@/lib/github-repos";


interface CreateLinkBody {
  orgName?: unknown;
  assessmentName?: unknown;
  linkType?: unknown;
  accessLevel?: unknown;
  templateRepoUrl?: unknown;
  maxTeamSize?: unknown;
  expiresInDays?: unknown;
}

function isLinkType(
  value: unknown
): value is "solo" | "group" {
  return (
    value === "solo" ||
    value === "group"
  );
}

function isAccessLevel(
  value: unknown
): value is "read" | "write" | "admin" {
  return (
    value === "read" ||
    value === "write" ||
    value === "admin"
  );
}

class TemplateNotFoundError extends Error {
  constructor(url: string) {
    super(
      `Repository not found: ${url}. ` +
      "Please verify the URL is correct and the repository is public or accessible."
    );
    this.name = "TemplateNotFoundError";
  }
}

class NotATemplateError extends Error {
  constructor(url: string) {
    super(
      `The repository at ${url} is not marked as a template. ` +
      "Please enable 'Template repository' in the repository settings on GitHub."
    );
    this.name = "NotATemplateError";
  }
}

/**
 * Validate that a template repository is actually a template.
 *
 * @param templateRepoUrl GitHub repository URL
 * @param installationId GitHub App installation ID (for auth)
 * @throws TemplateNotFoundError if the repo doesn't exist or can't be accessed
 * @throws NotATemplateError if the repo exists but is not a template
 */
async function validateTemplateRepository(
  templateRepoUrl: string,
  installationId: number
): Promise<void> {
  try {
    const { owner, repo } = parseTemplateRepoUrl(
      templateRepoUrl
    );

    // Use authenticated GitHub App request
    const octokit = await getInstallationOctokit(
      installationId
    );

    const response = await (octokit as any).request(
      "GET /repos/{owner}/{repo}",
      {
        owner,
        repo,
      }
    );

    const data = response.data;

    console.log(
      `Template repo check for ${templateRepoUrl}: is_template=${data.is_template}`
    );

    // Check if the repository is marked as a template
    if (data.is_template !== true) {
      console.log(
        `Repository ${templateRepoUrl} is not a template (is_template=${data.is_template})`
      );
      throw new NotATemplateError(templateRepoUrl);
    }
  } catch (error) {
    if (
      error instanceof TemplateNotFoundError ||
      error instanceof NotATemplateError
    ) {
      throw error;
    }

    // Check if it's a 404 error
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
    throw new Error(
      "Failed to validate template repository"
    );
  }
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
      body = await request.json() as CreateLinkBody;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const {
      orgName: rawOrgName,
      assessmentName: rawAssessmentName,
      linkType: rawLinkType,
      accessLevel: rawAccessLevel,
      templateRepoUrl: rawTemplateRepoUrl,
      maxTeamSize: rawMaxTeamSize,
      expiresInDays: rawExpiresInDays,
    } = body;

    if (
      typeof rawOrgName !== "string" ||
      rawOrgName.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "orgName is required" },
        { status: 400 }
      );
    }

    if (
      typeof rawAssessmentName !== "string" ||
      rawAssessmentName.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "assessmentName is required" },
        { status: 400 }
      );
    }

    if (rawAssessmentName.length > 255) {
      return NextResponse.json(
        {
          error:
            "assessmentName must be 255 characters or less",
        },
        { status: 400 }
      );
    }

    if (!isLinkType(rawLinkType)) {
      return NextResponse.json(
        { error: "linkType must be 'solo' or 'group'" },
        { status: 400 }
      );
    }

    if (!isAccessLevel(rawAccessLevel)) {
      return NextResponse.json(
        {
          error:
            "accessLevel must be 'read', 'write', " +
            "or 'admin'",
        },
        { status: 400 }
      );
    }

    if (
      rawTemplateRepoUrl !== undefined &&
      rawTemplateRepoUrl !== null &&
      typeof rawTemplateRepoUrl !== "string"
    ) {
      return NextResponse.json(
        { error: "templateRepoUrl must be a string" },
        { status: 400 }
      );
    }

    const templateRepoUrl =
      typeof rawTemplateRepoUrl === "string"
        ? rawTemplateRepoUrl.trim()
        : "";

    if (
      templateRepoUrl &&
      !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(
        templateRepoUrl
      )
    ) {
      return NextResponse.json(
        {
          error:
            "templateRepoUrl must be a valid GitHub " +
            "repository URL",
        },
        { status: 400 }
      );
    }

    const maxTeamSize = Number(rawMaxTeamSize);

    if (rawLinkType === "group") {
      if (
        !Number.isInteger(maxTeamSize) ||
        maxTeamSize < 2 ||
        maxTeamSize > 10
      ) {
        return NextResponse.json(
          {
            error:
              "maxTeamSize must be an integer " +
              "between 2 and 10",
          },
          { status: 400 }
        );
      }
    }

    // Allow null/empty for optional expiry, or 1-365 if provided
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
        return NextResponse.json(
          {
            error:
              "expiresInDays must be an integer " +
              "between 1 and 365, or left blank",
          },
          { status: 400 }
        );
      }

      expiresAt = new Date(
        Date.now() +
        expiresInDays * 24 * 60 * 60 * 1000
      );
    }

    const orgName = rawOrgName.trim();
    const assessmentName = rawAssessmentName.trim();

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

    // Validate that the template repository is actually a template
    if (templateRepoUrl) {
      try {
        await validateTemplateRepository(
          templateRepoUrl,
          installationId
        );
      } catch (error) {
        if (
          error instanceof TemplateNotFoundError ||
          error instanceof NotATemplateError
        ) {
          return NextResponse.json(
            { error: error.message },
            { status: 400 }
          );
        }
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Failed to validate template repository",
          },
          { status: 400 }
        );
      }
    }

    let organization =
      await getOrganizationByName(orgName);

    if (!organization) {
      organization = await createOrganization(
        orgName,
        installationId
      );
    }

    const link = await createRepoLink(
      organization.id,
      rawLinkType,
      rawAccessLevel,
      authContext.login,
      templateRepoUrl || undefined,
      rawLinkType === "group"
        ? maxTeamSize
        : undefined,
      expiresAt,
      assessmentName
    );

    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    console.error(
      "Error in POST /api/links/create:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create link",
      },
      { status: 500 }
    );
  }
}
