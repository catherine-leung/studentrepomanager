// components/LinkCreationForm.tsx

"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { COPY } from "@/lib/copy";
import { getOrgSettingsUrl } from "@/lib/github-urls";

type LinkType = "solo" | "group" | "coursedocs";
type AccessLevel = "read" | "write" | "admin";

interface Props {
  orgName: string;
  onSuccess: () => void;
}

const INITIAL_FORM = {
  assessmentName: "",
  linkType: "solo" as LinkType,
  accessLevel: "write" as AccessLevel,
  templateRepoUrl: "",
  // Blank means unlimited -- lib/db.ts stores that as
  // NULL, and lib/redeem.ts already treats NULL as no
  // cap for both team size and group count.
  maxTeamSize: "",
  maxGroups: "",
  expiresInDays: "124",
};

const REPOSITORY_TYPE_OPTIONS: Array<{
  value: LinkType;
  label: string;
}> = [
  { value: "solo", label: COPY.linkForm.repositoryTypes.solo },
  {
    value: "group",
    label: COPY.linkForm.repositoryTypes.group,
  },
  {
    value: "coursedocs",
    label: COPY.linkForm.repositoryTypes.coursedocs,
  },
];

const ACCESS_LEVEL_OPTIONS: Array<{
  value: AccessLevel;
  label: string;
}> = [
  { value: "read", label: COPY.linkForm.accessLevels.read },
  { value: "write", label: COPY.linkForm.accessLevels.write },
  { value: "admin", label: COPY.linkForm.accessLevels.admin },
];

// A digits-only guard shared by every numeric field below — an
// empty string is allowed too, so the field can be cleared.
function isDigitsOrEmpty(value: string): boolean {
  return value === "" || /^\d+$/.test(value);
}

