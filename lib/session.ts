// lib/session.ts

import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

/**
 * AuthContext: server-side authentication context.
 * Contains the access token (never exposed to browser).
 */
export interface AuthContext {
  login: string;
  githubId: number;
  accessToken: string;
}

/**
 * getAuthContext: retrieve authentication context from JWT.
 *
 * This is server-side only (API routes, server components).
 * The access token is never exposed to the browser.
 *
 * @param req NextRequest (from API route)
 * @returns AuthContext if authenticated, null otherwise
 */
export async function getAuthContext(
  req: NextRequest
): Promise<AuthContext | null> {
  const token = await getToken({ req });

  if (!token?.accessToken || !token.login) {
    return null;
  }

  return {
    login: token.login as string,
    githubId: (token.githubId as number) ?? 0,
    accessToken: token.accessToken as string,
  };
}
