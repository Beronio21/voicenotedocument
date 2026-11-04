# Phase 2 — Azure Speech Transcription & Input Routing

**Goal.** Transmit the client-captured audio Blob to a secure Next.js Route Handler for Azure transcription, OR gracefully bypass transcription if the user utilized the manual text input.

## Build

- Install the Azure Speech SDK (`npm install microsoft-cognitiveservices-speech-sdk`).
- Create a Next.js Route Handler at `app/api/transcribe/route.ts` to process incoming `POST` requests containing audio form data.
- Configure the Azure `SpeechConfig` inside the route handler using `process.env.AZURE_SPEECH_KEY` and `process.env.AZURE_SPEECH_REGION`.
- Implement a Push Audio Stream to feed the received audio buffer into the `SpeechRecognizer`.
- Update the client-side `VoiceRecorder` component to handle input routing:
  - **Audio Path:** If the user records audio, `POST` the generated audio Blob to `/api/transcribe` and display the returned raw transcript.
  - **Text Path:** If the user types into the "Write a note instead" box and submits, completely bypass the Azure `/api/transcribe` route and set the typed text as the current raw transcript.

## Constraints for Agent

- **Preserve UI:** Do NOT remove or break the "Write a note instead" text area that was built in Phase 1. 
- **Security:** Do NOT expose the Azure keys to the browser. All Azure SDK execution must happen strictly server-side within the Route Handler.
- **Decoupling:** Do not implement the Local AI / Ollama logic in this phase. The output must strictly be the raw string displayed in the UI, regardless of whether it came from Azure or the text box.
- **Error Handling:** Add a `try/catch` block in the API route to return a 500 status with an explicit error message if the Azure connection fails.

## Acceptance check

1. Type a message into the text area and submit: the UI skips the "Transcribing" state and instantly displays your typed text as the raw transcript.
2. Record a 5-second voice note saying, "Testing the Azure speech connection": the UI enters a "Transcribing..." loading state.
3. The server successfully proxies the audio to Azure, and the exact speech transcript appears on the screen.
4. Temporarily invalidate the `AZURE_SPEECH_KEY` in `.env.local` and record audio again: the UI gracefully displays a transcription failure error instead of crashing.

## Not in this phase
Local LLM structuring, Markdown rendering, or PDF generation.