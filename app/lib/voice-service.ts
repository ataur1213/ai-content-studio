import { ProviderManager } from "./provider-manager";
import { AI_PROVIDERS } from "./providers";

export interface VoiceOptions {
  text: string;
  language?: string;
  voice?: string;
  speed?: number;
  pitch?: number;
}

export interface VoiceResult {
  provider: string;
  audio: ArrayBuffer;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export async function generateVoice(options: VoiceOptions): Promise<VoiceResult> {
  if (!options.text?.trim()) {
    throw new Error("Text is required.");
  }

  const providers = ProviderManager.getVoiceProviders();

  return ProviderManager.tryProviders(providers, async (provider) => {
    switch (provider.name) {
      case "ElevenLabs": {
        const voiceId = options.voice === "male"
          ? (process.env.ELEVENLABS_MALE_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb")
          : (process.env.ELEVENLABS_FEMALE_VOICE_ID || "EXAVITQu4vr4xnSDxMaL");

        const response = await fetch(
          `${provider.url}/v1/text-to-speech/${voiceId}`,
          {
            method: "POST",
            headers: {
              "xi-api-key": provider.apiKey,
              "Content-Type": "application/json",
              Accept: "audio/mpeg",
            },
            body: JSON.stringify({
              text: options.text,
              model_id: process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2",
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75,
                style: 0.2,
                use_speaker_boost: true,
                speed: clamp(options.speed ?? 1, 0.5, 2),
              },
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`ElevenLabs Error: ${await response.text()}`);
        }

        return {
          provider: "ElevenLabs",
          audio: await response.arrayBuffer(),
        };
      }

      case "Deepgram": {
        const model = options.voice === "male"
          ? (process.env.DEEPGRAM_MALE_MODEL || "aura-2-aries-en")
          : (process.env.DEEPGRAM_FEMALE_MODEL || "aura-2-athena-en");

        const response = await fetch(
          `${provider.url}/v1/speak?model=${model}`,
          {
            method: "POST",
            headers: {
              Authorization: `Token ${provider.apiKey}`,
              "Content-Type": "application/json",
              Accept: "audio/mpeg",
            },
            body: JSON.stringify({
              text: options.text,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`Deepgram Error: ${await response.text()}`);
        }

        return {
          provider: "Deepgram",
          audio: await response.arrayBuffer(),
        };
      }

      case "PlayHT": {
        const response = await fetch(`${provider.url}/v2/tts`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            "X-User-Id": provider.userId,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: options.text,
            voice: options.voice === "male" ? "s3://voice-cloning-zero-shot/d9ff78ba-d016-47f6-b0ef-dd630f59414e/female-cs/manifest.json" : "s3://voice-cloning-zero-shot/d9ff78ba-d016-47f6-b0ef-dd630f59414e/female-cs/manifest.json",
            output_format: "mp3",
            speed: clamp(options.speed ?? 1, 0.5, 2),
          }),
        });

        if (!response.ok) {
          throw new Error(`PlayHT Error: ${await response.text()}`);
        }

        const data = await response.json();
        const statusUrl = data.url;

        // Poll for result
        let attempts = 0;
        while (attempts < 60) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const statusRes = await fetch(statusUrl, {
            headers: {
              Authorization: `Bearer ${provider.apiKey}`,
              "X-User-Id": provider.userId,
            },
          });
          if (!statusRes.ok) throw new Error(await statusRes.text());
          const statusData = await statusRes.json();

          if (statusData.status === "completed" && statusData.output?.url) {
            const audioRes = await fetch(statusData.output.url);
            if (!audioRes.ok) throw new Error("Failed to download PlayHT audio");
            return {
              provider: "PlayHT",
              audio: await audioRes.arrayBuffer(),
            };
          } else if (statusData.status === "failed") {
            throw new Error("PlayHT task failed");
          }
          attempts++;
        }
        throw new Error("PlayHT task timed out");
      }

      case "Cartesia": {
        const response = await fetch(`${provider.url}/tts`, {
          method: "POST",
          headers: {
            "X-API-Key": provider.apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model_id: "sonic-english",
            transcript: options.text,
            voice: {
              mode: "id",
              id: options.voice === "male" ? "39582909-4517-4531-bf73-05714a98f272" : "265f88d0-5e84-4ca0-86d3-a4a33602a5e9",
            },
            output_format: {
              container: "mp3",
              sampling_rate: 44100,
              bit_rate: 192000,
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`Cartesia Error: ${await response.text()}`);
        }

        return {
          provider: "Cartesia",
          audio: await response.arrayBuffer(),
        };
      }

      case "LMNT": {
        const response = await fetch(`${provider.url}/v1/synthesize`, {
          method: "POST",
          headers: {
            "X-API-Key": provider.apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: options.text,
            voice: options.voice === "male" ? "mara" : "sara",
            format: "mp3",
            speed: clamp(options.speed ?? 1, 0.5, 2),
          }),
        });

        if (!response.ok) {
          throw new Error(`LMNT Error: ${await response.text()}`);
        }

        return {
          provider: "LMNT",
          audio: await response.arrayBuffer(),
        };
      }

      case "Azure Speech": {
        const fetchToken = async () => {
          const tokenRes = await fetch(`https://${provider.region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
            method: "POST",
            headers: {
              "Ocp-Apim-Subscription-Key": provider.apiKey,
            },
          });
          if (!tokenRes.ok) throw new Error("Failed to get Azure token");
          return await tokenRes.text();
        };

        const token = await fetchToken();
        const response = await fetch(`https://${provider.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
          },
          body: `<speak version='1.0' xml:lang='${options.language || "en-US"}'>
            <voice xml:lang='${options.language || "en-US"}' name='${options.voice === "male" ? "en-US-GuyNeural" : "en-US-JennyNeural"}'>
              <prosody rate='${clamp(options.speed ?? 1, 0.5, 2) - 1}'>
                ${options.text}
              </prosody>
            </voice>
          </speak>`,
        });

        if (!response.ok) {
          throw new Error(`Azure Speech Error: ${await response.text()}`);
        }

        return {
          provider: "Azure Speech",
          audio: await response.arrayBuffer(),
        };
      }

      case "Google TTS": {
        const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${provider.apiKey}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            input: { text: options.text },
            voice: {
              languageCode: options.language || "en-US",
              ssmlGender: options.voice === "male" ? "MALE" : "FEMALE",
            },
            audioConfig: {
              audioEncoding: "MP3",
              speakingRate: clamp(options.speed ?? 1, 0.5, 2),
              pitch: (options.pitch ?? 0) * 20,
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`Google TTS Error: ${await response.text()}`);
        }

        const data = await response.json();
        if (!data.audioContent) throw new Error("Google TTS returned no audio");

        const audioBuffer = Buffer.from(data.audioContent, "base64");
        const audioArrayBuffer = audioBuffer.buffer.slice(
          audioBuffer.byteOffset,
          audioBuffer.byteOffset + audioBuffer.byteLength
        );

        return {
          provider: "Google TTS",
          audio: audioArrayBuffer,
        };
      }

      default:
        throw new Error(`${provider.name} voice generation not implemented`);
    }
  });
}

export function supportedLanguages() {
  return [
    {
      code: "en",
      name: "English",
    },
    {
      code: "bn",
      name: "Bangla",
    },
    {
      code: "hi",
      name: "Hindi",
    },
  ];
}

export function supportedVoices() {
  return [
    {
      id: "female",
      name: "Female",
    },
    {
      id: "male",
      name: "Male",
    },
  ];
}

export function supportedProviders() {
  return [
    {
      id: "elevenlabs",
      name: "ElevenLabs",
      priority: 1,
      enabled: Boolean(
        AI_PROVIDERS.elevenlabs.apiKey
      ),
    },
    {
      id: "deepgram",
      name: "Deepgram Aura",
      priority: 2,
      enabled: Boolean(
        AI_PROVIDERS.deepgram.apiKey
      ),
    },
  ];
}

export function providerStatus() {
  return {
    elevenlabs: Boolean(
      AI_PROVIDERS.elevenlabs.apiKey
    ),
    deepgram: Boolean(
      AI_PROVIDERS.deepgram.apiKey
    ),
  };
}
