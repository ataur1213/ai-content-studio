import { AI_PROVIDERS } from "./providers";

export async function enhancePrompt(prompt: string) {
  const provider = AI_PROVIDERS.openrouter;

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
          content:
            "You are a professional AI image prompt engineer. Return only an optimized image prompt.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const data = await response.json();

  return data.choices?.[0]?.message?.content || prompt;
}