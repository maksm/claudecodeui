# DevContainer Configuration

This DevContainer provides a consistent development environment for Claude Code
UI using VS Code or GitHub Codespaces.

## Features

- **Node.js 20**: Matches production environment (.nvmrc)
- **Pre-installed Tools**: Git, GitHub CLI
- **VS Code Extensions**: ESLint, Prettier, Playwright, Tailwind CSS
- **Auto-setup**: Runs `npm run setup` after container creation
- **Port Forwarding**: Backend (3001), Frontend (5173)
- **Shared .claude Directory**: Mounts local ~/.claude for persistent sessions

## Quick Start

### VS Code

1. Install
   [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
2. Open project in VS Code
3. Press `F1` → "Dev Containers: Reopen in Container"
4. Wait for container to build and setup to complete
5. Run `npm run dev` in integrated terminal

### GitHub Codespaces

1. Click "Code" → "Create codespace on main"
2. Wait for environment to initialize
3. Run `npm run dev` when ready

## What's Included

- ✅ Node.js 20 (Alpine)
- ✅ Git + GitHub CLI
- ✅ ESLint + Prettier (auto-format on save)
- ✅ Playwright for E2E testing
- ✅ Tailwind CSS IntelliSense
- ✅ TypeScript support
- ✅ Automatic dependency installation
- ✅ Environment variable defaults

## Port Forwarding

| Port | Service                    | Auto-Forward |
| ---- | -------------------------- | ------------ |
| 3001 | Backend API + WebSocket    | ✓            |
| 5173 | Vite Dev Server (Frontend) | ✓            |

## Persistence

The container mounts your local `~/.claude` directory to preserve:

- Claude CLI sessions
- Authentication database
- Project metadata

## Customization

Edit `.devcontainer/devcontainer.json` to:

- Add more VS Code extensions
- Change port forwarding rules
- Modify environment variables
- Add custom startup commands

## Troubleshooting

**Container won't start:**

- Ensure Docker is running
- Check Docker has enough memory (recommended: 4GB+)

**Ports not forwarding:**

- Check firewall settings
- Verify ports aren't already in use

**Claude CLI not working:**

- Ensure ~/.claude directory exists locally
- Check that Claude CLI is installed on host machine
- Set `CLAUDE_CLI_PATH` in .env if custom location

## Benefits

✅ **Instant Setup**: No manual dependency installation ✅ **Consistency**: Same
environment for all developers ✅ **Isolation**: Dependencies don't pollute host
system ✅ **VS Code Integration**: Extensions and settings pre-configured ✅
**GitHub Codespaces**: Develop from browser anywhere
