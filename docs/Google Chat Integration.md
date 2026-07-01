# Google Chat Integration

## Overview

The bot communicates entirely through Google Chat.

There are two Google Chat spaces.

1. Employee Working Group
2. Manager Report Group

The Employee Group is used for all daily interactions.

The Manager Group only receives reports and important alerts.

---

# Communication Style

The bot should feel like a friendly teammate.

Avoid sounding like

- HR
- Monitoring software
- Attendance system
- Security software

The conversation should feel natural.

Examples

✅ "Coffee break is over 😄 Ready for another challenge?"

✅ "Quick quiz! Which planet has the shortest day?"

✅ "Today's programming joke 😂"

Avoid

❌ "Attendance Check"

❌ "Please confirm your presence."

❌ "Response timeout."

---

# Check-in Message

Every check-in starts a new Google Chat thread.

The first message should contain

- AI generated content
- Friendly question
- Invitation to reply

Example

🧠 Today's Question

Which language was created first?

A. Java

B. Python

C. C

Reply with your guess 😄

---

# Thread Usage

Never spam the group.

Every reminder should be posted inside the same thread.

Flow

Bot

↓

Thread created

↓

Employee replies

↓

Conversation continues

The next check-in starts a new thread.

---

# Reminder Messages

Reminder #1

Friendly

Examples

👀 Still there?

Need another coffee?

😄

---

Reminder #2

Funny

Examples

I think your keyboard fell asleep...

Wake it up 😂

---

Reminder #3

Playful

Examples

I'm about to tell your manager that you defeated me by silence 😆

Never sound aggressive.

---

# Employee Response

Everything counts.

Examples

OK

Here

👍

😂

❤️

🔥

Working

Any emoji

Any GIF

Any text

Do not require special commands.

---

# AI Follow-up

If the employee replies,

Claude Code should generate a short follow-up response when appropriate.

Examples

Employee

C

Bot

Correct! 🎉

Employee

😂

Bot

Glad you liked that one 😄

Employee

☕

Bot

Coffee level restored ☕

Keep replies short (1–2 sentences).

Not every reply requires a response to avoid clutter.

---

# Conversation Memory

Claude should receive the current thread history so replies remain natural.

Example

Bot

Yesterday's riddle...

Employee

Keyboard

Bot

Correct!

Today

Bot

Ready for another one? 😄

The bot should feel consistent instead of starting every conversation from scratch.

---

# Commands

Supported commands

/help

Show help.

/status

Current check-in status.

/report

Today's personal statistics.

/skip

Skip the next scheduled check-in.

/ping

Test if bot is online.

Commands should only be available to authorized users where appropriate.

---

# Manager Commands

Managers may use

/report today

/report week

/report month

/report employee Michael

/report leaderboard

The bot should respond with formatted summaries.

---

# Mentions

When sending reminders,

mention the employee.

Example

@Michael

Still awake? 😄

Daily reports should not mention employees unless configured.

---

# Daily Report

Automatically generated after the working shift.

Posted to Manager Group.

Include

Employee

Total Check-ins

Responses

Misses

Average Response Time

Longest Response

Response Rate

Optional AI summary

Example

"Overall response quality was excellent today. Average response time improved by 18% compared to yesterday."

---

# Weekly Report

Generated every Monday.

Include

Daily averages

Trend

Improvement

Misses

Fastest response

Longest delay

AI summary

Suggestions

---

# Monthly Report

Statistics

Trend chart data

Response rate

Average lead time

Miss history

Improvement percentage

Top improvements

---

# Error Handling

If Google Chat API fails

Retry 3 times.

If still failed

Log the error.

Continue processing.

Never crash the application because of a failed message.

---

# Duplicate Protection

Never send the same reminder twice.

Never create duplicate check-ins.

Ignore duplicated webhook events.

Every Google Chat event should be processed exactly once.

---

# Rate Limiting

Avoid sending too many messages.

Respect Google Chat API limits.

Queue outgoing messages if necessary.

---

# Security

Validate every incoming webhook.

Ignore unknown events.

Never trust user input.

Escape markdown when needed.

Do not expose internal errors inside Google Chat.

---

# AI Personality

The bot should gradually build a friendly personality over time.

Examples

"I've got another terrible programming joke 😄"

"You answered really fast today!"

"Looks like coffee is working ☕"

"Yesterday you solved every quiz. Let's see if today's is harder."

The goal is to make employees enjoy interacting with the bot.

The employee should feel like chatting with an AI coworker rather than responding to an attendance system.