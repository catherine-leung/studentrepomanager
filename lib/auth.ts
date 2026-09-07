// lib/auth.ts

import {
  NextAuthOptions,
  Profile,
} from "next-auth";
import GitHubProvider from "next-auth/providers/github";

interface GitHubProfile extends Profile {
  id?: string;
  login?: string;
}

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID || "",
      clientSecret: process.env.GITHUB_SECRET || "",
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          scope: "read:user user:email read:org repo:invite",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      const githubProfile =
        profile as GitHubProfile | undefined;

      if (account) {
        token.accessToken = account.access_token;
        token.githubId = githubProfile?.id
          ? Number(githubProfile.id)
          : undefined;
        token.login = githubProfile?.login;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub || "";
        session.user.githubId = token.githubId as number;
        session.user.login = token.login as string;
        // accessToken intentionally NOT exposed to session
        // Use getAuthContext() in API routes to access it
      }

      return session;
    },
  },
  pages: {
    signIn: "/",
  },
};