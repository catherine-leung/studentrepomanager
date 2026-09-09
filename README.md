# Student Repo Manager

Automated repository management for classroom GitHub assignments.

## Quick Start

1. **[Setup Guide](./docs/SETUP.md)** — Install the GitHub App, configure your organization, and deploy
2. **[Professor Guide](./docs/PROFESSOR.md)** — Create and manage assignment links
3. **[Student Guide](./docs/STUDENT.md)** — Redeem links and clone repositories
4. **[Troubleshooting](./docs/TROUBLESHOOTING.md)** — Common issues and fixes

## Features

- **Solo assignments** — Each student gets their own repository
- **Group assignments** — Students form teams and share a repository
- **Course documents** — Shared read-only repository for all students
- **Template support** — Create repos from a template
- **Automatic org setup** — Security settings applied on installation
- **Idempotent redemption** — Students can redeem multiple times safely

## Technology

- **Frontend:** Next.js 16, React 19, Tailwind CSS
- **Backend:** Next.js API Routes, TypeScript
- **Database:** Neon PostgreSQL
- **Auth:** NextAuth.js v4, GitHub OAuth
- **GitHub Integration:** Octokit (App + REST)

## Development

```bash
npm install
npm run dev
```

## Deployment

See [Setup Guide](./docs/SETUP.md) for Vercel deployment instructions.

## License

MIT

Open http://localhost:3000.