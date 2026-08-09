// lib/types.ts
export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name?: string;
  email?: string;
}

export interface RepoCreationLink {
  id: string;
  orgId: string;
  type: "solo" | "group";
  templateRepo: string;
  createdAt: Date;
  expiresAt: Date;
  createdBy: string;
}

export interface StudentRepoAccess {
  studentId: string;
  repoId: string;
  linkId: string;
  createdAt: Date;
}
