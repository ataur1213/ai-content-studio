import { AI_PROVIDERS } from "./providers";

export type ProviderType = "image" | "voice" | "video" | "text";

type Provider = typeof AI_PROVIDERS[keyof typeof AI_PROVIDERS];

export class ProviderManager {
  static getImageProviders(): Provider[] {
    return [
      AI_PROVIDERS.huggingface,
      AI_PROVIDERS.together,
      AI_PROVIDERS.fal,
      AI_PROVIDERS.replicate,
      AI_PROVIDERS.stability,
      AI_PROVIDERS.openaiImage,
      AI_PROVIDERS.novita,
    ].filter((provider) => provider.apiKey);
  }

  static getVoiceProviders(): Provider[] {
    return [
      AI_PROVIDERS.elevenlabs,
      AI_PROVIDERS.deepgram,
      AI_PROVIDERS.playht,
      AI_PROVIDERS.cartesia,
      AI_PROVIDERS.lmnt,
      AI_PROVIDERS.azure,
      AI_PROVIDERS.googleTTS,
    ].filter((provider) => provider.apiKey);
  }

  static getVideoProviders(): Provider[] {
    return [
      AI_PROVIDERS.runway,
      AI_PROVIDERS.pika,
      AI_PROVIDERS.luma,
      AI_PROVIDERS.kling,
      AI_PROVIDERS.minimax,
      AI_PROVIDERS.vertex,
      AI_PROVIDERS.stabilityVideo,
      AI_PROVIDERS.falVideo,
      AI_PROVIDERS.replicateVideo,
    ].filter((provider) => provider.apiKey);
  }

  static getTextProviders(): Provider[] {
    return [
      AI_PROVIDERS.openrouter,
      AI_PROVIDERS.groq,
      AI_PROVIDERS.gemini,
    ].filter((provider) => provider.apiKey);
  }

  static async tryProviders<T>(
    providers: Provider[],
    callback: (provider: Provider) => Promise<T>
  ): Promise<T> {
    let lastError: unknown;

    for (const provider of providers) {
      try {
        console.log(`Trying Provider: ${provider.name}`);
        return await callback(provider);
      } catch (error) {
        console.error(`${provider.name} failed`, error);
        lastError = error;
      }
    }

    throw lastError || new Error("No AI provider available.");
  }
}
