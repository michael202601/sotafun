# Architecture

## Overview

The system consists of a single Docker container running a NodeJS application.

The application is responsible for:

- Receiving Google Chat events
- Sending Google Chat messages
- Scheduling periodic check-ins
- Communicating with Claude Code
- Recording statistics
- Generating reports
- Providing health checks

Everything should run inside one container to simplify deployment.

---

## Technology Stack

Runtime

- NodeJS 22
- TypeScript

Framework

- Express

Database

- SQLite
- Prisma ORM

Scheduler

- node-cron

Logging

- Winston

Timezone

- Luxon

Container

- Docker
- Docker Compose

AI

- Claude Code using the authenticated OAuth session already available on the machine.

---

## High Level Flow

Google Chat

↓

Webhook

↓

Express Server

↓

Message Router

↓

Scheduler

↓

Claude Code

↓

Google Chat

↓

SQLite

↓

Daily Report

---

## Modules

src/

app/

google-chat/

scheduler/

ai/

database/

report/

config/

middleware/

utils/

---

## AI Module

Responsibilities

- Generate new messages
- Avoid repeated topics
- Remember recent history
- Generate reminder messages
- Generate daily summary
- Generate funny comments for reports

The AI module should be isolated so another LLM can be used in the future without changing other modules.

---

## Scheduler Module

Responsibilities

- Start check-ins
- Skip lunch break
- Skip US weekends
- Handle reminders
- Handle timeout
- Mark missed check-ins

Scheduler should never block the main thread.

---

## Database Module

Responsible for

- Employees
- Check-ins
- Statistics
- AI history
- Reports

All database access should go through Prisma.

---

## Google Chat Module

Responsible for

- Sending messages
- Receiving replies
- Parsing events
- Sending reports

Should automatically retry failed API requests.

---

## Report Module

Generate

- Daily report
- Weekly report
- Monthly report

Reports should be posted automatically to the manager group.

---

## Logging

Every important event should be logged.

Examples

Application started

Claude request

Claude response

Google Chat request

Scheduler started

Reminder sent

Employee replied

Employee missed

Report generated

Error occurred

---

## Error Handling

If Google Chat fails

Retry 3 times.

If Claude Code fails

Retry once.

If still failed

Use cached AI content.

If database fails

Retry.

Log every failure.

---

## Health Check

Provide endpoint

GET /health

Response

{
    "status": "ok",
    "database": "ok",
    "claude": "ok",
    "google_chat": "ok",
    "scheduler": "ok"
}

Docker should use this endpoint for health checks.

---

## Performance

Target VM

1 CPU

1 GB RAM

Expected usage

CPU

< 5%

Memory

< 200 MB

The application should stay lightweight.

---

## Coding Standards

- TypeScript strict mode
- Async/await only
- ESLint
- Prettier
- Repository pattern
- SOLID principles
- Environment variables for configuration
- No hardcoded secrets

Keep the implementation simple and maintainable.