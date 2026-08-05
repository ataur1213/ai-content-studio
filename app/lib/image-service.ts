import { ProviderManager } from "./provider-manager";

export interface ImageGenerationOptions {
  prompt: string;
  width?: number;
  height?: number;
  numImages?: number;
}

export async function generateImage({
  prompt,
  width = 1024,
  height = 1024,
  numImages = 1,
}: ImageGenerationOptions): Promise<string> {
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
            parameters: {
              width,
              height,
              num_inference_steps: 4,
            },
            options: {
              wait_for_model: true,
            },
          }),
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const imageBuffer = await response.arrayBuffer();

        return `data:image/png;base64,${Buffer.from(imageBuffer).toString("base64")}`;
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
            width,
            height,
            steps: 4,
            n: numImages,
          }),
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const data = await response.json() as {
          data?: ReadonlyArray<{ url?: string; b64_json?: string }>;
        };

        if (data.data?.[0]?.url) {
          return data.data[0].url;
        }
        if (data.data?.[0]?.b64_json) {
          return `data:image/png;base64,${data.data[0].b64_json}`;
        }
        throw new Error("Invalid response from Together AI");
      }

      case "OpenAI Images": {
        const response = await fetch(provider.url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "dall-e-3",
            prompt,
            size: `${width}x${height}`,
            n: numImages,
          }),
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const data = await response.json() as {
          data?: ReadonlyArray<{ url?: string; b64_json?: string }>;
        };

        return data.data?.[0]?.b64_json
          ? `data:image/png;base64,${data.data[0].b64_json}`
          : data.data?.[0]?.url ?? "";
      }

      case "Stability AI": {
        const response = await fetch(provider.url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            prompt,
            output_format: "png",
          }),
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const data = await response.json() as {
          artifacts?: ReadonlyArray<{ base64?: string }>;
        };

        if (data.artifacts?.[0]?.base64) {
          return `data:image/png;base64,${data.artifacts[0].base64}`;
        }
        throw new Error("Invalid response from Stability AI");
      }

      case "Novita AI": {
        const createRes = await fetch(`${provider.url}/v3/async/image-generation`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model_name: "sdxl",
            prompt,
            image_width: width,
            image_height: height,
            image_num: numImages,
          }),
        });

        if (!createRes.ok) {
          throw new Error(await createRes.text());
        }

        const createData = await createRes.json() as { task_id?: string };
        const taskId = createData.task_id;
        if (!taskId) {
          throw new Error("Failed to create Novita AI task");
        }

        // Poll for result
        for (let i = 0; i < 60; i++) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const statusRes = await fetch(`${provider.url}/v3/async/image-result/${taskId}`, {
            headers: { Authorization: `Bearer ${provider.apiKey}` },
          });
          if (!statusRes.ok) throw new Error(await statusRes.text());
          const statusData = await statusRes.json() as {
            task: { status: string };
            images?: ReadonlyArray<{ image_url?: string; image_file?: string }>;
          };

          if (statusData.task.status === "SUCCESS") {
            if (statusData.images?.[0]?.image_url) {
              return statusData.images[0].image_url;
            }
            if (statusData.images?.[0]?.image_file) {
              return `data:image/png;base64,${statusData.images[0].image_file}`;
            }
            throw new Error("Novita AI task succeeded but no image");
          }
          if (statusData.task.status === "FAILED") {
            throw new Error("Novita AI task failed");
          }
        }
        throw new Error("Novita AI task timed out");
      }

      case "Fal AI": {
        const response = await fetch(`${provider.url}/fal-ai/flux-pro`, {
          method: "POST",
          headers: {
            Authorization: `Key ${provider.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt,
            image_size: { width, height },
            num_images: numImages,
          }),
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const data = await response.json() as {
          images?: ReadonlyArray<{ url?: string; base64?: string }>;
        };

        if (data.images?.[0]?.url) {
          return data.images[0].url;
        }
        if (data.images?.[0]?.base64) {
          return `data:image/png;base64,${data.images[0].base64}`;
        }
        throw new Error("Invalid response from Fal AI");
      }

      case "Replicate": {
        const initialRes = await fetch(provider.url, {
          method: "POST",
          headers: {
            Authorization: `Token ${provider.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            version: "af1a6a300d9a8a7950a41204a8050585a504a804",
            input: {
              prompt,
              width,
              height,
              num_outputs: numImages,
            },
          }),
        });

        if (!initialRes.ok) {
          throw new Error(await initialRes.text());
        }

        const initialData = await initialRes.json() as {
          output?: ReadonlyArray<string>;
          urls?: { get?: string };
          status?: string;
        };

        if (initialData.output?.[0]) {
          return initialData.output[0];
        }
        if (initialData.urls?.get) {
          const pollUrl = initialData.urls.get;
          // Poll for result
          for (let i = 0; i < 60; i++) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            const statusRes = await fetch(pollUrl, {
              headers: { Authorization: `Token ${provider.apiKey}` },
            });
            if (!statusRes.ok) throw new Error(await statusRes.text());
            const statusData = await statusRes.json() as {
              status: string;
              output?: ReadonlyArray<string>;
            };

            if (statusData.status === "succeeded") {
              if (statusData.output?.[0]) {
                return statusData.output[0];
              }
              throw new Error("Replicate task succeeded but no image");
            }
            if (statusData.status === "failed") {
              throw new Error("Replicate task failed");
            }
          }
          throw new Error("Replicate task timed out");
        }
        throw new Error("Invalid response from Replicate");
      }

      default:
        throw new Error(`${provider.name} provider is not implemented yet.`);
    }
  });
}