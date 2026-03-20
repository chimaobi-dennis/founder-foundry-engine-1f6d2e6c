export const callAI = async (
  messages: { role: string; content: any }[],
  maxTokens: number = 4000,
  imageBase64?: string,
  imageMimeType?: string
): Promise<string | null> => {
  try {
    const processedMessages = messages.map((msg, index) => {
      if (index === messages.length - 1 && msg.role === "user" && imageBase64) {
        return {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${imageMimeType || "image/jpeg"};base64,${imageBase64}`,
              },
            },
            {
              type: "text",
              text: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
            },
          ],
        };
      }
      return msg;
    });

    const response = await fetch("https://mujfx.jojapi.net/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-JoJAPI-Key":
          "jk_5C62qEb86Nc8da6JduxX2n7rb38o1D6cd5ab3KQbKb3Yvd8dBu18X75Bo5c6Ddf8",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4",
        messages: processedMessages,
      }),
    });
    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch (error) {
    console.error("AI call failed:", error);
    return null;
  }
};
