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

    const response = await fetch("https://swift-ai.p.rapidapi.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-RapidAPI-Key": "497f5d56c2mshd12ac628118de94p1bd533jsn4044f509b0ad",
        "X-RapidAPI-Host": "swift-ai.p.rapidapi.com",
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
