// components/LinkCreationForm.tsx

"use client";

import { useState } from "react";

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    if (!formData.assessmentName.trim()) {
      setError("Assessment name is required");
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
          templateRepoUrl: isCoursedocs
            ? ""
            : formData.templateRepoUrl,
          maxTeamSize,
          maxGroups,
          expiresInDays,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create link");
      }

      setSuccess(true);
      setFormData(INITIAL_FORM);

      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unknown error"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-lg shadow p-6 mb-6"
    >
      <h2 className="text-xl font-bold mb-4">
        Create Assignment Link
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
          Link created successfully!
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          Assessment Name *
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
          {isCoursedocs
            ? "Also used as the shared repository and team name"
            : "Used to identify the assignment"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Assignment Type
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
            <option value="solo">Individual</option>
            <option value="group">Group</option>
            <option value="coursedocs">
              Course Documents (shared, read-only)
            </option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Access Level
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
            <option value="read">Read</option>
            <option value="write">Write</option>
            <option value="admin">Admin</option>
          </select>
          {isCoursedocs && (
            <p className="text-xs text-gray-500 mt-1">
              Course documents are always read-only
            </p>
          )}
        </div>
      </div>

      {isCoursedocs && (
        <div
          className="mb-4 p-4 bg-blue-50 border border-blue-200
                     rounded text-sm text-blue-900"
        >
          A private repository and a team will be created{" "}
          <strong>now</strong>. Every student who redeems
          the link joins that team and gets read access to
          the same repository.
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          Template Repository URL (optional)
        </label>
        <input
          type="text"
          placeholder={
            isCoursedocs
              ? "Not available for course documents"
              : "https://github.com/org/template-repo"
          }
          value={isCoursedocs ? "" : formData.templateRepoUrl}
          disabled={isCoursedocs}
          onChange={(e) =>
            setFormData({
              ...formData,
              templateRepoUrl: e.target.value,
            })
          }
          className={INPUT_CLASS}
        />
      </div>

      {isGroup && (
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Max Team Size
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
              2–10 students per team
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Max Number of Groups
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
              Maximum number of teams students can create
            </p>
          </div>
        </>
      )}

      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          Expires In (days) - Optional
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
          1–365 days, or leave blank for no expiration
        </p>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white px-4 py-2
                   rounded-lg hover:bg-blue-700 transition
                   disabled:bg-gray-400"
      >
        {loading
          ? isCoursedocs
            ? "Creating team and repository..."
            : "Creating..."
          : "Create Link"}
      </button>
    </form>
  );
}
