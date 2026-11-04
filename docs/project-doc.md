# Voice Note Documents

The product decisions behind this build, written before it starts, with the reasoning attached.

## What it is

A web-based workspace tool for capturing raw audio via the browser and processing it into structured, searchable Markdown documents (e.g., meeting minutes, outlines, or journal entries). 

## Processing Model & Cost Strategy

- **Azure Speech Integration:** Used exclusively for fast, highly accurate speech-to-text transcription.
- **Local AI Structuring:** A locally hosted LLM handles all prompt-based text formatting and entity extraction. This hybrid approach ensures premium voice recognition while keeping generative AI token costs at strictly $0.

## UI & Design Philosophy

- **Workspace View:** Clean, distraction-free interface prioritizing the recording state and the final rendered Markdown text.
- **Real-Time Feedback:** Clear status indicators ("Recording", "Transcribing via Azure", "Structuring via Local AI") to keep the user informed during asynchronous pipeline execution.

## The Rule Everything Rests On

**Absolute Pipeline Decoupling.** 
The system must strictly separate the audio capture, the Azure transcription, and the local AI structuring. If the local LLM goes offline, the app must still successfully return and display the raw Azure transcript.

## Scope

- Browser-based audio capture handling microphone permissions and chunk assembly.
- Next.js API route integrating the Azure Speech SDK via Push Audio Streams.
- Next.js API route proxying raw transcripts to the local LLM endpoint.
- Client UI to trigger the pipeline and render the formatted Markdown output.

## Out of Scope (For Initial Phases)

- Persistent database storage (Neon/Supabase) for long-term document history.
- Cloud object storage (Cloudflare R2) for saving the raw audio `.wav` files.
- User authentication and multi-tenant workspaces.

## Interface States

1. **Idle:** Ready to record, showing an empty workspace.
2. **Recording:** Active microphone capture with visual feedback/timer.
3. **Processing:** Pipeline loading states executing Azure and LLM calls sequentially.
4. **Complete:** Rendered Markdown document visible and ready to copy.