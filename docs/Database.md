# Database

Database

SQLite

ORM

Prisma

The database should remain lightweight and require zero manual maintenance.

---

# Employee

Stores employee information.

Fields

id

name

email

googleChatUserId

timezone

workStart

workEnd

lunchStart

lunchEnd

enabled

createdAt

updatedAt

Example

Michael

Asia/Seoul

02:00

11:00

04:00

05:00

enabled=true

---

# CheckIn

One record is created every scheduled check-in.

Fields

id

employeeId

scheduledTime

firstMessageTime

replyTime

leadTimeSeconds

status

OPEN

RESPONDED

MISSED

EXPIRED

messageId

conversationId

createdAt

---

# Reminder

Stores reminder history.

Fields

id

checkInId

level

message

sentAt

Levels

1

2

3

---

# MessageHistory

Stores every message exchanged.

Fields

id

checkInId

direction

BOT

EMPLOYEE

SYSTEM

message

createdAt

This table allows rebuilding the complete conversation for debugging if needed.

---

# AIMessageHistory

Stores generated AI content.

Purpose

Avoid repeating topics.

Fields

id

category

title

summary

hash

generatedAt

usedAt

The bot should avoid generating content similar to the last 30 days.

Claude Code may receive recent history to avoid duplicates.

---

# DailyReport

Fields

id

date

employeeId

totalCheckIns

responses

misses

averageLeadTime

longestLeadTime

responseRate

generatedAt

---

# SystemLog

Stores important application events.

Fields

id

level

module

message

createdAt

Examples

Application Started

Scheduler Started

Google Chat Error

Claude Error

Retry

Database Error

Report Generated

---

# Settings

Global configuration stored in database.

Fields

key

value

Examples

CHECK_INTERVAL

30

FIRST_TIMEOUT

300

SECOND_TIMEOUT

300

THIRD_TIMEOUT

300

AI_HISTORY_DAYS

30

REPORT_TIME

11:05

---

# Relationships

Employee

↓

CheckIn

↓

Reminder

↓

MessageHistory

Employee

↓

DailyReport

AIMessageHistory is independent.

Settings is global.

---

# Database Rules

Never delete CheckIns.

Never delete Reports.

Automatically archive old logs after 90 days.

Automatically delete AI history older than 180 days.

Use transactions whenever multiple tables are updated.

Every write operation should use Prisma.

No raw SQL unless absolutely necessary.

---

# Startup

When application starts

Run Prisma migration automatically if needed.

Seed default settings if database is empty.

Create required indexes.

Continue unfinished check-ins if application restarted.

---

# Backup

Every day after report generation

Compress SQLite database

↓

backup/

↓

Keep latest 30 backups.

Backup should never interrupt the running application.