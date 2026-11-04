# Phase 3 — Chat UI Overhaul & Local LLM Structuring

**Goal.** Transmit the raw transcript to the local Ollama instance, format it, and overhaul the entire workspace UI into a chat-style interface to display the results sequentially.

## Build

- Create a Next.js Route Handler at `app/api/structure/route.ts` to accept POST requests and fetch structured Markdown from the local Ollama API (using `gemma4:e2b` or `llama32-1b-64k`).
- **Complete UI Redesign:** Replace the static dashboard layout with a full-height chat interface.
  - The main area should be a scrollable message history.
  - The input area (microphone and text input) should be pinned to the bottom of the screen.
- **Message Rendering:**
  - User inputs (raw voice transcripts or typed text) should appear as message bubbles on the right (like the purple audio bubble in the reference).
  - The AI's structured Markdown documents should appear as message bubbles on the left (like the gray text bubble in the reference).
  - Add a PDF download icon/button strictly within the AI's response bubbles (the functionality for this button will be built in Phase 5).

## Constraints for Agent
- Completely discard the current hero section ("Make space for the next thought") to maximize vertical space for the chat history.
- Ensure the input bar at the bottom retains both the "Start recording" button and the text input field.
- Ensure the chat container auto-scrolls to the bottom when new messages arrive.
- Use `react-markdown` to render the AI's response inside the left-aligned message bubbles.

## Acceptance check

1. The UI is a full-height chat window with the input bar at the bottom.
2. Record or type a note: your raw text appears as a message bubble on the right side of the screen.
3. After a brief loading state, the structured Markdown document from Ollama appears as a message bubble on the left side of the screen, complete with a placeholder PDF download button.