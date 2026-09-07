// components/LinkCreationForm.tsx

"use client";

import { useState } from "react";

interface Props {
  orgName: string;
  onSuccess: () => void;
}

export function LinkCreationForm({
  orgName,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    assessmentName: "",
    linkType: "solo" as "solo" | "group",
    accessLevel: "write" as "read" | "write" | "admin",
    templateRepoUrl: "",
    maxTeamSize: "4",
    expiresInDays: "124",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    // Validate assessment name
    if (!formData.assessmentName.trim()) {
      setError("Assessment name is required");
      setLoading(false);
      return;
    }

    try {
      const maxTeamSize = formData.maxTeamSize
        ? Number(formData.maxTeamSize)
        : 4;

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
          accessLevel: formData.accessLevel,
          templateRepoUrl: formData.templateRepoUrl,
          maxTeamSize,
          expiresInDays,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.error || "Failed to create link"
        );
      }

      setSuccess(true);
      setFormData({
        assessmentName: "",
        linkType: "solo",
        accessLevel: "write",
        templateRepoUrl: "",
        maxTeamSize: "4",
        expiresInDays: "124",
      });

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
        <div className="mb-4 p-4 bg-red-50 border border-red-200
                        rounded text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border
                        border-green-200 rounded text-green-700">
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
          className="w-full px-4 py-2 border border-gray-300
                     rounded-lg focus:outline-none
                     focus:ring-2 focus:ring-blue-500"
          required
        />
        <p className="text-xs text-gray-500 mt-1">
          Used to identify the assignment
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
                linkType: e.target.value as "solo" | "group",
              })
            }
            className="w-full px-4 py-2 border border-gray-300
                       rounded-lg focus:outline-none
                       focus:ring-2 focus:ring-blue-500"
          >
            <option value="solo">Individual</option>
            <option value="group">Group</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Access Level
          </label>
          <select
            value={formData.accessLevel}
            onChange={(e) =>
              setFormData({
                ...formData,
                accessLevel: e.target.value as
                  | "read"
                  | "write"
                  | "admin",
              })
            }
            className="w-full px-4 py-2 border border-gray-300
                       rounded-lg focus:outline-none
                       focus:ring-2 focus:ring-blue-500"
          >
            <option value="read">Read</option>
            <option value="write">Write</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          Template Repository URL (optional)
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
          className="w-full px-4 py-2 border border-gray-300
                     rounded-lg focus:outline-none
                     focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {formData.linkType === "group" && (
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
              // Allow empty string or numeric input
              if (val === "" || /^\d+$/.test(val)) {
                setFormData({
                  ...formData,
                  maxTeamSize: val,
                });
              }
            }}
            className="w-full px-4 py-2 border border-gray-300
                       rounded-lg focus:outline-none
                       focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            2–10 students per team
          </p>
        </div>
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
            // Allow empty string (no expiration) or numeric input
            if (val === "" || /^\d+$/.test(val)) {
              setFormData({
                ...formData,
                expiresInDays: val,
              });
            }
          }}
          className="w-full px-4 py-2 border border-gray-300
                     rounded-lg focus:outline-none
                     focus:ring-2 focus:ring-blue-500"
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
        {loading ? "Creating..." : "Create Link"}
      </button>
    </form>
  );
}
