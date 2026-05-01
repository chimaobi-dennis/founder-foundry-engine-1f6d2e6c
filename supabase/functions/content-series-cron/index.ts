import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Find all active series due for generation
  const { data: dueSeries } = await supabase
    .from('content_studio_briefs')
    .select('*')
    .eq('is_series', true)
    .eq('series_active', true)
    .lte('next_generation_at', new Date().toISOString())

  if (!dueSeries || dueSeries.length === 0) {
    return new Response(JSON.stringify({ message: 'No series due', count: 0 }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const results = []

  for (const brief of dueSeries) {
    // Log the run
    const { data: run } = await supabase
      .from('content_series_runs')
      .insert({
        brief_id: brief.id,
        trigger_type: 'cron',
        status: 'generating'
      })
      .select('id')
      .single()

    try {
      // Call the generation endpoint
      const genResponse = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-content`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` 
          },
          body: JSON.stringify({ briefId: brief.id })
        }
      )

      if (genResponse.ok) {
        await supabase
          .from('content_series_runs')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', run.id)

        // Create notification for user
        await supabase
          .from('notifications')
          .insert({
            user_id: brief.user_id,
            brand_id: brief.brand_id,
            type: 'content_series_ready',
            title: 'Your content series is ready',
            body: `New content for "${brief.name}" has been generated and is ready for review.`,
            action_url: `/content-studio/${brief.id}` 
          })

        results.push({ briefId: brief.id, status: 'completed' })
      } else {
        throw new Error('Generation failed')
      }
    } catch (error: any) {
      await supabase
        .from('content_series_runs')
        .update({ status: 'failed', error_message: error.message })
        .eq('id', run.id)

      await supabase
        .from('notifications')
        .insert({
          user_id: brief.user_id,
          brand_id: brief.brand_id,
          type: 'content_series_failed',
          title: 'Content generation failed',
          body: `We had trouble generating content for "${brief.name}". We will try again at the next scheduled time.`,
          action_url: `/content-studio/${brief.id}` 
        })

      results.push({ briefId: brief.id, status: 'failed', error: error.message })
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
