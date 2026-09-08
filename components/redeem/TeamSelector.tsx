// components/redeem/TeamSelector.tsx

"use client";

import { useState } from "react";

interface Team {
  id: number;
  team_name: string;
  memberCount?: number;
  expected_team_size?: number;
}

interface Props {
  teams: Team[];
  maxTeamSize: number | null;
  /**
   * Whether the professor's max_groups limit still allows a
   * new team to be created. When false, the create form is
   * replaced with an explanatory message.
   */
  canCreateTeam: boolean;
  onSelectTeam: (teamId: number) => Promise<void>;
  onCreateTeam: (
    teamName: string,
    expectedSize: number
  ) => Promise<void>;
  loading: boolean;
}

export function TeamSelector({
  teams,
  maxTeamSize,
  canCreateTeam,
  onSelectTeam,
  onCreateTeam,
  loading,
}: Props) {
  const [mode, setMode] = useState<"select" | "create">(
    "select"
  );
  const [newTeamName, setNewTeamName] = useState("");
  const [expectedTeamSize, setExpectedTeamSize] = useState(
    maxTeamSize?.toString() || "2"
  );
  const [selectedTeamId, setSelectedTeamId] = useState<
    number | null
  >(null);

  async function handleSelectTeam() {
    if (selectedTeamId === null) return;
    await onSelectTeam(selectedTeamId);
  }

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    const size = Number(expectedTeamSize);
    if (!Number.isInteger(size) || size < 1) {
      return;
    }

    await onCreateTeam(newTeamName.trim(), size);
  }

  const availableTeams = teams.filter((team) => {
    const teamExpectedSize = team.expected_team_size || 0;
    return (team.memberCount || 0) < teamExpectedSize;
  });

  return (
    <div className="space-y-6">
      {/* Join Existing Team */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold mb-4">
          Join a Team
        </h3>

        {availableTeams.length === 0 ? (
          <p className="text-gray-600 mb-4">
            {canCreateTeam
              ? "No teams available to join."
              : "No teams have open spots. Please contact " +
                "your instructor."}
          </p>
        ) : (
          <>
            <div className="space-y-2 mb-4">
              {availableTeams.map((team) => (
                <label
                  key={team.id}
                  className="flex items-center p-3 border
                             border-gray-300 rounded-lg
                             hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="team"
                    value={team.id}
                    checked={selectedTeamId === team.id}
                    onChange={(e) =>
                      setSelectedTeamId(
                        Number(e.target.value)
                      )
                    }
                    className="mr-3"
                  />
                  <div>
                    <p className="font-medium">
                      {team.team_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {team.memberCount ?? 0} /{" "}
                      {team.expected_team_size ?? "?"}{" "}
                      members
                    </p>
                  </div>
                </label>
              ))}
            </div>

            <button
              onClick={handleSelectTeam}
              disabled={
                loading || selectedTeamId === null
              }
              className="w-full bg-blue-600 text-white px-6
                         py-3 rounded-lg hover:bg-blue-700
                         transition font-medium
                         disabled:bg-gray-400"
            >
              {loading ? "Joining..." : "Join Team"}
            </button>
          </>
        )}
      </div>

      {/* Create New Team */}
      {canCreateTeam ? (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold mb-4">
            Create a New Team
          </h3>

          <form onSubmit={handleCreateTeam}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Team Name
              </label>
              <input
                type="text"
                placeholder="e.g., Team A, Group 1"
                value={newTeamName}
                onChange={(e) =>
                  setNewTeamName(e.target.value)
                }
                maxLength={255}
                className="w-full px-4 py-2 border
                           border-gray-300 rounded-lg
                           focus:outline-none
                           focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Expected Team Size
              </label>
              <input
                type="number"
                min="1"
                max={maxTeamSize || 100}
                value={expectedTeamSize}
                onChange={(e) =>
                  setExpectedTeamSize(e.target.value)
                }
                className="w-full px-4 py-2 border
                           border-gray-300 rounded-lg
                           focus:outline-none
                           focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-2">
                Maximum allowed by instructor:{" "}
                <span className="font-bold">
                  {maxTeamSize || "Unlimited"}
                </span>
              </p>
            </div>

            <button
              type="submit"
              disabled={
                loading ||
                !newTeamName.trim() ||
                !expectedTeamSize
              }
              className="w-full bg-green-600 text-white px-6
                         py-3 rounded-lg hover:bg-green-700
                         transition font-medium
                         disabled:bg-gray-400"
            >
              {loading
                ? "Creating team..."
                : "Create Team"}
            </button>
          </form>
        </div>
      ) : (
        <div
          className="bg-white rounded-lg shadow p-6
                     text-gray-600"
        >
          <h3 className="text-xl font-bold mb-2 text-gray-800">
            Create a New Team
          </h3>
          <p>
            The maximum number of teams for this assignment
            has been reached. Please join an existing team
            above.
          </p>
        </div>
      )}
    </div>
  );
}
