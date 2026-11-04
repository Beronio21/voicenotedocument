# Phase 4 — Streaming Local AI Responses

**Goal.** Convert the local LLM integration from a static fetch to a streaming architecture. This will bypass the Next.js 60-second execution timeout and provide a real-time "typing" effect in the UI as Ollama generates the document.

## Build

- **API Route Update:** Modify the Next.js Route Handler at `app/api/structure/route.ts`. 
  - Change the payload sent to the local Ollama API to include `"stream": true`.
  - Transform the response from Ollama into a standard readable Web Stream.
  - Return the stream to the client using a standard `Response` object or the Vercel AI SDK (`StreamingTextResponse`), ensuring headers are set for chunked transfer encoding (if applicable).
- **Client UI Update:** Modify the chat interface to consume the streamed response.
  - Create a new state variable to hold the incoming text chunks.
  - As chunks arrive from the API, append them to the AI's message bubble state so the user sees the text appearing in real-time.
- **Markdown Handling:** Ensure the `react-markdown` renderer in the UI can gracefully render partial/incomplete Markdown strings while the stream is still incoming.

## Constraints for Agent

- **No Python Required:** Do not switch to a Python backend. Resolve the timeout purely by utilizing Next.js Web Streams (Edge runtime or Node runtime with streaming enabled).
- **Ollama Payload:** Ensure the request to Ollama correctly maps the parameters needed for streaming (e.g., handling the `done` boolean in Ollama's stream chunks).
- **Timeout Removal:** Ensure any hardcoded `AbortController` timeouts in the client fetch or API route are either removed or increased significantly (e.g., 5 minutes) just in case the initial model load takes a moment.

## Acceptance check

1. Ensure the local Ollama instance is running (`ollama run gemma2:2b` or `qwen2.5:1.5b`).
2. Record or type a note in the UI and submit it.
3. Observe the AI message bubble: instead of waiting 60 seconds and failing, the structured Markdown should begin appearing word-by-word (or chunk-by-chunk) almost immediately.
4. The stream completes successfully, and the final structured document renders fully on the screen without any timeout errors in the browser console or terminal.

## Not in this phase
PDF generation or database storage.