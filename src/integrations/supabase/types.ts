export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ai_models: {
        Row: {
          best_for: string[] | null
          context_window: number | null
          cost_per_1k_input: number | null
          cost_per_1k_output: number | null
          created_at: string | null
          description: string | null
          id: string
          is_default: boolean | null
          is_enabled: boolean | null
          model_id: string
          name: string
          provider_id: string
          sort_order: number | null
          supports_images_out: boolean | null
          supports_vision: boolean | null
          updated_at: string | null
        }
        Insert: {
          best_for?: string[] | null
          context_window?: number | null
          cost_per_1k_input?: number | null
          cost_per_1k_output?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          is_enabled?: boolean | null
          model_id: string
          name: string
          provider_id: string
          sort_order?: number | null
          supports_images_out?: boolean | null
          supports_vision?: boolean | null
          updated_at?: string | null
        }
        Update: {
          best_for?: string[] | null
          context_window?: number | null
          cost_per_1k_input?: number | null
          cost_per_1k_output?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          is_enabled?: boolean | null
          model_id?: string
          name?: string
          provider_id?: string
          sort_order?: number | null
          supports_images_out?: boolean | null
          supports_vision?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_models_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_prompt_versions: {
        Row: {
          created_at: string | null
          edit_note: string | null
          edited_by: string | null
          id: string
          prompt_id: string
          system_prompt: string
          version: number
        }
        Insert: {
          created_at?: string | null
          edit_note?: string | null
          edited_by?: string | null
          id?: string
          prompt_id: string
          system_prompt: string
          version: number
        }
        Update: {
          created_at?: string | null
          edit_note?: string | null
          edited_by?: string | null
          id?: string
          prompt_id?: string
          system_prompt?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_prompt_versions_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "ai_system_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_providers: {
        Row: {
          api_key: string | null
          auth_header_name: string
          auth_header_prefix: string
          base_url: string
          created_at: string | null
          description: string | null
          id: string
          is_enabled: boolean | null
          name: string
          slug: string
          supports_images: boolean | null
          supports_streaming: boolean | null
          supports_text: boolean | null
          updated_at: string | null
        }
        Insert: {
          api_key?: string | null
          auth_header_name?: string
          auth_header_prefix?: string
          base_url: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean | null
          name: string
          slug: string
          supports_images?: boolean | null
          supports_streaming?: boolean | null
          supports_text?: boolean | null
          updated_at?: string | null
        }
        Update: {
          api_key?: string | null
          auth_header_name?: string
          auth_header_prefix?: string
          base_url?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean | null
          name?: string
          slug?: string
          supports_images?: boolean | null
          supports_streaming?: boolean | null
          supports_text?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_system_prompts: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          last_edited_by: string | null
          name: string
          system_prompt: string
          task_type: string
          updated_at: string | null
          version: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_edited_by?: string | null
          name: string
          system_prompt: string
          task_type: string
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_edited_by?: string | null
          name?: string
          system_prompt?: string
          task_type?: string
          updated_at?: string | null
          version?: number | null
        }
        Relationships: []
      }
      ai_task_defaults: {
        Row: {
          created_at: string | null
          id: string
          model_id: string | null
          task_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          model_id?: string | null
          task_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          model_id?: string | null
          task_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_task_defaults_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
        ]
      }
      app_errors: {
        Row: {
          breadcrumbs: Json | null
          call_location: string | null
          component_name: string | null
          context: Json | null
          created_at: string | null
          error_code: string | null
          error_message: string
          error_stack: string | null
          error_type: string
          id: string
          is_resolved: boolean | null
          model_id: string | null
          module: string | null
          pipeline_step: string | null
          provider_slug: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          task_type: string | null
          url_path: string | null
          user_action: string | null
          user_id: string | null
        }
        Insert: {
          breadcrumbs?: Json | null
          call_location?: string | null
          component_name?: string | null
          context?: Json | null
          created_at?: string | null
          error_code?: string | null
          error_message: string
          error_stack?: string | null
          error_type: string
          id?: string
          is_resolved?: boolean | null
          model_id?: string | null
          module?: string | null
          pipeline_step?: string | null
          provider_slug?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          task_type?: string | null
          url_path?: string | null
          user_action?: string | null
          user_id?: string | null
        }
        Update: {
          breadcrumbs?: Json | null
          call_location?: string | null
          component_name?: string | null
          context?: Json | null
          created_at?: string | null
          error_code?: string | null
          error_message?: string
          error_stack?: string | null
          error_type?: string
          id?: string
          is_resolved?: boolean | null
          model_id?: string | null
          module?: string | null
          pipeline_step?: string | null
          provider_slug?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          task_type?: string | null
          url_path?: string | null
          user_action?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      assets: {
        Row: {
          brand_id: string
          created_at: string | null
          file_path: string | null
          file_size_bytes: number | null
          file_url: string | null
          height: number | null
          id: string
          is_trashed: boolean
          mime_type: string | null
          name: string
          parent_asset_id: string | null
          platform: string | null
          source_module: string | null
          template_id: string | null
          times_used: number | null
          trashed_at: string | null
          type: string
          updated_at: string | null
          user_id: string
          version: number
          version_label: string | null
          width: number | null
        }
        Insert: {
          brand_id: string
          created_at?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          height?: number | null
          id?: string
          is_trashed?: boolean
          mime_type?: string | null
          name: string
          parent_asset_id?: string | null
          platform?: string | null
          source_module?: string | null
          template_id?: string | null
          times_used?: number | null
          trashed_at?: string | null
          type: string
          updated_at?: string | null
          user_id: string
          version?: number
          version_label?: string | null
          width?: number | null
        }
        Update: {
          brand_id?: string
          created_at?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          height?: number | null
          id?: string
          is_trashed?: boolean
          mime_type?: string | null
          name?: string
          parent_asset_id?: string | null
          platform?: string | null
          source_module?: string | null
          template_id?: string | null
          times_used?: number | null
          trashed_at?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string
          version?: number
          version_label?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_parent_asset_id_fkey"
            columns: ["parent_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "prostudio_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_dna: {
        Row: {
          brand_feel: string[] | null
          brand_id: string
          brand_references: string | null
          brand_voice: string | null
          campaign_strategy: string | null
          core_promise: string | null
          created_at: string | null
          customer_insight: string | null
          customer_profile: string | null
          id: string
          is_active: boolean | null
          pain_points: string | null
          positioning_statement: string | null
          product_positioning: string | null
          target_audience: string | null
          tone_descriptors: string[] | null
          updated_at: string | null
          why_choose_us: string | null
        }
        Insert: {
          brand_feel?: string[] | null
          brand_id: string
          brand_references?: string | null
          brand_voice?: string | null
          campaign_strategy?: string | null
          core_promise?: string | null
          created_at?: string | null
          customer_insight?: string | null
          customer_profile?: string | null
          id?: string
          is_active?: boolean | null
          pain_points?: string | null
          positioning_statement?: string | null
          product_positioning?: string | null
          target_audience?: string | null
          tone_descriptors?: string[] | null
          updated_at?: string | null
          why_choose_us?: string | null
        }
        Update: {
          brand_feel?: string[] | null
          brand_id?: string
          brand_references?: string | null
          brand_voice?: string | null
          campaign_strategy?: string | null
          core_promise?: string | null
          created_at?: string | null
          customer_insight?: string | null
          customer_profile?: string | null
          id?: string
          is_active?: boolean | null
          pain_points?: string | null
          positioning_statement?: string | null
          product_positioning?: string | null
          target_audience?: string | null
          tone_descriptors?: string[] | null
          updated_at?: string | null
          why_choose_us?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_dna_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_dna_custom_fields: {
        Row: {
          brand_id: string
          created_at: string | null
          created_from_message_id: string | null
          field_key: string
          field_label: string
          field_value: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          brand_id: string
          created_at?: string | null
          created_from_message_id?: string | null
          field_key: string
          field_label: string
          field_value?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          brand_id?: string
          created_at?: string | null
          created_from_message_id?: string | null
          field_key?: string
          field_label?: string
          field_value?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_dna_custom_fields_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_dna_custom_fields_created_from_message_id_fkey"
            columns: ["created_from_message_id"]
            isOneToOne: false
            referencedRelation: "mentor_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_journey_events: {
        Row: {
          brand_id: string
          context: string | null
          created_at: string | null
          from_stage: string | null
          id: string
          to_stage: string
          trigger_type: string | null
        }
        Insert: {
          brand_id: string
          context?: string | null
          created_at?: string | null
          from_stage?: string | null
          id?: string
          to_stage: string
          trigger_type?: string | null
        }
        Update: {
          brand_id?: string
          context?: string | null
          created_at?: string | null
          from_stage?: string | null
          id?: string
          to_stage?: string
          trigger_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_journey_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_stage_data: {
        Row: {
          brand_id: string
          captured_from_message_id: string | null
          created_at: string | null
          field_key: string
          id: string
          stage_key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          brand_id: string
          captured_from_message_id?: string | null
          created_at?: string | null
          field_key: string
          id?: string
          stage_key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          brand_id?: string
          captured_from_message_id?: string | null
          created_at?: string | null
          field_key?: string
          id?: string
          stage_key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_stage_data_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_stage_data_captured_from_message_id_fkey"
            columns: ["captured_from_message_id"]
            isOneToOne: false
            referencedRelation: "mentor_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_stage_progress: {
        Row: {
          brand_id: string
          completed_at: string | null
          created_at: string | null
          id: string
          is_completed: boolean | null
          stage_key: string
          substage_index: number
        }
        Insert: {
          brand_id: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          stage_key: string
          substage_index: number
        }
        Update: {
          brand_id?: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          stage_key?: string
          substage_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "brand_stage_progress_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          completeness_score: number | null
          context_source: string | null
          created_at: string | null
          founded_year: string | null
          id: string
          industry: string | null
          is_active: boolean | null
          journey_stage: string | null
          journey_stage_updated_at: string | null
          location: string | null
          logo_url: string | null
          name: string
          onboarding_completed: boolean | null
          onboarding_skipped: boolean | null
          primary_color: string | null
          product_type: string | null
          secondary_color: string | null
          slug: string | null
          tagline: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completeness_score?: number | null
          context_source?: string | null
          created_at?: string | null
          founded_year?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          journey_stage?: string | null
          journey_stage_updated_at?: string | null
          location?: string | null
          logo_url?: string | null
          name: string
          onboarding_completed?: boolean | null
          onboarding_skipped?: boolean | null
          primary_color?: string | null
          product_type?: string | null
          secondary_color?: string | null
          slug?: string | null
          tagline?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completeness_score?: number | null
          context_source?: string | null
          created_at?: string | null
          founded_year?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          journey_stage?: string | null
          journey_stage_updated_at?: string | null
          location?: string | null
          logo_url?: string | null
          name?: string
          onboarding_completed?: boolean | null
          onboarding_skipped?: boolean | null
          primary_color?: string | null
          product_type?: string | null
          secondary_color?: string | null
          slug?: string | null
          tagline?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brands_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_posts: {
        Row: {
          asset_id: string | null
          brand_id: string
          campaign_creative_id: string | null
          content: string | null
          content_studio_creative_id: string | null
          copy_text: string | null
          created_at: string | null
          headline: string | null
          id: string
          platform: string
          reminder_email: string | null
          reminder_enabled: boolean | null
          reminder_sent: boolean | null
          reminder_timing_minutes: number | null
          scheduled_date: string
          scheduled_time: string
          status: string | null
          updated_at: string | null
          user_id: string
          visual_html: string | null
        }
        Insert: {
          asset_id?: string | null
          brand_id: string
          campaign_creative_id?: string | null
          content?: string | null
          content_studio_creative_id?: string | null
          copy_text?: string | null
          created_at?: string | null
          headline?: string | null
          id?: string
          platform: string
          reminder_email?: string | null
          reminder_enabled?: boolean | null
          reminder_sent?: boolean | null
          reminder_timing_minutes?: number | null
          scheduled_date: string
          scheduled_time: string
          status?: string | null
          updated_at?: string | null
          user_id: string
          visual_html?: string | null
        }
        Update: {
          asset_id?: string | null
          brand_id?: string
          campaign_creative_id?: string | null
          content?: string | null
          content_studio_creative_id?: string | null
          copy_text?: string | null
          created_at?: string | null
          headline?: string | null
          id?: string
          platform?: string
          reminder_email?: string | null
          reminder_enabled?: boolean | null
          reminder_sent?: boolean | null
          reminder_timing_minutes?: number | null
          scheduled_date?: string
          scheduled_time?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
          visual_html?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_posts_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_posts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_posts_campaign_creative_id_fkey"
            columns: ["campaign_creative_id"]
            isOneToOne: false
            referencedRelation: "campaign_creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_posts_content_studio_creative_id_fkey"
            columns: ["content_studio_creative_id"]
            isOneToOne: false
            referencedRelation: "content_studio_creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_creatives: {
        Row: {
          asset_id: string | null
          campaign_id: string
          copy_text: string | null
          created_at: string | null
          headline: string | null
          id: string
          platform: string
          scheduled_at: string | null
          subject_line: string | null
          visual_html: string | null
        }
        Insert: {
          asset_id?: string | null
          campaign_id: string
          copy_text?: string | null
          created_at?: string | null
          headline?: string | null
          id?: string
          platform: string
          scheduled_at?: string | null
          subject_line?: string | null
          visual_html?: string | null
        }
        Update: {
          asset_id?: string | null
          campaign_id?: string
          copy_text?: string | null
          created_at?: string | null
          headline?: string | null
          id?: string
          platform?: string
          scheduled_at?: string | null
          subject_line?: string | null
          visual_html?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_creatives_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_creatives_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          asset_id: string | null
          asset_type: string | null
          brand_id: string
          call_to_action: string | null
          campaign_goal: string | null
          created_at: string | null
          id: string
          key_benefit: string | null
          name: string
          output_id: string | null
          product_image_id: string | null
          product_name: string | null
          status: string | null
          target_audience: string | null
          tone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          asset_id?: string | null
          asset_type?: string | null
          brand_id: string
          call_to_action?: string | null
          campaign_goal?: string | null
          created_at?: string | null
          id?: string
          key_benefit?: string | null
          name: string
          output_id?: string | null
          product_image_id?: string | null
          product_name?: string | null
          status?: string | null
          target_audience?: string | null
          tone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          asset_id?: string | null
          asset_type?: string | null
          brand_id?: string
          call_to_action?: string | null
          campaign_goal?: string | null
          created_at?: string | null
          id?: string
          key_benefit?: string | null
          name?: string
          output_id?: string | null
          product_image_id?: string | null
          product_name?: string | null
          status?: string | null
          target_audience?: string | null
          tone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_output_id_fkey"
            columns: ["output_id"]
            isOneToOne: false
            referencedRelation: "template_outputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_product_image_id_fkey"
            columns: ["product_image_id"]
            isOneToOne: false
            referencedRelation: "project_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_platforms: {
        Row: {
          aspect_ratio: string | null
          character_limit: number | null
          copy_guidelines: string | null
          created_at: string | null
          icon: string | null
          id: string
          image_height: number | null
          image_width: number | null
          is_active: boolean | null
          name: string
          slug: string
          sort_order: number | null
        }
        Insert: {
          aspect_ratio?: string | null
          character_limit?: number | null
          copy_guidelines?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          image_height?: number | null
          image_width?: number | null
          is_active?: boolean | null
          name: string
          slug: string
          sort_order?: number | null
        }
        Update: {
          aspect_ratio?: string | null
          character_limit?: number | null
          copy_guidelines?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          image_height?: number | null
          image_width?: number | null
          is_active?: boolean | null
          name?: string
          slug?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      content_series_runs: {
        Row: {
          brief_id: string
          completed_at: string | null
          creatives_generated: number | null
          error_message: string | null
          id: string
          status: string | null
          trigger_type: string | null
          triggered_at: string | null
        }
        Insert: {
          brief_id: string
          completed_at?: string | null
          creatives_generated?: number | null
          error_message?: string | null
          id?: string
          status?: string | null
          trigger_type?: string | null
          triggered_at?: string | null
        }
        Update: {
          brief_id?: string
          completed_at?: string | null
          creatives_generated?: number | null
          error_message?: string | null
          id?: string
          status?: string | null
          trigger_type?: string | null
          triggered_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_series_runs_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "content_studio_briefs"
            referencedColumns: ["id"]
          },
        ]
      }
      content_studio_briefs: {
        Row: {
          brand_id: string
          brief: string | null
          campaign_goal: string | null
          created_at: string | null
          id: string
          is_series: boolean | null
          last_generated_at: string | null
          name: string
          next_generation_at: string | null
          output_id: string | null
          selected_platform_ids: string[] | null
          series_active: boolean | null
          series_interval: string | null
          status: string | null
          tone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          brand_id: string
          brief?: string | null
          campaign_goal?: string | null
          created_at?: string | null
          id?: string
          is_series?: boolean | null
          last_generated_at?: string | null
          name: string
          next_generation_at?: string | null
          output_id?: string | null
          selected_platform_ids?: string[] | null
          series_active?: boolean | null
          series_interval?: string | null
          status?: string | null
          tone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          brand_id?: string
          brief?: string | null
          campaign_goal?: string | null
          created_at?: string | null
          id?: string
          is_series?: boolean | null
          last_generated_at?: string | null
          name?: string
          next_generation_at?: string | null
          output_id?: string | null
          selected_platform_ids?: string[] | null
          series_active?: boolean | null
          series_interval?: string | null
          status?: string | null
          tone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_studio_briefs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      content_studio_creatives: {
        Row: {
          brief_id: string
          calendar_post_id: string | null
          copy_text: string | null
          created_at: string | null
          generation_session_id: string | null
          hashtags: string[] | null
          headline: string | null
          id: string
          is_approved: boolean | null
          is_saved_to_library: boolean
          platform_id: string
          scheduled_at: string | null
          status: string | null
          subject_line: string | null
          template_id: string | null
          updated_at: string | null
          visual_html: string | null
          visual_thumbnail_url: string | null
        }
        Insert: {
          brief_id: string
          calendar_post_id?: string | null
          copy_text?: string | null
          created_at?: string | null
          generation_session_id?: string | null
          hashtags?: string[] | null
          headline?: string | null
          id?: string
          is_approved?: boolean | null
          is_saved_to_library?: boolean
          platform_id: string
          scheduled_at?: string | null
          status?: string | null
          subject_line?: string | null
          template_id?: string | null
          updated_at?: string | null
          visual_html?: string | null
          visual_thumbnail_url?: string | null
        }
        Update: {
          brief_id?: string
          calendar_post_id?: string | null
          copy_text?: string | null
          created_at?: string | null
          generation_session_id?: string | null
          hashtags?: string[] | null
          headline?: string | null
          id?: string
          is_approved?: boolean | null
          is_saved_to_library?: boolean
          platform_id?: string
          scheduled_at?: string | null
          status?: string | null
          subject_line?: string | null
          template_id?: string | null
          updated_at?: string | null
          visual_html?: string | null
          visual_thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_studio_creatives_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "content_studio_briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_studio_creatives_calendar_post_id_fkey"
            columns: ["calendar_post_id"]
            isOneToOne: false
            referencedRelation: "calendar_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_studio_creatives_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "content_platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_studio_creatives_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "prostudio_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_applications: {
        Row: {
          created_at: string | null
          experience: string | null
          id: string
          motivation: string | null
          portfolio_url: string | null
          prompt_engineering_experience: string | null
          reviewed_at: string | null
          reviewer_notes: string | null
          sample_prompt: string | null
          status: string | null
          user_id: string
          why_apply: string
        }
        Insert: {
          created_at?: string | null
          experience?: string | null
          id?: string
          motivation?: string | null
          portfolio_url?: string | null
          prompt_engineering_experience?: string | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
          sample_prompt?: string | null
          status?: string | null
          user_id: string
          why_apply: string
        }
        Update: {
          created_at?: string | null
          experience?: string | null
          id?: string
          motivation?: string | null
          portfolio_url?: string | null
          prompt_engineering_experience?: string | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
          sample_prompt?: string | null
          status?: string | null
          user_id?: string
          why_apply?: string
        }
        Relationships: []
      }
      creator_profiles: {
        Row: {
          applied_at: string | null
          approved_at: string | null
          approved_by: string
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string
          id: string
          is_approved: boolean | null
          total_templates: number | null
          total_uses: number | null
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          applied_at?: string | null
          approved_at?: string | null
          approved_by: string
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name: string
          id: string
          is_approved?: boolean | null
          total_templates?: number | null
          total_uses?: number | null
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          applied_at?: string | null
          approved_at?: string | null
          approved_by?: string
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string
          id?: string
          is_approved?: boolean | null
          total_templates?: number | null
          total_uses?: number | null
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          asset_id: string | null
          audience: string | null
          brand_id: string
          created_at: string | null
          document_type: string
          generated_html: string | null
          id: string
          key_message: string | null
          key_points: string | null
          name: string
          purpose: string | null
          tone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          asset_id?: string | null
          audience?: string | null
          brand_id: string
          created_at?: string | null
          document_type: string
          generated_html?: string | null
          id?: string
          key_message?: string | null
          key_points?: string | null
          name: string
          purpose?: string | null
          tone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          asset_id?: string | null
          audience?: string | null
          brand_id?: string
          created_at?: string | null
          document_type?: string
          generated_html?: string | null
          id?: string
          key_message?: string | null
          key_points?: string | null
          name?: string
          purpose?: string | null
          tone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_stage_fields: {
        Row: {
          created_at: string | null
          field_description: string | null
          field_key: string
          field_label: string
          field_type: string | null
          id: string
          is_required: boolean | null
          maps_to_dna_field: string | null
          sort_order: number | null
          stage_key: string
          substage_index: number | null
        }
        Insert: {
          created_at?: string | null
          field_description?: string | null
          field_key: string
          field_label: string
          field_type?: string | null
          id?: string
          is_required?: boolean | null
          maps_to_dna_field?: string | null
          sort_order?: number | null
          stage_key: string
          substage_index?: number | null
        }
        Update: {
          created_at?: string | null
          field_description?: string | null
          field_key?: string
          field_label?: string
          field_type?: string | null
          id?: string
          is_required?: boolean | null
          maps_to_dna_field?: string | null
          sort_order?: number | null
          stage_key?: string
          substage_index?: number | null
        }
        Relationships: []
      }
      journey_stages: {
        Row: {
          created_at: string | null
          description: string
          emoji: string
          id: string
          is_active: boolean | null
          mentor_focus: string | null
          name: string
          relevant_modules: string[] | null
          sort_order: number
          stage_key: string
          substages: Json | null
          suggested_next_steps: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          emoji?: string
          id?: string
          is_active?: boolean | null
          mentor_focus?: string | null
          name: string
          relevant_modules?: string[] | null
          sort_order?: number
          stage_key: string
          substages?: Json | null
          suggested_next_steps?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          emoji?: string
          id?: string
          is_active?: boolean | null
          mentor_focus?: string | null
          name?: string
          relevant_modules?: string[] | null
          sort_order?: number
          stage_key?: string
          substages?: Json | null
          suggested_next_steps?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      mentor_choice_prompts: {
        Row: {
          conversation_id: string
          created_at: string | null
          dna_field: string | null
          id: string
          is_answered: boolean | null
          message_id: string
          options: Json
          prompt_type: string
          question: string
          selected_option: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          dna_field?: string | null
          id?: string
          is_answered?: boolean | null
          message_id: string
          options?: Json
          prompt_type: string
          question: string
          selected_option?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          dna_field?: string | null
          id?: string
          is_answered?: boolean | null
          message_id?: string
          options?: Json
          prompt_type?: string
          question?: string
          selected_option?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mentor_choice_prompts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "mentor_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_choice_prompts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "mentor_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_conversations: {
        Row: {
          brand_id: string
          created_at: string | null
          id: string
          last_message_at: string | null
          message_count: number | null
        }
        Insert: {
          brand_id: string
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          message_count?: number | null
        }
        Update: {
          brand_id?: string
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          message_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mentor_conversations_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_messages: {
        Row: {
          ai_response_failed: boolean | null
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          role: string
        }
        Insert: {
          ai_response_failed?: boolean | null
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          role: string
        }
        Update: {
          ai_response_failed?: boolean | null
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "mentor_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          brand_id: string
          category: string
          conversation_id: string
          created_at: string | null
          id: string
          is_substage_milestone: boolean | null
          message_id: string | null
          name: string
          stage_key: string | null
        }
        Insert: {
          brand_id: string
          category: string
          conversation_id: string
          created_at?: string | null
          id?: string
          is_substage_milestone?: boolean | null
          message_id?: string | null
          name: string
          stage_key?: string | null
        }
        Update: {
          brand_id?: string
          category?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          is_substage_milestone?: boolean | null
          message_id?: string | null
          name?: string
          stage_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "milestones_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "mentor_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "mentor_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string | null
          brand_id: string | null
          created_at: string | null
          email_sent: boolean | null
          email_sent_at: string | null
          id: string
          is_read: boolean | null
          related_id: string | null
          related_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body?: string | null
          brand_id?: string | null
          created_at?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          id?: string
          is_read?: boolean | null
          related_id?: string | null
          related_type?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          body?: string | null
          brand_id?: string | null
          created_at?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          id?: string
          is_read?: boolean | null
          related_id?: string | null
          related_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          brand_status: string | null
          created_at: string | null
          credits_remaining: number | null
          email: string | null
          full_name: string | null
          id: string
          is_creator: boolean | null
          onboarding_completed: boolean | null
          plan: string | null
          plan_renewal_date: string | null
          profession: string | null
          role: string | null
          team_size: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          brand_status?: string | null
          created_at?: string | null
          credits_remaining?: number | null
          email?: string | null
          full_name?: string | null
          id: string
          is_creator?: boolean | null
          onboarding_completed?: boolean | null
          plan?: string | null
          plan_renewal_date?: string | null
          profession?: string | null
          role?: string | null
          team_size?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          brand_status?: string | null
          created_at?: string | null
          credits_remaining?: number | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_creator?: boolean | null
          onboarding_completed?: boolean | null
          plan?: string | null
          plan_renewal_date?: string | null
          profession?: string | null
          role?: string | null
          team_size?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      project_assets: {
        Row: {
          brand_id: string
          content_text: string | null
          created_at: string | null
          description: string | null
          file_size_bytes: number | null
          file_type: string
          file_url: string | null
          id: string
          is_pinned: boolean | null
          is_primary: boolean | null
          message_id: string | null
          mime_type: string | null
          name: string
          source: string
          stage_key: string | null
          storage_path: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          brand_id: string
          content_text?: string | null
          created_at?: string | null
          description?: string | null
          file_size_bytes?: number | null
          file_type: string
          file_url?: string | null
          id?: string
          is_pinned?: boolean | null
          is_primary?: boolean | null
          message_id?: string | null
          mime_type?: string | null
          name: string
          source: string
          stage_key?: string | null
          storage_path?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          brand_id?: string
          content_text?: string | null
          created_at?: string | null
          description?: string | null
          file_size_bytes?: number | null
          file_type?: string
          file_url?: string | null
          id?: string
          is_pinned?: boolean | null
          is_primary?: boolean | null
          message_id?: string | null
          mime_type?: string | null
          name?: string
          source?: string
          stage_key?: string | null
          storage_path?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_assets_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assets_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "mentor_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      prostudio_templates: {
        Row: {
          admin_notes: string | null
          admin_signature: string | null
          best_for: string[] | null
          category: string
          cover_image_url: string | null
          created_at: string | null
          creator_id: string
          description: string | null
          digital_output_type: string | null
          generation_prompt: string | null
          id: string
          is_free: boolean | null
          name: string
          preview_background: string | null
          price_credits: number | null
          reviewed_at: string | null
          slug: string | null
          sort_order: number | null
          status: string | null
          template_type: string
          updated_at: string | null
          uses_count: number | null
        }
        Insert: {
          admin_notes?: string | null
          admin_signature?: string | null
          best_for?: string[] | null
          category: string
          cover_image_url?: string | null
          created_at?: string | null
          creator_id: string
          description?: string | null
          digital_output_type?: string | null
          generation_prompt?: string | null
          id?: string
          is_free?: boolean | null
          name: string
          preview_background?: string | null
          price_credits?: number | null
          reviewed_at?: string | null
          slug?: string | null
          sort_order?: number | null
          status?: string | null
          template_type: string
          updated_at?: string | null
          uses_count?: number | null
        }
        Update: {
          admin_notes?: string | null
          admin_signature?: string | null
          best_for?: string[] | null
          category?: string
          cover_image_url?: string | null
          created_at?: string | null
          creator_id?: string
          description?: string | null
          digital_output_type?: string | null
          generation_prompt?: string | null
          id?: string
          is_free?: boolean | null
          name?: string
          preview_background?: string | null
          price_credits?: number | null
          reviewed_at?: string | null
          slug?: string | null
          sort_order?: number | null
          status?: string | null
          template_type?: string
          updated_at?: string | null
          uses_count?: number | null
        }
        Relationships: []
      }
      reel_scenes: {
        Row: {
          created_at: string | null
          duration_end: string | null
          duration_start: string | null
          id: string
          music_mood: string | null
          on_screen_text: string | null
          reel_id: string
          scene_number: number
          transition: string | null
          visual_direction: string | null
          voiceover: string | null
        }
        Insert: {
          created_at?: string | null
          duration_end?: string | null
          duration_start?: string | null
          id?: string
          music_mood?: string | null
          on_screen_text?: string | null
          reel_id: string
          scene_number: number
          transition?: string | null
          visual_direction?: string | null
          voiceover?: string | null
        }
        Update: {
          created_at?: string | null
          duration_end?: string | null
          duration_start?: string | null
          id?: string
          music_mood?: string | null
          on_screen_text?: string | null
          reel_id?: string
          scene_number?: number
          transition?: string | null
          visual_direction?: string | null
          voiceover?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reel_scenes_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
        ]
      }
      reels: {
        Row: {
          brand_id: string
          created_at: string | null
          duration_seconds: number | null
          goal: string | null
          id: string
          key_message: string | null
          name: string
          platform: string | null
          template_id: string | null
          tone: string | null
          topic: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string | null
          duration_seconds?: number | null
          goal?: string | null
          id?: string
          key_message?: string | null
          name: string
          platform?: string | null
          template_id?: string | null
          tone?: string | null
          topic?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string | null
          duration_seconds?: number | null
          goal?: string | null
          id?: string
          key_message?: string | null
          name?: string
          platform?: string | null
          template_id?: string | null
          tone?: string | null
          topic?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reels_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reels_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "prostudio_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reels_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_elements: {
        Row: {
          brand_id: string | null
          created_at: string | null
          created_by: string | null
          element_type: string
          html_snippet: string
          id: string
          is_public: boolean | null
          name: string
          preview_svg: string | null
          snippet_hash: string | null
          source: string | null
          tags: string[] | null
          uses_count: number | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string | null
          created_by?: string | null
          element_type: string
          html_snippet: string
          id?: string
          is_public?: boolean | null
          name: string
          preview_svg?: string | null
          snippet_hash?: string | null
          source?: string | null
          tags?: string[] | null
          uses_count?: number | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string | null
          created_by?: string | null
          element_type?: string
          html_snippet?: string
          id?: string
          is_public?: boolean | null
          name?: string
          preview_svg?: string | null
          snippet_hash?: string | null
          source?: string | null
          tags?: string[] | null
          uses_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "studio_elements_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_sessions: {
        Row: {
          asset_id: string | null
          brand_id: string
          brief_id: string | null
          created_at: string
          creative_id: string | null
          generation_params: Json | null
          id: string
          platform_height: number | null
          platform_slug: string | null
          platform_width: number | null
          source_module: string
          template_id: string | null
          template_output_id: string | null
          user_id: string
          version: number
          visual_html: string
        }
        Insert: {
          asset_id?: string | null
          brand_id: string
          brief_id?: string | null
          created_at?: string
          creative_id?: string | null
          generation_params?: Json | null
          id?: string
          platform_height?: number | null
          platform_slug?: string | null
          platform_width?: number | null
          source_module: string
          template_id?: string | null
          template_output_id?: string | null
          user_id: string
          version?: number
          visual_html: string
        }
        Update: {
          asset_id?: string | null
          brand_id?: string
          brief_id?: string | null
          created_at?: string
          creative_id?: string | null
          generation_params?: Json | null
          id?: string
          platform_height?: number | null
          platform_slug?: string | null
          platform_width?: number | null
          source_module?: string
          template_id?: string | null
          template_output_id?: string | null
          user_id?: string
          version?: number
          visual_html?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_sessions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_sessions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_sessions_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "content_studio_briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_sessions_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "content_studio_creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_sessions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "prostudio_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_sessions_template_output_id_fkey"
            columns: ["template_output_id"]
            isOneToOne: false
            referencedRelation: "template_outputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      template_outputs: {
        Row: {
          aspect_ratio: string | null
          brand_id: string | null
          created_at: string | null
          generation_params: Json | null
          generation_session_id: string | null
          id: string
          is_downloaded: boolean | null
          is_saved_to_library: boolean | null
          output_data: string | null
          output_html: string | null
          output_image_url: string | null
          output_storage_path: string | null
          output_type: string | null
          product_image_used: boolean | null
          style_intensity: number | null
          template_id: string | null
          user_id: string
          variation_index: number | null
        }
        Insert: {
          aspect_ratio?: string | null
          brand_id?: string | null
          created_at?: string | null
          generation_params?: Json | null
          generation_session_id?: string | null
          id?: string
          is_downloaded?: boolean | null
          is_saved_to_library?: boolean | null
          output_data?: string | null
          output_html?: string | null
          output_image_url?: string | null
          output_storage_path?: string | null
          output_type?: string | null
          product_image_used?: boolean | null
          style_intensity?: number | null
          template_id?: string | null
          user_id: string
          variation_index?: number | null
        }
        Update: {
          aspect_ratio?: string | null
          brand_id?: string | null
          created_at?: string | null
          generation_params?: Json | null
          generation_session_id?: string | null
          id?: string
          is_downloaded?: boolean | null
          is_saved_to_library?: boolean | null
          output_data?: string | null
          output_html?: string | null
          output_image_url?: string | null
          output_storage_path?: string | null
          output_type?: string | null
          product_image_used?: boolean | null
          style_intensity?: number | null
          template_id?: string | null
          user_id?: string
          variation_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "template_outputs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_outputs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "prostudio_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      template_preview_images: {
        Row: {
          caption: string | null
          created_at: string | null
          id: string
          image_url: string
          is_cover: boolean | null
          product_used: string | null
          sort_order: number | null
          storage_path: string
          template_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          id?: string
          image_url: string
          is_cover?: boolean | null
          product_used?: string | null
          sort_order?: number | null
          storage_path: string
          template_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          id?: string
          image_url?: string
          is_cover?: boolean | null
          product_used?: string | null
          sort_order?: number | null
          storage_path?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_preview_images_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "prostudio_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      template_saves: {
        Row: {
          created_at: string | null
          id: string
          template_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          template_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_saves_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "prostudio_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_model_preferences: {
        Row: {
          created_at: string | null
          id: string
          model_id: string | null
          task_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          model_id?: string | null
          task_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          model_id?: string | null
          task_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_model_preferences_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_creator: {
        Args: { admin_notes?: string; application_id: string }
        Returns: undefined
      }
      increment: { Args: { x: number }; Returns: number }
      reject_creator: {
        Args: { admin_notes?: string; application_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
