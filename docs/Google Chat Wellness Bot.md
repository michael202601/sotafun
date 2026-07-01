## AI Content Generation

The bot should NOT use hardcoded messages.

Instead, every check-in message should be generated dynamically using Claude Code via the authenticated OAuth session available on the server.

Requirements

- Use the existing Claude Code OAuth authentication.
- Generate fresh content for every check-in.
- Avoid repeating previous messages.
- The bot should feel like talking to a real teammate instead of a monitoring tool.
- Messages should be short, friendly, humorous and encourage interaction.
- Keep messages under 80 words.
- Support both English and Korean if needed.
- Avoid offensive, political, religious or sensitive topics.

Content ideas

- Funny short stories
- Dad jokes
- Programming jokes
- Tech news summaries
- AI trivia
- Space facts
- Animal facts
- Coffee facts
- Korean culture
- US culture
- Random interesting facts
- Mini quiz
- Guess the answer
- Emoji challenge
- Brain teaser
- One-minute puzzle
- Motivational quote
- Positive message
- Health reminder
- Stretch reminder
- Eye exercise reminder

Every day should feel different.

The AI should choose different topics automatically and generate original content instead of selecting from predefined templates.

The bot should remember recently used topics and avoid repeating similar content for at least the last 30 days.

If Claude Code is temporarily unavailable, the bot may fall back to a small local cache of previously generated messages. Hardcoded static messages should only be used as the final fallback.

Example interaction

Bot

"🧠 Quick brain teaser!
I have keys but no locks, space but no rooms, and you can enter but not go inside. What am I? Reply with your guess 😄"

Employee

"A keyboard"

Bot

"Correct! 🎉 You're awake today."

---

Bot

"☕ Coffee Fact:
Finland drinks the most coffee per person in the world. What's your coffee count today? ☕"

---

Bot

"😂 Programmer Joke:
Why do programmers prefer dark mode?
Because light attracts bugs."

---

Bot

"🚀 Space Fact:
A day on Venus is longer than its year. Strange, right? Reply with 🤯 if that's new to you!"

---

Bot

"🎯 Today's challenge:
Describe your current mood using only ONE emoji."
