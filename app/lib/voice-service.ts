// =====================================================
// AI CONTENT STUDIO
// Voice Service
// Part 1
// =====================================================

export interface VoiceOptions {
  text: string;
  language?: string;
  voice?: "male" | "female";
  speed?: number;
  pitch?: number;
}

export interface VoiceResult {
  provider: string;
  audio: ArrayBuffer;
}

const ELEVENLABS_API =
  "https://api.elevenlabs.io/v1/text-to-speech";

const DEEPGRAM_API =
  "https://api.deepgram.com/v1/speak";

// =====================================================
// Helpers
// =====================================================

function getElevenVoiceId(
  voice: string = "female"
) {
  return voice === "male"
    ? (
        process.env.ELEVENLABS_MALE_VOICE_ID ||
        "JBFqnCBsd6RMkjVDRZzb"
      )
    : (
        process.env.ELEVENLABS_FEMALE_VOICE_ID ||
        "EXAVITQu4vr4xnSDxMaL"
      );
}

function getDeepgramModel(
  voice: string = "female"
) {
  return voice === "male"
    ? (
        process.env.DEEPGRAM_MALE_MODEL ||
        "aura-2-aries-en"
      )
    : (
        process.env.DEEPGRAM_FEMALE_MODEL ||
        "aura-2-athena-en"
      );
}

function clamp(
  value: number,
  min: number,
  max: number
) {
  return Math.min(
    Math.max(value, min),
    max
  );
}
// =====================================================
// ElevenLabs Provider
// =====================================================

async function elevenLabs(
  options: VoiceOptions
): Promise<VoiceResult> {

  const apiKey =
    process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    throw new Error(
      "ELEVENLABS_API_KEY missing."
    );
  }

  const response = await fetch(
    `${ELEVENLABS_API}/${getElevenVoiceId(options.voice)}`,
    {
      method: "POST",

      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },

      body: JSON.stringify({
        text: options.text,

        model_id:
          process.env.ELEVENLABS_MODEL ||
          "eleven_multilingual_v2",

        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.2,
          use_speaker_boost: true,
          speed: clamp(
            options.speed ?? 1,
            0.5,
            2
          ),
        },
      }),
    }
  );

  if (!response.ok) {
    const error =
      await response.text();

    throw new Error(
      `ElevenLabs Error: ${error}`
    );
  }

  const audio = await response.arrayBuffer();

console.log("ElevenLabs Audio Size:", audio.byteLength);

return {
  provider: "ElevenLabs",
  audio,
};
}

// =====================================================
// Deepgram Provider
// =====================================================

async function deepgram(
  options: VoiceOptions
): Promise<VoiceResult> {

  const apiKey =
    process.env.DEEPGRAM_API_KEY;

  if (!apiKey) {
    throw new Error(
      "DEEPGRAM_API_KEY missing."
    );
  }

  const response = await fetch(
    `${DEEPGRAM_API}?model=${getDeepgramModel(options.voice)}`,
    {
      method: "POST",

      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },

      body: JSON.stringify({
        text: options.text,
      }),
    }
  );

  if (!response.ok) {
    const error =
      await response.text();

    throw new Error(
      `Deepgram Error: ${error}`
    );
  }

  return {
    provider: "Deepgram",
    audio: await response.arrayBuffer(),
  };
}
// =====================================================
// Main Voice Generator
// =====================================================

export async function generateVoice(
  options: VoiceOptions
): Promise<VoiceResult> {

  if (!options.text?.trim()) {
    throw new Error("Text is required.");
  }

  // Try ElevenLabs
  try {

    console.log(
      "Using ElevenLabs..."
    );

    return await elevenLabs(options);

  } catch (error) {

    console.warn(
      "ElevenLabs failed."
    );

    console.warn(error);

  }

  // Fallback → Deepgram
  try {

    console.log(
      "Using Deepgram..."
    );

    return await deepgram(options);

  } catch (error) {

    console.error(
      "Deepgram failed."
    );

    console.error(error);

    throw new Error(
      "All Voice Providers Failed."
    );

  }

}

// =====================================================
// Supported Languages
// =====================================================

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

// =====================================================
// Supported Voices
// =====================================================

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

// =====================================================
// Supported Providers
// =====================================================

export function supportedProviders() {

  return [

    {
      id: "elevenlabs",
      name: "ElevenLabs",
      priority: 1,
      enabled: Boolean(
        process.env.ELEVENLABS_API_KEY
      ),
    },

    {
      id: "deepgram",
      name: "Deepgram Aura",
      priority: 2,
      enabled: Boolean(
        process.env.DEEPGRAM_API_KEY
      ),
    },

  ];

}

// =====================================================
// Provider Status
// =====================================================

export function providerStatus() {

  return {

    elevenlabs: Boolean(
      process.env.ELEVENLABS_API_KEY
    ),

    deepgram: Boolean(
      process.env.DEEPGRAM_API_KEY
    ),

  };

}