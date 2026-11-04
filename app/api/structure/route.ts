import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const GEMINI_MODEL = "gemini-2.5-flash";
const OLLAMA_MODEL = "gemma4:e2b";

type OllamaStreamChunk = {
  response?: unknown;
  done?: unknown;
  eval_count?: unknown;
  eval_duration?: unknown;
};

function buildPrompt(transcript: string) {
  return [
    "Synthesize the following chronological notes from today into a single, cohesive, well-formatted report.",
    "If the user's input is short and simple, return a brief, cleanly formatted markdown list or paragraph.",
    "Only generate complex sections, headers, or reports if the input is long and multi-faceted.",
    "Preserve the meaning and remove filler words.",
    "Return only the Markdown document, with no surrounding explanation.",
    "",
    transcript,
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { transcript?: unknown };

    if (typeof body.transcript !== "string" || !body.transcript.trim()) {
      return NextResponse.json(
        { error: "A non empty transcript is required." },
        { status: 400 },
      );
    }

    const transcript = body.transcript.trim();
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    const stream = geminiKey
      ? await createGeminiStream(transcript, geminiKey)
      : await createOllamaStream(transcript);

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/plain; charset=utf-8",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (caughtError) {
    const message =
      caughtError instanceof Error
        ? caughtError.message
        : "Document structuring failed.";

    return NextResponse.json(
      { error: `Document structuring failed: ${message}` },
      { status: 500 },
    );
  }
}

async function createGeminiStream(transcript: string, apiKey: string) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const responseStream = await ai.models.generateContentStream({
          model: GEMINI_MODEL,
          contents: buildPrompt(transcript),
          config: {
            responseMimeType: "text/plain",
          },
        });

        try {
          for await (const chunk of responseStream) {
            if (typeof chunk.text === "string" && chunk.text) {
              controller.enqueue(encoder.encode(chunk.text));
            }
          }
          controller.close();
        } catch (caughtError) {
          await fallbackToOllama(controller, transcript, caughtError);
        }
      } catch (caughtError) {
        await fallbackToOllama(controller, transcript, caughtError);
      }
    },
  });
}

async function fallbackToOllama(
  controller: ReadableStreamDefaultController<Uint8Array>,
  transcript: string,
  caughtError: unknown,
) {
  console.error("Gemini structuring failed, using Ollama fallback:", caughtError);

  try {
    const fallbackStream = await createOllamaStream(transcript);
    const reader = fallbackStream.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }

      controller.enqueue(value);
    }
  } catch (fallbackError) {
    controller.error(fallbackError);
  }
}

async function createOllamaStream(transcript: string) {
  const ollamaUrl = process.env.LOCAL_AI_URL || "http://127.0.0.1:11434";
  const response = await fetch(`${ollamaUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: buildPrompt(transcript),
      stream: true,
      keep_alive: 0,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Gemini and Ollama failed. Ollama returned ${response.status}${details ? `: ${details}` : "."}`,
    );
  }

  if (!response.body) {
    throw new Error("Ollama did not return a readable response stream.");
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const ollamaReader = response.body.getReader();
  let bufferedLine = "";
  let completed = false;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (completed) {
          controller.close();
          return;
        }

        const { done, value } = await ollamaReader.read();

        if (done) {
          bufferedLine += decoder.decode();
          if (bufferedLine.trim()) {
            completed = enqueueOllamaResponse(
              bufferedLine,
              controller,
              encoder,
            );
          }
          controller.close();
          return;
        }

        bufferedLine += decoder.decode(value, { stream: true });
        const lines = bufferedLine.split("\n");
        bufferedLine = lines.pop() ?? "";

        for (const line of lines) {
          if (line.trim()) {
            completed = enqueueOllamaResponse(line, controller, encoder);
            if (completed) {
              controller.close();
              return;
            }
          }
        }
      } catch (caughtError) {
        controller.error(caughtError);
      }
    },
    async cancel() {
      await ollamaReader.cancel();
    },
  });
}

function enqueueOllamaResponse(
  line: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
): boolean {
  const chunk = JSON.parse(line.trim()) as OllamaStreamChunk;

  if (typeof chunk.response === "string" && chunk.response) {
    controller.enqueue(encoder.encode(chunk.response));
  }

  if (chunk.done === true) {
    logPerformanceSummary(chunk);
    return true;
  }

  return false;
}

function logPerformanceSummary(chunk: OllamaStreamChunk) {
  if (
    typeof chunk.eval_count !== "number" ||
    typeof chunk.eval_duration !== "number" ||
    chunk.eval_duration <= 0
  ) {
    console.log(`[Local AI] ${OLLAMA_MODEL} completed without performance metrics.`);
    return;
  }

  const durationSeconds = chunk.eval_duration / 1_000_000_000;
  const tokensPerSecond = chunk.eval_count / durationSeconds;

  console.log(
    `[Local AI] ${OLLAMA_MODEL} performance: ${chunk.eval_count} tokens in ` +
      `${durationSeconds.toFixed(2)}s (${tokensPerSecond.toFixed(2)} tokens/s)`,
  );
}
