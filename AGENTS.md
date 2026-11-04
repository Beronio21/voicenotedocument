# Voice Note Documents

A serverless web application that captures raw audio via the browser, transcribes it using Azure AI Speech Services, and structures it into formatted Markdown documents using a local LLM.

Why any of these rules exist is in `docs/project-doc.md`. This file contains the directives themselves.

## Stack & Architecture Constraints

- **Framework:** Next.js 16 App Router.
- **Audio Processing:** Web Audio API (`MediaRecorder`) for client-side capture.
- **Transcription API:** Azure Cognitive Services Speech SDK.
- **AI Structuring:** Local LLM (e.g., Ollama running on `localhost:11434`) to eliminate token costs.
- **Styling:** Tailwind CSS (distraction-free, minimal workspace UI).

## How we work

Spec driven. Nothing gets built without a spec.

- `docs/project-doc.md` — What this app is and every decision behind it.
- `docs/specs/phase-NN.md` — Behavior and acceptance checks for each phase.
- This file — System instructions for AI agents.

## Core Directives & Constraints

1. **Strict Phase Isolation:** Work on exactly ONE phase at a time. Do not anticipate or implement features from future phases.
2. **Local AI Priority:** All document structuring MUST route through the local LLM endpoint. Do not implement paid cloud APIs (OpenAI, Anthropic) for text generation.
3. **Decoupled Pipeline:** Audio capture, speech-to-text, and AI structuring must operate as three distinct, independent steps. Do not tightly couple the Azure API call with the LLM API call.
4. **Mutations via Route Handlers:** Use Next.js Route Handlers (`/api/transcribe`, `/api/structure`) to securely proxy requests to Azure and the local LLM. Do not expose Azure keys in client components.
5. **Never break the build:** Type check, lint, and verify builds before declaring a phase complete.