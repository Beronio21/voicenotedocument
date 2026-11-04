# Phase 5 — Local Note Accumulation & Management

**Goal.** Accumulate voice and text notes throughout the day, group them by date, and persist them using browser `localStorage` without a backend database. Allow the user to generate a single synthesized report per day and explicitly delete stored days.

## Build

- **Local Storage Management:**
  - Implement a client-side state solution (e.g., a React hook with `localStorage` or `zustand` with `persist`) to save captured notes.
  - Data structure should store objects containing: `id`, `text`, `timestamp` (ISO string), and `is_generated_report` (boolean).
- **UI Updates (Staging Area):**
  - Create a "History" or "Inbox" sidebar/section.
  - Group the saved notes by their calendar date (e.g., "Tuesday, Nov 3", "Wednesday, Nov 4").
  - Under each date group, list the raw captured notes chronologically (morning, afternoon, evening).
- **Daily Actions:**
  - Add a **"Generate Final Report"** button next to each date group. When clicked, concatenate all raw notes from that specific date into one combined string, and POST it to `/api/structure` for the local Ollama model to synthesize.
  - Add a **"Delete"** (trash icon) button next to each date group and/or individual notes. Clicking this must immediately remove the data from the UI state and `localStorage`.

## Constraints for Agent
- **No Database:** Do NOT use Supabase, PostgreSQL, or any external database. Rely purely on the browser's `localStorage` API.
- **Ollama Payload:** Ensure the `keep_alive: 0` parameter is still present in the Ollama fetch request so the model doesn't lock up memory when generating these large daily batches.
- **Prompt Engineering:** When sending the concatenated string to Ollama, prefix it with a system instruction like: "Synthesize the following chronological notes from today into a single, cohesive, well-formatted report."

## Acceptance check
1. Capture three separate notes. 
2. Refresh the browser; the notes must still be visible and grouped under today's date.
3. Click "Generate Final Report" for today's date. The Ollama stream should synthesize all three notes into one document.
4. Click the "Delete" button for the day. All notes and the report for that day must disappear from the UI and local storage.