# Built on Google AI

[Back to README](../README.md)

Jarvis needs real-time voice, reliable tool calling, a way to act on websites, and live facts. Gemini gives us all of it in one family, Gemma keeps costs down, and everything runs on Vertex AI and Cloud Run.

## Models

### Gemini Live: the voice

- Real-time, two-way audio conversation that the user can interrupt.
- Works in Hindi, English and other Indian languages, which directly solves the "English and keyboard" problem.
- Runs the voice lane: listening, short spoken updates while work happens, and reading back actions for approval.

### Gemini on Vertex AI: the brain

- Gemini 3.1 Flash-Lite plans by default, with hedged fallbacks to Gemini 3.5 and 3.6 Flash when a model is busy.

- Reads what the user wants and plans the steps.
- Calls skills through **function calling**, with every call validated against a schema.
- Checks each result before telling the user the task is done.
- Uses long context to pull in relevant memory (people, preferences, past chats).

### Gemma: the router

- A small, fast model that sorts every message before the big model runs: question or task, and which skill.
- Keeps Jarvis affordable as usage grows.
- Opens a path to running parts of Jarvis on the device later, for privacy.

### Gemini Computer Use: the cloud computer

- Gemini 3.5 Flash on Vertex AI drives a real Chromium browser on Cloud Run, one screenshot and one action at a time.
- Google Search grounding finds the right starting page first, so it does not waste steps.
- Its screen plays live in the chat. It stops before submitting, paying or sending, and never types passwords.

### Google Search grounding: live facts

- Live, cited answers for places, news and prices, on Vertex AI.
- Research questions run up to four searches and come back with headings, tables and sources.

## Tools

| Tool | How we use it |
|------|---------------|
| **Google AI Studio** | Prototype and test planner prompts, function-calling schemas and Gemini Live voice flows before they go into Jarvis |
| **Google Antigravity** | Agent-first development of each new integration, so a small team can add apps quickly |
| **@google/genai SDK** | One SDK for the Gemini API, Vertex AI and Gemini Live |

## Why this split works

| Without the split | With the split |
|-------------------|----------------|
| Every message goes to the biggest model | Gemma handles the easy sorting, Gemini handles the real work |
| The user waits in silence while a task runs | Gemini Live keeps talking while the work lane runs in the background |
| The model decides what is allowed | Code decides what is allowed, the model only plans |
