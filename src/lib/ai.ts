import { supabase } from "@/integrations/supabase/client";

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

    const { data, error } = await supabase.functions.invoke("ai-call", {
      body: { messages: processedMessages, max_tokens: maxTokens },
    });

    if (error) {
      console.error("AI call failed:", error);
      return null;
    }

    if (data?.error) {
      console.error("AI call error:", data.error);
      return null;
    }

    return data?.choices?.[0]?.message?.content ?? null;
  } catch (error) {
    console.error("AI call failed:", error);
    return null;
  }
};
