import { ProviderManager } from "./provider-manager";

export async function generateImage(prompt: string): Promise<string> {
  const providers = ProviderManager.getImageProviders();

  return ProviderManager.tryProviders(providers, async (provider) => {
    switch (provider.name) {
      case "Hugging Face": {
        const response = await fetch(provider.url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: prompt,
            options: {
              wait_for_model: true,
            },
          }),
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const imageBuffer = await response.arrayBuffer();

        return `data:image/png;base64,${Buffer.from(imageBuffer).toString(
          "base64"
        )}`;
      }

      case "Together AI": {
        const response = await fetch(provider.url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: provider.model,
            prompt,
            width: 1024,
            height: 1024,
            steps: 4,
            n: 1,
          }),
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const data = await response.json();

        return data.data?.[0]?.url;
      }

      case "OpenAI Images": {
        const response = await fetch(provider.url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-image-1",
            prompt,
            size: "1024x1024",
          }),
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const data = await response.json();

        return data.data[0].url;
      }

      case "Replicate":
      case "Fal AI":
      case "Stability AI":
      case "Novita AI":
        throw new Error(`${provider.name} provider is not implemented yet.`);

      default:
        throw new Error("Unsupported provider.");
    }
  });
}