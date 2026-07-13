export const AI_PROVIDERS = {
  // ===========================
  // TEXT
  // ===========================
  openrouter: {
    name: "OpenRouter",
    apiKey: process.env.OPENROUTER_API_KEY!,
    model: process.env.OPENROUTER_MODEL!,
    url: "https://openrouter.ai/api/v1/chat/completions",
  },

  groq: {
    name: "Groq",
    apiKey: process.env.GROQ_API_KEY!,
    model: process.env.GROQ_MODEL!,
    url: "https://api.groq.com/openai/v1/chat/completions",
  },

  gemini: {
    name: "Gemini",
    apiKey: process.env.GEMINI_API_KEY!,
    model: process.env.GEMINI_MODEL!,
    url: "https://generativelanguage.googleapis.com/v1beta/models",
  },

  // ===========================
  // IMAGE
  // ===========================
  huggingface: {
    name: "Hugging Face",
    apiKey: process.env.HUGGINGFACE_API_KEY!,
    url: "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell",
  },

  together: {
    name: "Together AI",
    apiKey: process.env.TOGETHER_API_KEY!,
    model: process.env.TOGETHER_MODEL!,
    url: "https://api.together.xyz/v1/images/generations",
  },

  fal: {
    name: "Fal AI",
    apiKey: process.env.FAL_KEY!,
    model: process.env.FAL_MODEL!,
    url: "https://fal.run",
  },

  replicate: {
    name: "Replicate",
    apiKey: process.env.REPLICATE_API_TOKEN!,
    url: "https://api.replicate.com/v1/predictions",
  },

  stability: {
    name: "Stability AI",
    apiKey: process.env.STABILITY_API_KEY!,
    url: "https://api.stability.ai/v2beta/stable-image/generate/core",
  },

  openaiImage: {
    name: "OpenAI Images",
    apiKey: process.env.OPENAI_API_KEY!,
    url: "https://api.openai.com/v1/images/generations",
  },

  novita: {
    name: "Novita AI",
    apiKey: process.env.NOVITA_API_KEY!,
    url: "https://api.novita.ai/v3",
  },

  // ===========================
  // VOICE
  // ===========================
  elevenlabs: {
    name: "ElevenLabs",
    apiKey: process.env.ELEVENLABS_API_KEY!,
    url: "https://api.elevenlabs.io/v1",
  },

  deepgram: {
    name: "Deepgram",
    apiKey: process.env.DEEPGRAM_API_KEY!,
    url: "https://api.deepgram.com/v1",
  },

  playht: {
    name: "PlayHT",
    apiKey: process.env.PLAYHT_API_KEY!,
    userId: process.env.PLAYHT_USER_ID!,
    url: "https://api.play.ht/api/v2",
  },

  cartesia: {
    name: "Cartesia",
    apiKey: process.env.CARTESIA_API_KEY!,
    url: "https://api.cartesia.ai",
  },

  lmnt: {
    name: "LMNT",
    apiKey: process.env.LMNT_API_KEY!,
    url: "https://api.lmnt.com/v1",
  },

  azure: {
    name: "Azure Speech",
    apiKey: process.env.AZURE_SPEECH_KEY!,
    region: process.env.AZURE_SPEECH_REGION!,
  },

  googleTTS: {
    name: "Google TTS",
    apiKey: process.env.GOOGLE_TTS_API_KEY!,
  },

  // ===========================
  // VIDEO
  // ===========================
  runway: {
    name: "Runway",
    apiKey: process.env.RUNWAY_API_KEY!,
  },

  pika: {
    name: "Pika",
    apiKey: process.env.PIKA_API_KEY!,
  },

  luma: {
    name: "Luma AI",
    apiKey: process.env.LUMA_API_KEY!,
  },

  kling: {
    name: "Kling AI",
    apiKey: process.env.KLING_API_KEY!,
  },

  minimax: {
    name: "MiniMax",
    apiKey: process.env.MINIMAX_API_KEY!,
  },

  vertex: {
    name: "Google Vertex AI",
    apiKey: process.env.GOOGLE_VERTEX_API_KEY!,
    project: process.env.VERTEX_PROJECT_ID!,
    location: process.env.VERTEX_LOCATION!,
  },

  stabilityVideo: {
    name: "Stability Video",
    apiKey: process.env.STABILITY_VIDEO_API_KEY!,
  },

  falVideo: {
    name: "Fal Video",
    apiKey: process.env.FAL_VIDEO_API_KEY!,
  },

  replicateVideo: {
    name: "Replicate Video",
    apiKey: process.env.REPLICATE_VIDEO_API_TOKEN!,
  },
} as const;