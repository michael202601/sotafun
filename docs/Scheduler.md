# Scheduler

## Overview

The Scheduler is the core of the application.

It is responsible for deciding when to create a new check-in, when to send reminders, when to stop reminders, and when to generate reports.

The scheduler should be deterministic, lightweight, and fault tolerant.

---

# Timezone

Server Time

UTC

Business Time

Asia/Seoul

Weekend

America/New_York

Always use Luxon for timezone calculations.

Never use native JavaScript Date for business logic.

---

# Working Schedule

Timezone

Asia/Seoul

Working Hours

02:00 → 11:00

Lunch Break

04:00 → 05:00

Weekend

Saturday and Sunday based on America/New_York timezone.

No check-ins should be scheduled outside working hours.

---

# Scheduler Tick

Run every minute.

Each tick should determine whether a new check-in should be created.

Do not rely on Linux cron.

Use node-cron.

---

# Check-in Interval

Default interval

30 minutes

The interval should be configurable.

Default daily schedule

02:30

03:00

03:30

05:30

06:00

06:30

07:00

07:30

08:00

08:30

09:00

09:30

10:00

10:30

The scheduler should calculate these dynamically rather than using hardcoded timestamps.

---

# Check-in Lifecycle

NEW

↓

Message Sent

↓

Waiting

↓

Employee Replied

↓

Completed

or

Waiting

↓

Reminder 1

↓

Reminder 2

↓

Reminder 3

↓

Missed

---

# Reminder Policy

After first message

Wait 5 minutes.

If no response

Send Reminder #1.

Wait another 5 minutes.

If no response

Send Reminder #2.

Wait another 5 minutes.

If still no response

Send Reminder #3.

Wait 5 minutes.

If still no response

Mark as MISSED.

Stop processing.

Timeout values should be configurable.

---

# Reminder Style

Reminder 1

Friendly

Reminder 2

Funny

Reminder 3

Playful

Claude Code should generate reminder messages dynamically instead of using fixed templates.

The tone should never become aggressive.

---

# Response Detection

The first employee message after a check-in completes the session.

Ignore additional messages for lead time calculation.

Additional replies remain part of the conversation but do not affect metrics.

---

# Lead Time

leadTime

=

replyTime

-

firstMessageTime

Store in seconds.

Display in

minutes

seconds

---

# Missed Check-in

A session becomes MISSED when

- all reminders have been sent
- timeout expires
- no employee reply exists

Once MISSED

No more reminders.

No reopening.

---

# Lunch Break

If lunch begins while a check-in is still active

Continue waiting until timeout.

Do not create any new check-ins during lunch.

---

# End of Shift

Do not create new check-ins after 10:30.

Allow existing conversations to finish.

Generate report after all active sessions complete.

---

# Restart Recovery

If the container restarts

Load unfinished sessions.

Resume timers.

Do not create duplicate reminders.

The application should recover automatically.

---

# Duplicate Protection

Each scheduled check-in has a unique identifier.

Never create two check-ins for the same employee at the same scheduled time.

Ignore duplicate Google Chat events.

---

# Scheduler State

Possible states

IDLE

WAITING

REMINDER_1

REMINDER_2

REMINDER_3

RESPONDED

MISSED

EXPIRED

The state should be stored in the database.

Do not rely on in-memory state only.

---

# Daily Report

Generate automatically.

Default

11:05

Asia/Seoul

The report should summarize the entire working day.

---

# Weekly Report

Generate every Monday after the daily report.

---

# Monthly Report

Generate on the first day of each month.

---

# AI Scheduling

Claude Code should only be invoked when content is needed.

Examples

- New check-in
- Reminder
- Follow-up reply
- Daily summary
- Weekly summary
- Monthly summary

Avoid unnecessary AI requests.

---

# Retry Policy

Google Chat

Retry 3 times.

Claude Code

Retry 2 times.

Database

Retry until transaction succeeds or timeout.

Every retry should be logged.

---

# Monitoring

The scheduler should expose metrics.

Examples

Current active sessions

Pending reminders

Today's check-ins

Today's misses

Average lead time

These metrics may be displayed on a future dashboard.

---

# Performance

The scheduler should support multiple employees without significant resource usage.

Target

100+ employees

Running comfortably on

1 CPU

1 GB RAM

The implementation should prioritize simplicity, reliability, and low memory usage.