export function LinkCreationForm({
  orgName,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM);

  const isCoursedocs = formData.linkType === "coursedocs";
  const isGroup = formData.linkType === "group";
  const isAdmin = formData.accessLevel === "admin";
  const hasTemplate = formData.templateRepoUrl.trim() !== "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    if (!formData.assessmentName.trim()) {
      setError(COPY.linkForm.fields.nameHelp);
      setLoading(false);
      return;
    }

    try {
      const maxTeamSize = formData.maxTeamSize
        ? Number(formData.maxTeamSize)
        : undefined;

      const maxGroups = formData.maxGroups
        ? Number(formData.maxGroups)
        : undefined;

      const expiresInDays = formData.expiresInDays
        ? Number(formData.expiresInDays)
        : null;

      const response = await fetch("/api/links/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName,
          assessmentName: formData.assessmentName,
          linkType: formData.linkType,
          accessLevel: isCoursedocs
            ? "read"
            : formData.accessLevel,
          templateRepoUrl: formData.templateRepoUrl,
          maxTeamSize,
          maxGroups,
          expiresInDays,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.error || COPY.errors.failedToCreate
        );
      }

      setSuccess(true);
      setFormData(INITIAL_FORM);

      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : COPY.errors.serverError
      );
    } finally {
      setLoading(false);
    }
  }

  const settingsUrl = getOrgSettingsUrl(orgName);

  function getTemplateHelp(): string {
    const helpMap: Record<LinkType, string> =
      COPY.linkForm.fields.templateHelp as Record<
        LinkType,
        string
      >;
    return helpMap[formData.linkType] || "";
  }

  const submitLabel = loading
    ? isCoursedocs
      ? hasTemplate
        ? "Creating team and repository from template…"
        : "Creating team and repository…"
      : "Creating…"
    : COPY.linkForm.submitButton;

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 rounded-xl border border-neutral-200
                 bg-white p-5 shadow-md"
    >
      <h2
        className="mb-4 flex items-center gap-2 text-lg
                   font-bold text-neutral-900"
      >
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-full bg-primary-600"
        />
        {COPY.linkForm.title}
      </h2>

      {error && (
        <div className="mb-3">
          <Alert type="error" message={error} />
        </div>
      )}

      {success && (
        <div className="mb-3">
          <Alert type="success" message={COPY.linkForm.success} />
        </div>
      )}

      {/* Repository Details */}
      <div className="mb-4 border-b border-neutral-200 pb-4">
        <h3 className="mb-3 text-xs font-semibold uppercase
                       tracking-wide text-primary-700">
          {COPY.linkForm.sections.details}
        </h3>

        <div
          className="grid grid-cols-1 gap-3
                     md:grid-cols-[1.2fr_0.8fr_1.2fr]"
        >
          <Input
            dense
            label={COPY.linkForm.fields.name}
            placeholder="e.g., Lab 1: Sorting Algorithms"
            value={formData.assessmentName}
            onChange={(e) =>
              setFormData({
                ...formData,
                assessmentName: e.target.value,
              })
            }
            hint={COPY.linkForm.fields.nameHelp}
            required
          />

          <Select
            dense
            label={COPY.linkForm.fields.type}
            value={formData.linkType}
            onChange={(e) =>
              setFormData({
                ...formData,
                linkType: e.target.value as LinkType,
              })
            }
            hint={COPY.linkForm.fields.typeHelp}
            options={REPOSITORY_TYPE_OPTIONS}
          />

          <Input
            dense
            label={COPY.linkForm.fields.template}
            placeholder="https://github.com/org/template-repo"
            value={formData.templateRepoUrl}
            onChange={(e) =>
              setFormData({
                ...formData,
                templateRepoUrl: e.target.value,
              })
            }
            hint={getTemplateHelp()}
          />
        </div>
      </div>

      {/* Access & Security (Expiration folded in alongside it) */}
      <div className="mb-4 border-b border-neutral-200 pb-4">
        <h3 className="mb-3 text-xs font-semibold uppercase
                       tracking-wide text-primary-700">
          {COPY.linkForm.sections.access}
        </h3>

        <div
          className="grid grid-cols-1 gap-3
                     md:grid-cols-2 lg:grid-cols-3"
        >
          <Select
            dense
            label={COPY.linkForm.fields.accessLevel}
            value={isCoursedocs ? "read" : formData.accessLevel}
            disabled={isCoursedocs}
            onChange={(e) =>
              setFormData({
                ...formData,
                accessLevel: e.target.value as AccessLevel,
              })
            }
            hint={
              isCoursedocs
                ? "Course documents are always read-only"
                : COPY.linkForm.fields.accessLevelHelp
            }
            options={ACCESS_LEVEL_OPTIONS}
          />

          <Input
            dense
            inputMode="numeric"
            placeholder="No expiration"
            label={COPY.linkForm.fields.expiresIn}
            value={formData.expiresInDays}
            onChange={(e) => {
              const val = e.target.value.trim();
              if (isDigitsOrEmpty(val)) {
                setFormData({
                  ...formData,
                  expiresInDays: val,
                });
              }
            }}
            hint={COPY.linkForm.fields.expiresInHelp}
          />
        </div>

        {isAdmin && !isCoursedocs && (
          <div className="mt-3">
            <Alert
              type="warning"
              title={COPY.linkForm.adminWarning.title.replace(
                /^\u26a0\ufe0f\s*/,
                ""
              )}
              message={COPY.linkForm.adminWarning.message}
            >
              <p className="mb-2 mt-2 text-sm">
                Ensure your organization has disabled:
              </p>
              <ul className="mb-3 list-inside list-disc
                             space-y-1 text-sm">
                {COPY.linkForm.adminWarning.settings.map(
                  (setting) => (
                    <li key={setting}>{setting}</li>
                  )
                )}
              </ul>
              <a
                href={settingsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium underline
                           underline-offset-2
                           focus-visible:outline-none
                           focus-visible:ring-2
                           focus-visible:ring-primary-500
                           focus-visible:ring-offset-2
                           rounded-sm"
              >
                {COPY.linkForm.adminWarning.configLink}
              </a>
            </Alert>
          </div>
        )}
      </div>

      {/* Coursedocs info */}
      {isCoursedocs && (
        <div className="mb-4">
          <Alert
            type="info"
            message={COPY.linkForm.coursedocsInfo}
          />
        </div>
      )}

      {/* Group-specific options */}
      {isGroup && (
        <div className="mb-4 border-b border-neutral-200 pb-4">
          <h3 className="mb-3 text-xs font-semibold uppercase
                         tracking-wide text-primary-700">
            Team Configuration
          </h3>

          <div
            className="grid grid-cols-1 gap-3
                       md:grid-cols-2 lg:grid-cols-3"
          >
            <Input
              dense
              inputMode="numeric"
              placeholder="Unlimited"
              label={COPY.linkForm.fields.maxTeamSize}
              value={formData.maxTeamSize}
              onChange={(e) => {
                const val = e.target.value;
                if (isDigitsOrEmpty(val)) {
                  setFormData({
                    ...formData,
                    maxTeamSize: val,
                  });
                }
              }}
              hint={COPY.linkForm.fields.maxTeamSizeHelp}
            />

            <Input
              dense
              inputMode="numeric"
              placeholder="Unlimited"
              label={COPY.linkForm.fields.maxGroups}
              value={formData.maxGroups}
              onChange={(e) => {
                const val = e.target.value;
                if (isDigitsOrEmpty(val)) {
                  setFormData({
                    ...formData,
                    maxGroups: val,
                  });
                }
              }}
              hint={COPY.linkForm.fields.maxGroupsHelp}
            />
          </div>
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full bg-gradient-to-r from-primary-600
                   to-primary-700 hover:from-primary-700
                   hover:to-primary-800"
        disabled={loading}
        isLoading={loading}
      >
        {submitLabel}
      </Button>
    </form>
  );
}
