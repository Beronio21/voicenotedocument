"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import ReactMarkdown from "react-markdown";

type RecordingState = "idle" | "recording" | "transcribing" | "structuring";

type Message =
  | { id: string; role: "user"; content: string; kind: "text" | "audio" }
  | { id: string; role: "assistant"; content: string };

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");

  return `${minutes}:${remainder}`;
}

function getCurrentTime() {
  return Date.now();
}

async function audioBlobToWav(blob: Blob) {
  const AudioContextConstructor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioContextConstructor) {
    throw new Error("Your browser cannot prepare audio for transcription.");
  }

  const context = new AudioContextConstructor();

  try {
    const source = await context.decodeAudioData(await blob.arrayBuffer());
    const targetSampleRate = 16_000;
    const targetLength = Math.ceil(source.duration * targetSampleRate);
    const pcm = new Int16Array(targetLength);

    for (let targetIndex = 0; targetIndex < targetLength; targetIndex += 1) {
      const sourceIndex = Math.min(
        source.length - 1,
        Math.floor((targetIndex * source.sampleRate) / targetSampleRate),
      );
      let sample = 0;

      for (let channel = 0; channel < source.numberOfChannels; channel += 1) {
        sample += source.getChannelData(channel)[sourceIndex] || 0;
      }

      sample /= source.numberOfChannels;
      pcm[targetIndex] = Math.max(-1, Math.min(1, sample)) * 0x7fff;
    }

    const wav = new ArrayBuffer(44 + pcm.byteLength);
    const view = new DataView(wav);
    const writeString = (offset: number, value: string) => {
      for (let index = 0; index < value.length; index += 1) {
        view.setUint8(offset + index, value.charCodeAt(index));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + pcm.byteLength, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, targetSampleRate, true);
    view.setUint32(28, targetSampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, pcm.byteLength, true);
    new Int16Array(wav, 44).set(pcm);

    return new Blob([wav], { type: "audio/wav" });
  } finally {
    await context.close();
  }
}

function messageId() {
  return `${getCurrentTime()}-${Math.random().toString(36).slice(2)}`;
}

