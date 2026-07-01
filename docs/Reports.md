# Reports

## Overview

The bot automatically generates reports for managers.

Reports should be concise, easy to read, and focus on trends rather than individual incidents.

Reports are posted automatically to the Manager Google Chat space.

---

# Report Types

The application generates

- Daily Report
- Weekly Report
- Monthly Report

Reports should also be available through slash commands.

---

# Daily Report

Generation Time

11:05

Asia/Seoul

The report summarizes the completed work shift.

Include

- Total check-ins
- Responses
- Missed check-ins
- Average response time
- Fastest response
- Slowest response
- Response rate

---

# Daily Report Format

Example

----------------------------------------

📊 Daily Wellness Report

Date

2026-07-01

Employee

Michael

Check-ins

14

Responses

13

Missed

1

Response Rate

92.9%

Average Response

1m 34s

Fastest

18s

Slowest

8m 41s

----------------------------------------

AI Summary

"Overall engagement was excellent today. Response times remained consistent throughout the shift and quizzes generated the fastest interactions."

----------------------------------------

---

# Weekly Report

Generated every Monday.

Include

- Total check-ins
- Total responses
- Total misses
- Average response time
- Daily averages
- Best day
- Lowest response day
- Improvement percentage

Claude should generate a short natural-language summary.

---

# Monthly Report

Generated automatically on the first day of every month.

Include

Monthly averages

Response trends

Lead time trend

Miss trend

Response rate

Longest delay

Fastest response

Most successful content category

Least successful content category

Claude summary

---

# AI Insights

Claude should analyze interaction data.

Examples

Employees responded faster to quizzes.

Programming jokes generated the most replies.

Coffee-related conversations received high engagement.

Morning response time improved compared to last week.

Insights should remain positive and constructive.

---

# Leaderboard

Optional

Fastest average response

Highest response rate

Longest improvement streak

Most quiz wins

Most active participant

Leaderboards should be encouraging rather than competitive.

---

# Personal Report

Employees may request

/report

The bot replies privately (or in thread) with

Today's statistics

Average response

Response rate

Misses

Current streak

Positive encouragement

---

# Manager Report

Managers may request

/report today

/report week

/report month

/report employee <name>

The report should include only authorized information.

---

# Trend Analysis

Store enough history to calculate

7-day trend

30-day trend

Monthly averages

Rolling response time

Improvement percentage

---

# Export

Future support

CSV

Excel

JSON

PDF

The reporting module should be designed so additional export formats can be added later.

---

# Charts

Do not generate images initially.

Instead, prepare structured data that can later be rendered by a dashboard.

Examples

Daily response time

Response rate

Miss history

Content category performance

---

# Notifications

The bot may notify managers when

- repeated missed check-ins occur
- response rate drops significantly
- unusually slow response patterns are detected

Notifications should be informative, not alarming.

---

# Data Retention

Keep reports indefinitely unless configured otherwise.

Historical reports should remain available for trend analysis.

---

# Report Reliability

Report generation must never block the scheduler.

If report generation fails

Retry.

Log the failure.

Generate again on the next retry cycle.

Never lose historical data because of a temporary failure.