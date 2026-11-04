# 0001. Use Gemini for document structuring

**Date**: 2026-11-04
**Status**: Proposed

## Summary

The document structuring route will use Gemini 2.5 Flash through the official
Google Gen AI SDK. It will keep returning plain text chunks so the current UI
continues to render the response as it arrives. Ollama remains an emergency
fallback only when Gemini is unavailable or not configured.

## Context

The current route sends note text to a local Ollama server. This makes document
generation depend on local hardware and prevents reliable use on machines that
cannot run the configured model.

The client already consumes a streamed plain text response from
`/api/structure`. The provider change must preserve that contract, keep API
keys on the server, and support both single notes and daily report batches.

## Requirements

**User stories**:

- As a user, I want my notes structured by Gemini so that generation does not
  depend on my local hardware.
- As a user, I want the response to stream as it is generated so that the
  interface continues to show a typing effect.

**Acceptance criteria**:

- **AC-1**: A valid transcript is sent to Gemini model `gemini-2.5-flash` with
  the daily synthesis instruction and the response is streamed as Markdown
  text from `/api/structure`.
- **AC-2**: The existing client can consume the response without changes to
  its stream reader or Markdown rendering.
- **AC-3**: `GEMINI_API_KEY` is read only on the server and missing or unusable
  Gemini configuration falls back to the existing Ollama route.
- **AC-4**: Empty or invalid transcripts still return HTTP 400, and provider
  failures return a visible structured error when no fallback is available.

## Options considered

### Option 1: Official Google Gen AI SDK

Use `@google/genai` directly in the route and adapt its asynchronous stream
chunks to the existing web stream response.

**Pros**:

- Direct support for Gemini models and streaming.
- Small provider specific surface with no extra abstraction.
- Clear server side ownership of the API key.

**Cons**:

- Provider specific code remains in the route.

### Option 2: Vercel AI SDK

Use a provider adapter and Vercel stream helpers to produce the response.

**Pros**:

- Easier future provider switching.
- Shared abstractions for other AI features.

**Cons**:

- Adds more dependencies for one route.
- Provider behavior becomes less explicit.

## Decision

**Chosen option**: Option 1, Official Google Gen AI SDK.

Use `@google/genai` with model `gemini-2.5-flash`. Preserve the existing
`text/plain` streaming response contract. Attempt Ollama only when Gemini is
unavailable or its configuration is missing.

## Feature design

**Data model sketch**:

No persistent data model changes. Existing browser `localStorage` records remain
unchanged.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/structure` | POST | `transcript:string`, required | streamed Markdown text | server environment key | 400 invalid input, 500 provider failure |

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| Structure transcript | Raw transcript | JSON request body |
| Gemini model choice | `gemini-2.5-flash` | This decision |
| Gemini credentials | API key | `GEMINI_API_KEY` server environment variable |
| Daily report instruction | Synthesis prompt | Existing Phase 5 behavior and this decision |
| Streamed Markdown | Provider generated chunks | Gemini stream, or Ollama fallback |
| Fallback provider | Ollama endpoint and model | Existing `LOCAL_AI_URL` and route configuration |

**Key invariants**:

- API keys never reach the browser.
- The route validates the transcript before contacting a provider.
- The client receives incremental UTF 8 text chunks.
- Gemini is attempted first.
- Ollama is used only when Gemini is unavailable or not configured.
- The daily report instruction remains present for report generation.

**Security model**:

The route is server side and has no user authentication in the current
application. The Gemini key and Ollama configuration remain server environment
values and are never included in the response.

**Configuration required**:

- `GEMINI_API_KEY`: server side Google Gen AI credential.
- `LOCAL_AI_URL`: existing optional Ollama fallback URL.

**Critical test scenarios**:

- POST a valid transcript and confirm the response arrives in multiple text
  chunks, verifies **AC-1** and **AC-2**.
- Remove `GEMINI_API_KEY` and confirm Ollama is used, verifies **AC-3**.
- Make both providers unavailable and confirm a visible HTTP 500 error,
  verifies **AC-4**.
- POST an empty transcript and confirm HTTP 400, verifies **AC-4**.

## Build plan

1. Add the official Google Gen AI SDK and server configuration, satisfies
   **AC-1** and **AC-3**.
2. Replace the Ollama first path with Gemini streaming while preserving the
   existing plain text response contract, satisfies **AC-1** and **AC-2**.
3. Keep the constrained Ollama fallback and explicit provider error handling,
   satisfies **AC-3** and **AC-4**.
4. Run type checks, lint, and the production build, satisfies **AC-1** through
   **AC-4**.

## Consequences

**Positive**:

- Generation no longer depends on local model hardware when Gemini is
  configured.
- The current streaming user experience remains intact.

**Negative or tradeoffs**:

- Gemini introduces an external service dependency and usage cost.
- The route must maintain two provider paths.
- Gemini output and latency may differ from Ollama output.

**Neutral**:

- Browser note persistence and the client stream reader do not change.

## Follow-up

- [ ] Confirm Google AI usage limits and billing settings before production use.

## Migration plan

**Strategy**: Direct replacement with a guarded fallback.

**Phases**:

1. Add Gemini configuration and stream Gemini responses through the existing
   route contract.
2. Retain Ollama only for missing or unavailable Gemini configuration.

**Rollback**: Revert the route and dependency change, then continue using the
existing Ollama implementation.

**Risks**: Provider response shapes, SDK versions, or API limits may change.
The build and stream validation must catch incompatible SDK behavior before
release.
