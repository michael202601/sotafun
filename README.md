# Google Chat Wellness Bot

A lightweight NodeJS/TypeScript bot that keeps a team engaged during the workday
through friendly, AI-generated Google Chat check-ins. It tracks response times,
sends gentle reminders, and posts daily wellness reports to a manager space.

Content is generated dynamically by **Claude Code** (reusing the machine's
authenticated OAuth session) — never from hardcoded templates.

## Features (MVP)

- ⏰ **Scheduler** — 30-minute check-ins during working hours (Asia/Seoul
  02:00–11:00), skips lunch (04:00–05:00) and US weekends. Runs on `node-cron`,
  all state persisted in SQLite so it recovers after a restart.
- 🤖 **AI content** — fresh, non-repeating messages via Claude Code, with a
  cache fallback and minimal static fallback if the AI is unavailable.
- 💬 **Google Chat** — threaded check-ins, escalating reminders (friendly →
  funny → playful), reply detection with lead-time tracking, slash commands.
- 📊 **Daily report** — per-employee stats + positive AI summary posted to the
  manager space at 11:05 (Asia/Seoul).
- ❤️ **Health check** — `GET /health` reports database / Claude / Google Chat /
  scheduler status; used by Docker.

## Quick start

```bash
cp .env.example .env
# edit .env: Google Chat spaces, service-account path, verification token
docker compose up -d
```

Everything runs in a single container. SQLite lives on the mounted `./data`
volume; logs, cache and backups are mounted too.

### Requirements

- A **Google service account** JSON key with Google Chat API access, mounted at
  the path set in `GOOGLE_SERVICE_ACCOUNT_FILE` (default `/data/service-account.json`).
- Two Google Chat spaces: one for employees, one for managers
  (`GOOGLE_CHAT_EMPLOYEE_SPACE`, `GOOGLE_CHAT_MANAGER_SPACE`).
- An authenticated **Claude Code** session on the host. The compose file mounts
  `~/.claude` into the container so the CLI reuses it. Override the host path via
  `CLAUDE_CONFIG_DIR` if needed.

## Local development

```bash
npm install
cp .env.example .env
DATABASE_URL="file:./data/database.db" npx prisma migrate dev
npm run dev          # tsx watch
npm run typecheck
npm run lint
```

## Configuration

All settings come from environment variables (see `.env.example`). Timing and
report values are also seeded into the `Settings` table and can be tuned there.

| Variable | Meaning | Default |
| --- | --- | --- |
| `CHECK_INTERVAL` | Minutes between check-ins | `30` |
| `FIRST/SECOND/THIRD_REMINDER` | Minutes between reminder levels | `5` |
| `REPORT_TIME` | Daily report time (Asia/Seoul) | `11:05` |
| `AI_HISTORY_DAYS` | Days to avoid repeating AI topics | `30` |
| `CLAUDE_TIMEOUT_MS` | Max wait per Claude generation | `60000` |

## Slash commands

- `/ping` — check the bot is online
- `/status` — your current check-in status
- `/report` — your stats for today
- `/help` — list commands

## Architecture

```
Google Chat ─▶ /webhook ─▶ Router ──▶ CheckIn (reply → lead time)
Scheduler (node-cron, 1 min tick)
   ├─ create check-ins  ──▶ AI Service ──▶ Claude Code CLI
   ├─ reminders/timeout ──▶ Google Chat
   └─ 11:05 ─▶ Report Service ──▶ Manager space
SQLite (Prisma) persists all state
```

Each subsystem is an isolated service wired in `src/app/context.ts`. The AI
module depends only on the `AIProvider` interface, so Claude Code can be swapped
for another provider without touching business logic.

See [`docs/`](docs/) for the full specification and the phase-2 roadmap
(weekly/monthly reports, leaderboard, follow-up replies, backups, tests).
