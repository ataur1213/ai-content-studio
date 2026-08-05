import { ProviderManager } from "./provider-manager";

export interface TextGenerationOptions {
  systemPrompt?: string;
  userPrompt: string;
}

export async function generateText({
  systemPrompt = "You are a helpful AI assistant.",
  userPrompt,
}: TextGenerationOptions): Promise<string> {
  const providers = ProviderManager.getTextProviders();

  return ProviderManager.tryProviders(providers, async (provider) => {
    if (provider.name === "OpenRouter" || provider.name === "Groq") {
      const response = await fetch(provider.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || "";
    } else if (provider.name === "Gemini") {
      const response = await fetch(`${provider.url}/${provider.model}:generateContent?key=${provider.apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${systemPrompt}\n\n${userPrompt}`,
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    throw new Error(`${provider.name} text generation not implemented`);
  });
}

export async function enhancePrompt(prompt: string): Promise<string> {
  return generateText({
    systemPrompt: "You are a professional AI image prompt engineer. Return only an optimized image prompt.",
    userPrompt: prompt,
  });
}
