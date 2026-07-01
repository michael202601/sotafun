# Deployment

## Goal

The application should be production-ready with minimal setup.

The entire system should run inside Docker.

After cloning the repository, deployment should require only:

```bash
cp .env.example .env

docker compose up -d
```

No manual installation steps should be required.

---

# Runtime Environment

Target Server

Ubuntu 24.04 LTS

Minimum Specification

- 1 CPU
- 1 GB RAM
- 20 GB Disk

Expected Usage

CPU

<5%

Memory

<250MB

---

# Docker

Use Docker Compose.

Containers

- wellness-bot

No additional database container is required.

SQLite should be stored on a mounted volume.

---

# Docker Volumes

Persist the following folders

/data

SQLite database

/logs

Application logs

/cache

AI cache

/backups

Database backups

---

# Directory Structure

project/

docs/

src/

prisma/

scripts/

docker/

logs/

data/

cache/

backups/

Dockerfile

docker-compose.yml

.env.example

README.md

---

# Environment Variables

GOOGLE_CHAT_WEBHOOK

GOOGLE_CHAT_BOT_TOKEN

CLAUDE_CODE_ENABLED=true

TIMEZONE=Asia/Seoul

US_TIMEZONE=America/New_York

CHECK_INTERVAL=30

FIRST_REMINDER=5

SECOND_REMINDER=5

THIRD_REMINDER=5

REPORT_TIME=11:05

DATABASE_URL=file:./data/database.db

LOG_LEVEL=info

---

# Startup

Application should

Load configuration

↓

Validate environment variables

↓

Initialize database

↓

Run Prisma migrations

↓

Start Express server

↓

Register Scheduler

↓

Recover unfinished sessions

↓

Start accepting Google Chat events

---

# Health Check

Endpoint

GET /health

Return

{
    "status": "ok",
    "database": "ok",
    "scheduler": "ok",
    "googleChat": "ok",
    "claude": "ok"
}

Docker should use this endpoint for health monitoring.

---

# Logging

Use Winston.

Separate logs

application.log

scheduler.log

google-chat.log

claude.log

report.log

error.log

Rotate automatically.

Keep logs for 30 days.

---

# Database Backup

After daily report

Compress database

Store in

/backups

Retention

30 backups

Old backups should be deleted automatically.

---

# Restart Policy

Docker

restart: unless-stopped

The application should recover automatically after reboot.

---

# Graceful Shutdown

When Docker stops

Finish current requests

Save scheduler state

Close database

Flush logs

Exit cleanly

---

# Security

Never commit

.env

database.db

OAuth credentials

Logs containing secrets

Ignore these files in Git.

---

# Docker Ignore

node_modules

dist

logs

backups

cache

.env

database.db

---

# Git Ignore

node_modules

dist

logs

cache

backups

.env

database.db

coverage

---

# CI

Recommended

GitHub Actions

Pipeline

Install

↓

Lint

↓

Type Check

↓

Unit Tests

↓

Build

↓

Docker Build

---

# Testing

Minimum

Unit Tests

Scheduler

AI Service

Database

Google Chat Service

Reporting

Integration Tests

Main Scheduler Flow

Google Chat Events

Claude Integration

Report Generation

---

# Monitoring

The application should log

Startup

Shutdown

Scheduler Events

AI Requests

Google Chat Requests

Errors

Retries

Report Generation

No external monitoring service is required initially.

---

# Production Principles

The application should remain

Simple

Reliable

Lightweight

Easy to maintain

Easy to deploy

Easy to extend

Avoid unnecessary infrastructure.

One Docker container should be sufficient for the initial release.