import { NextResponse } from "next/server";

const MODEL = "gemma4:e2b";

type OllamaStreamChunk = {
  response?: unknown;
  done?: unknown;
  eval_count?: unknown;
  eval_duration?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { transcript?: unknown };

    if (typeof body.transcript !== "string" || !body.transcript.trim()) {
      return NextResponse.json(
        { error: "A non empty transcript is required." },
        { status: 400 },
      );
    }

    const ollamaUrl = process.env.LOCAL_AI_URL || "http://127.0.0.1:11434";
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        prompt: [
          "Turn the following raw voice note into a clear Markdown document.",
          "Preserve the meaning, remove filler words, and use headings or lists when useful.",
          "Return only the Markdown document, with no surrounding explanation.",
          "",
          body.transcript.trim(),
        ].join("\n"),
        stream: true,
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(
        `Ollama returned ${response.status}${details ? `: ${details}` : "."}`,
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

    const stream = new ReadableStream({
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
              completed = enqueueOllamaResponse(
                line,
                controller,
                encoder,
              );
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
        : "Local AI structuring failed.";

    return NextResponse.json(
      { error: `Local AI structuring failed: ${message}` },
      { status: 500 },
    );
  }
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
    console.log(`[Local AI] ${MODEL} completed without performance metrics.`);
    return;
  }

  const durationSeconds = chunk.eval_duration / 1_000_000_000;
  const tokensPerSecond = chunk.eval_count / durationSeconds;

  console.log(
    `[Local AI] ${MODEL} performance: ${chunk.eval_count} tokens in ` +
      `${durationSeconds.toFixed(2)}s (${tokensPerSecond.toFixed(2)} tokens/s)`,
  );
}
