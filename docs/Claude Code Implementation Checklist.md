# Claude Code Implementation Checklist

## Objective

Build a production-ready Google Chat Wellness Bot based on the project documentation.

The implementation should prioritize simplicity, maintainability, reliability, and low resource usage.

Target deployment is a single Docker container running on a small Ubuntu VM.

---

# Phase 1 - Project Initialization

- Create NodeJS 22 TypeScript project
- Configure ESLint
- Configure Prettier
- Configure tsconfig
- Configure environment loading
- Create Dockerfile
- Create docker-compose.yml
- Create .dockerignore
- Create .gitignore
- Configure Winston logging
- Create health endpoint

Deliverable

Application starts successfully inside Docker.

---

# Phase 2 - Database

Create Prisma project.

Create SQLite database.

Create models

- Employee
- CheckIn
- Reminder
- MessageHistory
- AIMessageHistory
- DailyReport
- Settings

Generate Prisma Client.

Create initial migration.

Seed default settings.

Deliverable

Database initializes automatically.

---

# Phase 3 - Core Services

Implement

Config Service

Logger Service

Database Service

Time Service

Scheduler Service

AI Service

Google Chat Service

Report Service

Keep all services independent.

Deliverable

All services compile and can be injected into other modules.

---

# Phase 4 - Google Chat

Implement

Webhook endpoint

Outgoing messages

Thread replies

Mentions

Slash commands

Webhook validation

Retry logic

Duplicate protection

Deliverable

The bot can send and receive messages successfully.

---

# Phase 5 - Scheduler

Implement

Working hours

Lunch break

US weekend detection

30-minute check-ins

Reminder timers

Timeouts

Lead time calculation

Miss detection

Recovery after restart

Deliverable

Scheduler operates correctly through a complete workday.

---

# Phase 6 - Claude Code Integration

Create a dedicated AI Service.

The AI Service is responsible for all interactions with Claude Code.

Requirements

- Reuse the existing authenticated Claude Code OAuth session.
- Generate dynamic content.
- Generate reminder messages.
- Generate follow-up replies.
- Generate daily, weekly, and monthly summaries.
- Cache generated content.
- Avoid recently used topics.
- Retry transient failures.
- Never expose authentication details.

The implementation should make it easy to replace Claude Code with another provider in the future.

Deliverable

AI-generated conversations work without using hardcoded templates.

---

# Phase 7 - Reporting

Generate

Daily reports

Weekly reports

Monthly reports

Manager reports

Personal reports

Trend calculations

AI summaries

Deliverable

Reports are posted automatically to the manager Google Chat space.

---

# Phase 8 - Reliability

Implement

Retry logic

Graceful shutdown

Recovery after restart

Database backup

Log rotation

Health checks

Error handling

Deliverable

The application continues operating after transient failures.

---

# Phase 9 - Testing

Unit tests

Scheduler

Database

AI Service

Google Chat Service

Report Service

Integration tests

Complete workday simulation

Restart recovery

Webhook flow

Reminder flow

Deliverable

Core business logic is covered by automated tests.

---

# Phase 10 - Production

Verify

Docker deployment

Environment validation

Database migration

Health endpoint

Logging

Backup

Resource usage

README

Deployment documentation

Deliverable

The application is ready for production deployment.

---

# Code Quality

Follow

- TypeScript strict mode
- SOLID principles
- Dependency Injection
- Repository pattern where appropriate
- Small focused modules
- Async/await
- Proper error handling
- Comprehensive logging

Avoid unnecessary abstractions.

Do not over-engineer.

---

# Performance Goals

Target server

Ubuntu 24.04

1 CPU

1 GB RAM

Expected runtime

Memory

<250MB

CPU

<5% average

The scheduler should support at least 100 employees without significant architectural changes.

---

# Acceptance Criteria

The project is considered complete when

- Runs inside a single Docker container.
- Uses SQLite through Prisma.
- Uses Google Chat as the primary interface.
- Uses Claude Code with the existing OAuth authentication as the primary AI provider.
- Generates fresh AI content every day.
- Tracks response time accurately.
- Sends reminders correctly.
- Produces daily, weekly, and monthly reports.
- Automatically recovers after restart.
- Has automated tests for the core business logic.
- Can be started with:

docker compose up -d

without requiring manual setup beyond configuration.

---

# Future Improvements

Possible future enhancements

- Multi-employee scheduling UI
- Web dashboard
- Slack support
- Microsoft Teams support
- Discord support
- Telegram support
- PostgreSQL support
- Grafana metrics
- Prometheus integration
- AI personalization based on employee preferences
- Content category analytics
- Multiple AI provider support
- Plugin system