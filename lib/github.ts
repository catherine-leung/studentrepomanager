// lib/github.ts
import { App } from "@octokit/app";

export function getGitHubApp() {
  const app = new App({
    appId: process.env.GITHUB_APP_ID!,
    privateKey: process.env.GITHUB_APP_PRIVATE_KEY!,
    oauth: {
      clientId: process.env.GITHUB_OAUTH_CLIENT_ID!,
      clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET!,
    },
  });

  return app;
}

export function getWebhookSecret(): string {
  return process.env.GITHUB_WEBHOOK_SECRET!;
}
