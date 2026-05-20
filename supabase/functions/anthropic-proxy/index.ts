import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Applies prompt caching to reduce API costs.
 * - System prompt: cached if > 1024 tokens (expensive context reuse)
 * - Last 2 user messages: cached for multi-turn context
 */
function applyCacheControl(messages: any[], system?: string) {
  const processedMessages = [...messages]
  
  // Cache the last user message (most recent context) for multi-turn conversations
  const lastUserIndex = processedMessages.length - 1
  if (lastUserIndex >= 0 && processedMessages[lastUserIndex]?.role === 'user') {
    // Add cache_control to the last user message content blocks
    const msg = processedMessages[lastUserIndex]
    if (Array.isArray(msg.content)) {
      processedMessages[lastUserIndex] = {
        ...msg,
        content: msg.content.map((block: any, idx: number) => 
          idx === msg.content.length - 1 
            ? { ...block, cache_control: { type: 'ephemeral' } }
            : block
        )
      }
    }
  }
  
  return { messages: processedMessages, system }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { model, messages, system, max_tokens, useCache = true } = await req.json()

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Apply prompt caching for cost reduction (50-90% input cost savings)
    const { messages: cachedMessages, system: cachedSystem } = useCache 
      ? applyCacheControl(messages, system)
      : { messages, system }

    const requestBody: any = { 
      model, 
      messages: cachedMessages, 
      max_tokens 
    }
    
    // Add system with cache_control if present and caching enabled
    if (cachedSystem) {
      if (typeof cachedSystem === 'string') {
        requestBody.system = cachedSystem
      } else if (Array.isArray(cachedSystem)) {
        // System prompts as content blocks - add cache_control to last block
        requestBody.system = cachedSystem.map((block: any, idx: number) =>
          idx === cachedSystem.length - 1 && useCache
            ? { ...block, cache_control: { type: 'ephemeral' } }
            : block
        )
      }
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    })

    const data = await response.json()
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
