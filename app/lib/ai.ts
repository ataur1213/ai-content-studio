export async function generateScript(
  topic: string,
  platform: string,
  prompt: string
) {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat-v3-0324:free",
        messages: [
          {
            role: "system",
            content: "You are a professional AI content writer."
          },
          {
            role: "user",
            content: `Platform: ${platform}

Topic: ${topic}

Prompt:
${prompt}`
          }
        ]
      })
    }
  );

  if (!response.ok) {
    throw new Error("OpenRouter API Error");
  }

  const data = await response.json();

  return data.choices[0].message.content;
}