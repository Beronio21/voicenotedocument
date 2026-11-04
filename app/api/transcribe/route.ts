import { NextResponse } from "next/server";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

function recognizeAudio(
  audioBuffer: ArrayBuffer,
  speechKey: string,
  speechRegion: string,
) {
  return new Promise<string>((resolve, reject) => {
    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
      speechKey,
      speechRegion,
    );
    speechConfig.speechRecognitionLanguage = "en-US";

    const pushStream = SpeechSDK.AudioInputStream.createPushStream();
    const audioConfig = SpeechSDK.AudioConfig.fromStreamInput(pushStream);
    const recognizer = new SpeechSDK.SpeechRecognizer(
      speechConfig,
      audioConfig,
    );

    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      recognizer.close();
      audioConfig.close();
      speechConfig.close();
      callback();
    };

    recognizer.recognizeOnceAsync(
      (result) => {
        if (result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
          finish(() => resolve(result.text));
          return;
        }

        finish(() =>
          reject(new Error("Azure could not recognize any speech in the audio.")),
        );
      },
      (error) => finish(() => reject(new Error(error))),
    );

    pushStream.write(audioBuffer);
    pushStream.close();
  });
}

export async function POST(request: Request) {
  try {
    const speechKey = process.env.AZURE_SPEECH_KEY;
    const speechRegion = process.env.AZURE_SPEECH_REGION;

    if (!speechKey || !speechRegion) {
      return NextResponse.json(
        { error: "Azure Speech is not configured on the server." },
        { status: 500 },
      );
    }

    const formData = await request.formData();
    const audio = formData.get("audio");

    if (!(audio instanceof File)) {
      return NextResponse.json(
        { error: "An audio file is required." },
        { status: 400 },
      );
    }

    const transcript = await recognizeAudio(
      await audio.arrayBuffer(),
      speechKey,
      speechRegion,
    );

    return NextResponse.json({ transcript });
  } catch (caughtError) {
    const message =
      caughtError instanceof Error
        ? caughtError.message
        : "Azure transcription failed.";

    return NextResponse.json(
      { error: `Azure transcription failed: ${message}` },
      { status: 500 },
    );
  }
}
