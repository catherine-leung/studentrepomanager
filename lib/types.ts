// lib/types.ts

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name?: string;
  email?: string;
}

export interface Organization {
  id: number;
  org_name: string;
  installation_id: number;
  created_at: string;
  last_verified_at: string | null;
  updated_at: string;
}

export interface RepoCreationLink {
  id: number;
  org_id: number;
  link_id: string;
  link_type: "solo" | "group" | "coursedocs";
  template_repo: string | null;
  assessment_name: string;
  access_level: "read" | "write" | "admin";
  min_team_size: number | null;
  max_team_size: number | null;
  max_groups: number | null;
  current_groups: number;
  max_repos_created: number | null;
  current_repos_created: number;
  created_by_username: string;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
}

export interface Team {
  id: number;
  link_id: number;
  team_name: string;
  github_team_id: number | null;
  github_team_slug: string | null;
  repo_name: string | null;
  repo_url: string | null;
  expected_team_size: number | null;
  created_at: string;
}

export interface StudentRepoAccess {
  id: number;
  link_id: number;
  github_id: number;
  team_id: number | null;
  repo_name: string;
  repo_url: string;
  access_level: "read" | "write" | "admin";
  github_login: string | null;
  created_at: string;
}

// A redemption row left-joined with its team (group links only —
// team_name is null for solo/coursedocs redemptions, which have
// no team_id at all).
export interface RedemptionWithTeam extends StudentRepoAccess {
  team_name: string | null;
}

// ============================================================================
// NextAuth Module Augmentation
// ============================================================================

import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      githubId: number;
      login: string;
      // accessToken intentionally NOT exposed to browser
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    githubId?: number;
    login?: string;
  }
}
