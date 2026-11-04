# Phase 0 — Minimal Landing Page & Cloud Supabase Test


**Goal.** Establish the Next.js 16 App Router shell and render a simple landing page to verify database connectivity with a cloud-hosted Supabase project.

## Build

- Initialize a Next.js App Router project with Tailwind CSS.
- Set up a clean, minimal landing page UI (`app/page.tsx`) with a hero headline: "Voice Note Documents".
- Connect to a cloud-hosted Supabase instance (user will provide `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`).
- Implement a Next.js Server Action that securely initializes the Supabase client and reads a test row from a `connection_tests` table.
- Display the fetched message on the landing page to prove the data pipeline works.

## Constraints for Agent
- Do not use `supabase init` or local Docker commands; the database is hosted entirely in the cloud.
- Do not implement Clerk authentication, Azure Speech, or Local AI routes in this phase.
- Keep styling purely functional (Tailwind utility classes) without complex animations.
- Ensure the database fetch happens on the server side to protect potential future service keys, passing only the resulting data to the client UI.

## Acceptance check

1. Navigate to `localhost:3000`: the Next.js landing page loads with the hero headline.
2. The page successfully displays data fetched directly from the cloud Supabase `connection_tests` table, proving the remote database link is active.
3. No Docker containers are required to run the Next.js application locally.

## Not in this phase
Audio recording UI, API Route Handlers for transcription, LLM integration, or PDF generation.