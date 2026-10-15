# Free Higgsfield

## Validation

- Use the existing checkout; cloud tasks are already isolated. Do not create a worktree unless requested.
- Use Node.js 22 or newer. Install with `npm ci`, validate behavior with `npm test`, and run `npm run build` before publishing changes.
- Keep real credentials out of source, Git, logs, and chat. `.env.example` contains names and non-secret defaults only.

## Publishing authorization

The owner explicitly authorized committing and pushing updates to this application's GitHub repository and then deploying them to Vercel, including future application updates. Proceed with these steps after validation without asking for the same authorization again.

- Repository: `sergiofariaseng/Free-Higgsfield`; application branch: `main`.
- Deploy only this application's intended Vercel project. Verify project/account identity before deployment. If access or project identity is missing, complete independent work and request only the missing connection or information.
- Do not force-push, delete history, expose credentials, or change unrelated repositories/projects under this authorization.
- `studio-storage` holds generated media and must not be merged into `main` or deployed.
- Report the commit, actual deployment result, and any unresolved runtime configuration. A successful build alone is not a successful deployment.
