# Built on Google AI

[Back to README](../README.md)

Jarvis needs three things from its AI: real-time voice, reliable tool calling, and long context for memory. Gemini gives us all three in one family, and Gemma lets us keep costs down.

## Models

### Gemini Live: the voice

- Real-time, two-way audio conversation that the user can interrupt.
- Works in Hindi, English and other Indian languages, which directly solves the "English and keyboard" problem.
- Runs the voice lane: listening, short spoken updates while work happens, and reading back actions for approval.

### Gemini API: the brain

- Reads what the user wants and plans the steps.
- Calls skills through **function calling**, with every call validated against a schema.
- Checks each result before telling the user the task is done.
- Uses long context to pull in relevant memory (people, preferences, past chats).

### Gemma: the router

- A small, fast model that sorts every message before the big model runs: question or task, and which skill.
- Keeps Jarvis affordable as usage grows.
- Opens a path to running parts of Jarvis on the device later, for privacy.

## Tools

| Tool | How we use it |
|------|---------------|
| **Google AI Studio** | Prototype and test planner prompts, function-calling schemas and Gemini Live voice flows before they go into Jarvis |
| **Google Antigravity** | Agent-first development of each new integration, so a small team can add apps quickly |
| **Google Agent Skills** | Each ability (email, calendar, WhatsApp, booking) is packaged as its own skill. Jarvis loads only the skill a task needs, which keeps the core agent small, fast and predictable |

## Why this split works

| Without the split | With the split |
|-------------------|----------------|
| Every message goes to the biggest model | Gemma handles the easy sorting, Gemini handles the real work |
| The user waits in silence while a task runs | Gemini Live keeps talking while the work lane runs in the background |
| The model decides what is allowed | Code decides what is allowed, the model only plans |
