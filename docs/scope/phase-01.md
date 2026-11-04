# Phase 1 — Audio Capture & Workspace UI

**Status**: done
**Code**: `app/page.tsx`, `app/components/VoiceRecorder.tsx`, `app/globals.css`

The workspace also accepts a local text note as an alternative capture method.

**Goal.** Build the core recording interface, handle browser microphone permissions, and capture raw user audio into a temporary `.webm` or `.wav` Blob using the standard Web `MediaRecorder` API.

## Build

- Transform the landing page into the main workspace UI, featuring a clean, distraction-free design.
- Create a client component (e.g., `VoiceRecorder`) to manage the recording state.
- Implement the `MediaRecorder` API to request microphone access and record audio streams.
- Implement UI states and visual feedback for:
  - **Idle:** Ready to record (Start button).
  - **Recording:** Active microphone capture (Stop button, maybe a simple CSS pulse animation or timer).
  - **Error:** Microphone access denied or hardware error.
- Assemble the captured audio chunks into a single Blob in memory when the recording stops.

## Constraints for Agent

- **No Backend APIs:** Do not implement Azure Speech Services or Local AI routes in this phase.
- **No Cloud Storage:** Store the resulting audio Blob purely in client-side React state for now (you can log its size to the console to verify it works).
- **Graceful Failures:** If the user denies microphone permissions, the app must catch the `NotAllowedError` and display a friendly UI message, rather than crashing or throwing an unhandled runtime error.
- **Component Boundaries:** Ensure the `MediaRecorder` logic is strictly inside a `"use client"` component.

## Acceptance check

1. Click the "Start Recording" button: the browser prompts for microphone permissions.
2. Grant permissions: the UI instantly updates to an active "Recording..." state.
3. Click "Stop Recording": the UI returns to Idle, and the browser console logs a generated audio Blob with a size greater than 0 bytes.
4. Refresh the page, click "Start Recording", and explicitly deny microphone permissions: the UI handles it gracefully and displays an error message without breaking the layout.

## Not in this phase
API Route Handlers, Azure SDK integration, LLM integration, database storage for audio, or PDF generation.