// components/redeem/TeamSelector.tsx

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { COPY } from "@/lib/copy";

interface Team {
  id: number;
  team_name: string;
  memberCount?: number;
  expected_team_size?: number;
}

interface Props {
  teams: Team[];
  maxTeamSize: number | null;
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
    <div className="space-y-4">
      {/* Join Existing Team */}
      <div
        className="rounded-xl border border-neutral-200 bg-white
                   p-6 shadow-sm"
      >
        <h2 className="mb-4 text-lg font-bold text-neutral-900">
          {COPY.redeem.group.joinTeam}
        </h2>

        {availableTeams.length === 0 ? (
          <p className="text-sm text-neutral-600">
            {canCreateTeam
              ? COPY.redeem.group.noTeamsAvailable
              : COPY.redeem.group.noTeamsMax}
          </p>
        ) : (
          <>
            <div className="mb-4 space-y-2">
              {availableTeams.map((team) => {
                const isSelected = selectedTeamId === team.id;
                return (
                  <label
                    key={team.id}
                    className={`flex cursor-pointer items-center
                               gap-3 rounded-lg border p-3
                               transition-colors ${
                                 isSelected
                                   ? "border-primary-400 " +
                                     "bg-primary-50"
                                   : "border-neutral-200 " +
                                     "hover:border-primary-200 " +
                                     "hover:bg-primary-50/40"
                               }`}
                  >
                    <input
                      type="radio"
                      name="team"
                      value={team.id}
                      checked={isSelected}
                      onChange={(e) =>
                        setSelectedTeamId(
                          Number(e.target.value)
                        )
                      }
                      className="h-4 w-4 shrink-0
                                 accent-primary-600"
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className="font-medium
                                   text-neutral-900"
                      >
                        {team.team_name}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {team.memberCount ?? 0} /{" "}
                        {team.expected_team_size ?? "?"}{" "}
                        {COPY.redeem.group.members}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>

            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={handleSelectTeam}
              disabled={loading || selectedTeamId === null}
              isLoading={loading}
            >
              {loading
                ? COPY.redeem.group.joining
                : COPY.redeem.group.joinButton}
            </Button>
          </>
        )}
      </div>

      {/* Create New Team */}
      {canCreateTeam ? (
        <div
          className="rounded-xl border border-neutral-200
                     bg-white p-6 shadow-sm"
        >
          <h2
            className="mb-4 text-lg font-bold text-neutral-900"
          >
            {COPY.redeem.group.createTeam}
          </h2>

          <form onSubmit={handleCreateTeam}>
            <div className="mb-4">
              <Input
                label={COPY.redeem.group.teamNameLabel}
                placeholder={
                  COPY.redeem.group.teamNamePlaceholder
                }
                value={newTeamName}
                onChange={(e) =>
                  setNewTeamName(e.target.value)
                }
                maxLength={255}
              />
            </div>

            <div className="mb-5">
              <Input
                type="number"
                label={COPY.redeem.group.expectedSizeLabel}
                min="1"
                max={maxTeamSize || 100}
                value={expectedTeamSize}
                onChange={(e) =>
                  setExpectedTeamSize(e.target.value)
                }
              />
              <p className="mt-2 text-xs text-neutral-500">
                {COPY.redeem.group.maxAllowed}{" "}
                <span className="font-bold text-neutral-900">
                  {maxTeamSize || "Unlimited"}
                </span>
              </p>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              disabled={
                loading ||
                !newTeamName.trim() ||
                !expectedTeamSize
              }
              isLoading={loading}
            >
              {loading
                ? COPY.redeem.group.creating
                : COPY.redeem.group.createButton}
            </Button>
          </form>
        </div>
      ) : (
        <div
          className="rounded-xl border border-neutral-200
                     bg-white p-6 shadow-sm text-neutral-600"
        >
          <h2
            className="mb-2 text-lg font-bold text-neutral-900"
          >
            {COPY.redeem.group.createTeam}
          </h2>
          <p className="text-sm">
            The maximum number of teams for this link
            has been reached. Please join an existing team
            above.
          </p>
        </div>
      )}
    </div>
  );
}