export default function VoiceRecorder() {
  const [recordingState, setRecordingState] =
    useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [textNote, setTextNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (recordingState !== "recording") {
      return;
    }

    const timer = window.setInterval(() => {
      if (startedAtRef.current !== null) {
        setDuration(Math.floor((getCurrentTime() - startedAtRef.current) / 1000));
      }
    }, 250);

    return () => window.clearInterval(timer);
  }, [recordingState]);

  useEffect(() => {
    historyRef.current?.scrollTo({
      top: historyRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, recordingState]);

  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function addUserMessage(content: string, kind: "text" | "audio") {
    setMessages((current) => [
      ...current,
      { id: messageId(), role: "user", content, kind },
    ]);
  }

  async function structureTranscript(transcript: string) {
    setRecordingState("structuring");
    const assistantMessageId = messageId();

    try {
      const response = await fetch("/api/structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });

      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error || "Structuring failed.");
      }

      if (!response.body) {
        throw new Error("The structuring response did not include a readable stream.");
      }

      setMessages((current) => [
        ...current,
        { id: assistantMessageId, role: "assistant", content: "" },
      ]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let receivedContent = false;

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          if (!chunk) {
            continue;
          }

          receivedContent = true;
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantMessageId
                ? { ...message, content: message.content + chunk }
                : message,
            ),
          );
        }

        const finalChunk = decoder.decode();
        if (finalChunk) {
          receivedContent = true;
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantMessageId
                ? { ...message, content: message.content + finalChunk }
                : message,
            ),
          );
        }
      } finally {
        reader.releaseLock();
      }

      if (!receivedContent) {
        throw new Error("Ollama returned an empty structured document.");
      }
    } catch (caughtError) {
      setMessages((current) =>
        current.filter((message) => message.id !== assistantMessageId),
      );
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Local AI structuring failed.",
      );
    } finally {
      setRecordingState("idle");
    }
  }

  async function transcribeAudio(blob: Blob) {
    setError(null);
    setRecordingState("transcribing");

    try {
      const wavBlob = await audioBlobToWav(blob);
      const formData = new FormData();
      formData.append("audio", wavBlob, "voice-note.wav");
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as {
        transcript?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || "Transcription failed.");
      }

      const transcript = result.transcript?.trim();
      if (!transcript) {
        throw new Error("No speech was detected.");
      }

      addUserMessage(transcript, "audio");
      await structureTranscript(transcript);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Transcription failed. Please try recording again.",
      );
      setRecordingState("idle");
    }
  }

  async function startRecording() {
    setError(null);
    setDuration(0);

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError(
        "Your browser does not support audio recording. Try the latest version of Chrome, Edge, or Safari.",
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );

      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      startedAtRef.current = getCurrentTime();

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener("stop", () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        if (blob.size > 0) {
          void transcribeAudio(blob);
        } else {
          setRecordingState("idle");
        }

        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        startedAtRef.current = null;
      });

      recorder.addEventListener("error", () => {
        setError("Recording stopped because of a microphone error.");
        setRecordingState("idle");
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        startedAtRef.current = null;
      });

      recorder.start();
      setRecordingState("recording");
    } catch (caughtError) {
      const errorName =
        caughtError instanceof DOMException ? caughtError.name : "";
      setError(
        errorName === "NotAllowedError" || errorName === "PermissionDeniedError"
          ? "Microphone access was denied. Allow it in your browser settings, then try again."
          : "We could not start recording. Check that your microphone is connected.",
      );
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }

  async function submitTextNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const transcript = textNote.trim();

    if (!transcript || recordingState !== "idle") {
      return;
    }

    setError(null);
    setTextNote("");
    addUserMessage(transcript, "text");
    await structureTranscript(transcript);
  }

  const isRecording = recordingState === "recording";
  const isProcessing =
    recordingState === "transcribing" || recordingState === "structuring";

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[#07111f] text-slate-100">
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4 sm:px-8">
        <div>
          <p className="text-sm font-semibold tracking-[0.16em] text-white">
            VOICE NOTE
          </p>
          <p className="mt-1 text-xs text-slate-500">Private workspace</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-400">
          Local AI
        </span>
      </header>

      <div
        ref={historyRef}
        className="flex-1 overflow-y-auto px-4 py-8 sm:px-8"
        aria-live="polite"
      >
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-end gap-6">
          {messages.length === 0 ? (
            <div className="my-auto text-center">
              <p className="text-sm font-medium uppercase tracking-[0.22em] text-cyan-300">
                Ready when you are
              </p>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                What would you like to capture?
              </h1>
              <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-slate-400">
                Record a thought or write a note. Your local AI will shape it
                into a useful Markdown document.
              </p>
            </div>
          ) : null}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <article
                className={`max-w-[88%] rounded-3xl px-5 py-4 shadow-lg ${
                  message.role === "user"
                    ? "rounded-br-md bg-violet-500 text-white shadow-violet-950/20"
                    : "rounded-bl-md border border-white/10 bg-white/[0.08] text-slate-200 shadow-black/20"
                }`}
              >
                {message.role === "user" ? (
                  <div className="flex items-start gap-3">
                    {message.kind === "audio" ? (
                      <span className="mt-0.5 text-violet-200" aria-hidden="true">
                        ◉
                      </span>
                    ) : null}
                    <p className="whitespace-pre-wrap text-sm leading-7">
                      {message.content}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="prose prose-invert prose-sm max-w-none prose-headings:text-white prose-p:text-slate-200 prose-li:text-slate-200">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                    <button
                      type="button"
                      disabled
                      className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-500"
                      title="PDF download will be available in phase 5"
                    >
                      <span aria-hidden="true">↓</span>
                      Download PDF
                    </button>
                  </>
                )}
              </article>
            </div>
          ))}

          {isProcessing ? (
            <div className="flex justify-start">
              <div className="rounded-3xl rounded-bl-md border border-white/10 bg-white/[0.08] px-5 py-4 text-sm text-slate-400">
                {recordingState === "transcribing"
                  ? "Transcribing your note..."
                  : "Structuring your document..."}
              </div>
            </div>
          ) : null}

          {error ? (
            <div role="alert" className="rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm leading-6 text-rose-100">
              {error}
            </div>
          ) : null}
        </div>
      </div>

      <form
        onSubmit={submitTextNote}
        className="shrink-0 border-t border-white/10 bg-[#07111f]/95 px-4 py-4 backdrop-blur sm:px-8"
      >
        <div className="mx-auto flex w-full max-w-3xl items-end gap-3">
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            aria-label={isRecording ? "Stop recording" : "Start recording"}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300 ${
              isRecording
                ? "bg-rose-300 text-rose-950"
                : "border border-white/10 bg-white/[0.08] text-cyan-200 hover:bg-white/[0.14]"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {isRecording ? "■" : "●"}
          </button>
          <div className="relative flex-1">
            <label htmlFor="text-note" className="sr-only">
              Write a note
            </label>
            <textarea
              id="text-note"
              value={textNote}
              onChange={(event) => setTextNote(event.target.value)}
              placeholder={
                isRecording
                  ? `Recording ${formatDuration(duration)}`
                  : "Write a note..."
              }
              rows={1}
              disabled={isProcessing || isRecording}
              className="max-h-32 min-h-12 w-full resize-none rounded-3xl border border-white/10 bg-white/[0.06] px-5 py-3.5 text-sm leading-6 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20 disabled:opacity-60"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!textNote.trim() || isProcessing || isRecording}
            className="h-12 rounded-full bg-cyan-300 px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-slate-600">
          Enter to send, Shift and Enter for a new line
        </p>
      </form>
    </main>
  );
}
