// components/LinkCreationForm.tsx

"use client";

import { useState } from "react";
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
  maxTeamSize: "4",
  maxGroups: "10",
  expiresInDays: "124",
};

const INPUT_CLASS =
  "w-full px-4 py-2 border border-gray-300 rounded-lg " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500 " +
  "disabled:bg-gray-100 disabled:text-gray-500";

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
        : 4;

      const maxGroups = formData.maxGroups
        ? Number(formData.maxGroups)
        : 10;

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

  // Get template help text based on link type
  const getTemplateHelp = (): string => {
    const helpMap: Record<LinkType, string> =
      COPY.linkForm.fields.templateHelp as Record<
        LinkType,
        string
      >;
    return helpMap[formData.linkType] || "";
  };

  // Get repository type label
  const getRepositoryTypeLabel = (type: LinkType): string => {
    const typeMap: Record<LinkType, string> =
      COPY.linkForm.repositoryTypes as Record<LinkType, string>;
    return typeMap[type] || type;
  };

  // Get access level label
  const getAccessLevelLabel = (level: AccessLevel): string => {
    const levelMap: Record<AccessLevel, string> =
      COPY.linkForm.accessLevels as Record<AccessLevel, string>;
    return levelMap[level] || level;
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-lg shadow p-6 mb-6"
    >
      <h2 className="text-xl font-bold mb-6">
        {COPY.linkForm.title}
      </h2>

      {error && (
        <div
          className="mb-4 p-4 bg-red-50 border border-red-200
                     rounded text-red-700"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          className="mb-4 p-4 bg-green-50 border
                     border-green-200 rounded text-green-700"
        >
          {COPY.linkForm.success}
        </div>
      )}

      {/* Repository Details Section */}
      <div className="mb-6 pb-6 border-b border-gray-200">
        <h3 className="text-sm font-bold text-gray-700 mb-4
                       flex items-center gap-2">
          {COPY.linkForm.sections.details}
        </h3>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            {COPY.linkForm.fields.name}
            <span className="text-red-600 ml-1">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g., Lab 1: Sorting Algorithms"
            value={formData.assessmentName}
            onChange={(e) =>
              setFormData({
                ...formData,
                assessmentName: e.target.value,
              })
            }
            className={INPUT_CLASS}
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            {COPY.linkForm.fields.nameHelp}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              {COPY.linkForm.fields.type}
            </label>
            <select
              value={formData.linkType}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  linkType: e.target.value as LinkType,
                })
              }
              className={INPUT_CLASS}
            >
              <option value="solo">
                {getRepositoryTypeLabel("solo")}
              </option>
              <option value="group">
                {getRepositoryTypeLabel("group")}
              </option>
              <option value="coursedocs">
                {getRepositoryTypeLabel("coursedocs")}
              </option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {COPY.linkForm.fields.typeHelp}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              {COPY.linkForm.fields.template}
            </label>
            <input
              type="text"
              placeholder="https://github.com/org/template-repo"
              value={formData.templateRepoUrl}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  templateRepoUrl: e.target.value,
                })
              }
              className={INPUT_CLASS}
            />
            <p className="text-xs text-gray-500 mt-1">
              {getTemplateHelp()}
            </p>
          </div>
        </div>
      </div>

      {/* Access & Security Section */}
      <div className="mb-6 pb-6 border-b border-gray-200">
        <h3 className="text-sm font-bold text-gray-700 mb-4
                       flex items-center gap-2">
          {COPY.linkForm.sections.access}
        </h3>

        <div>
          <label className="block text-sm font-medium mb-2">
            {COPY.linkForm.fields.accessLevel}
          </label>
          <select
            value={isCoursedocs ? "read" : formData.accessLevel}
            disabled={isCoursedocs}
            onChange={(e) =>
              setFormData({
                ...formData,
                accessLevel: e.target.value as AccessLevel,
              })
            }
            className={INPUT_CLASS}
          >
            <option value="read">
              {getAccessLevelLabel("read")}
            </option>
            <option value="write">
              {getAccessLevelLabel("write")}
            </option>
            <option value="admin">
              {getAccessLevelLabel("admin")}
            </option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            {COPY.linkForm.fields.accessLevelHelp}
          </p>

          {isCoursedocs && (
            <p className="text-xs text-gray-500 mt-2">
              Course documents are always read-only
            </p>
          )}
        </div>

        {isAdmin && !isCoursedocs && (
          <div
            className="mt-4 p-4 bg-red-50 border border-red-200
                       rounded text-red-900"
          >
            <p className="font-bold text-sm mb-2">
              {COPY.linkForm.adminWarning.title}
            </p>
            <p className="text-sm mb-2">
              {COPY.linkForm.adminWarning.message}
            </p>
            <p className="text-sm mb-2">
              Ensure your organization has disabled:
            </p>
            <ul className="text-sm list-disc list-inside
                           space-y-1 mb-3">
              {COPY.linkForm.adminWarning.settings.map(
                (setting, i) => (
                  <li key={i}>{setting}</li>
                )
              )}
            </ul>
            <a
              href={settingsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-700 hover:text-red-900
                         underline text-sm"
            >
              {COPY.linkForm.adminWarning.configLink}
            </a>
          </div>
        )}
      </div>

      {/* Coursedocs Info */}
      {isCoursedocs && (
        <div
          className="mb-6 p-4 bg-blue-50 border border-blue-200
                     rounded text-sm text-blue-900"
        >
          {COPY.linkForm.coursedocsInfo}
        </div>
      )}

      {/* Group-specific options */}
      {isGroup && (
        <div className="mb-6 pb-6 border-b border-gray-200">
          <h3 className="text-sm font-bold text-gray-700 mb-4">
            Team Configuration
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                {COPY.linkForm.fields.maxTeamSize}
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="2-10"
                value={formData.maxTeamSize}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || /^\d+$/.test(val)) {
                    setFormData({
                      ...formData,
                      maxTeamSize: val,
                    });
                  }
                }}
                className={INPUT_CLASS}
              />
              <p className="text-xs text-gray-500 mt-1">
                {COPY.linkForm.fields.maxTeamSizeHelp}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                {COPY.linkForm.fields.maxGroups}
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="e.g., 10"
                value={formData.maxGroups}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || /^\d+$/.test(val)) {
                    setFormData({
                      ...formData,
                      maxGroups: val,
                    });
                  }
                }}
                className={INPUT_CLASS}
              />
              <p className="text-xs text-gray-500 mt-1">
                {COPY.linkForm.fields.maxGroupsHelp}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Expiration Section */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-gray-700 mb-4
                       flex items-center gap-2">
          {COPY.linkForm.sections.expiration}
        </h3>

        <label className="block text-sm font-medium mb-2">
          {COPY.linkForm.fields.expiresIn}
        </label>
        <input
          type="text"
          inputMode="numeric"
          placeholder="Leave blank for no expiration"
          value={formData.expiresInDays}
          onChange={(e) => {
            const val = e.target.value.trim();
            if (val === "" || /^\d+$/.test(val)) {
              setFormData({
                ...formData,
                expiresInDays: val,
              });
            }
          }}
          className={INPUT_CLASS}
        />
        <p className="text-xs text-gray-500 mt-1">
          {COPY.linkForm.fields.expiresInHelp}
        </p>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white px-4 py-3
                   rounded-lg hover:bg-blue-700 transition
                   disabled:bg-gray-400 font-medium"
      >
        {loading
          ? isCoursedocs
            ? hasTemplate
              ? "Creating team and repository from template..."
              : "Creating team and repository..."
            : "Creating..."
          : COPY.linkForm.submitButton}
      </button>
    </form>
  );
}
