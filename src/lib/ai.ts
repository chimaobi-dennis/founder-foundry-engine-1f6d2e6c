export const callAI = async (
  messages: { role: string; content: any }[],
  maxTokens: number = 4000,
  imageBase64?: string,
  imageMimeType?: string
): Promise<string | null> => {
  try {
    const LOVABLE_API_KEY = import.meta.env.VITE_LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return null;
    }

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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: processedMessages,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI call failed:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch (error) {
    console.error("AI call failed:", error);
    return null;
  }
};
