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
      ai_generation_pricing: {
        Row: {
          base_cost: number
          complexity_multipliers: Json | null
          created_at: string
          description: string | null
          display_name: string
          feature_multipliers: Json | null
          id: string
          is_active: boolean
          model_multipliers: Json | null
          per_platform_cost: number
          pricing_key: string
          updated_at: string
        }
        Insert: {
          base_cost?: number
          complexity_multipliers?: Json | null
          created_at?: string
          description?: string | null
          display_name: string
          feature_multipliers?: Json | null
          id?: string
          is_active?: boolean
          model_multipliers?: Json | null
          per_platform_cost?: number
          pricing_key: string
          updated_at?: string
        }
        Update: {
          base_cost?: number
          complexity_multipliers?: Json | null
          created_at?: string
          description?: string | null
          display_name?: string
          feature_multipliers?: Json | null
          id?: string
          is_active?: boolean
          model_multipliers?: Json | null
          per_platform_cost?: number
          pricing_key?: string
          updated_at?: string
        }
        Relationships: []
      }
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
          is_ai_discovered: boolean
          stage_key: string
          status: string | null
          updated_at: string | null
          value: string | null
        }
        Insert: {
          brand_id: string
          captured_from_message_id?: string | null
          created_at?: string | null
          field_key: string
          id?: string
          is_ai_discovered?: boolean
          stage_key: string
          status?: string | null
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          brand_id?: string
          captured_from_message_id?: string | null
          created_at?: string | null
          field_key?: string
          id?: string
          is_ai_discovered?: boolean
          stage_key?: string
          status?: string | null
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
          auto_layout_enabled: boolean | null
          character_limit: number | null
          copy_guidelines: string | null
          created_at: string | null
          icon: string | null
          id: string
          image_height: number | null
          image_width: number | null
          is_active: boolean | null
          max_headline_size: number | null
          min_body_size: number | null
          min_cta_size: number | null
          min_headline_size: number | null
          name: string
          occupancy_target: number | null
          platform_render_rules: Json | null
          preferred_layouts: string[] | null
          required_zones: Json | null
          safe_zone_bottom: number | null
          safe_zone_left: number | null
          safe_zone_right: number | null
          safe_zone_top: number | null
          slug: string
          sort_order: number | null
          supports_svg: boolean | null
          typography_scale: Json | null
          visual_density: string | null
        }
        Insert: {
          aspect_ratio?: string | null
          auto_layout_enabled?: boolean | null
          character_limit?: number | null
          copy_guidelines?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          image_height?: number | null
          image_width?: number | null
          is_active?: boolean | null
          max_headline_size?: number | null
          min_body_size?: number | null
          min_cta_size?: number | null
          min_headline_size?: number | null
          name: string
          occupancy_target?: number | null
          platform_render_rules?: Json | null
          preferred_layouts?: string[] | null
          required_zones?: Json | null
          safe_zone_bottom?: number | null
          safe_zone_left?: number | null
          safe_zone_right?: number | null
          safe_zone_top?: number | null
          slug: string
          sort_order?: number | null
          supports_svg?: boolean | null
          typography_scale?: Json | null
          visual_density?: string | null
        }
        Update: {
          aspect_ratio?: string | null
          auto_layout_enabled?: boolean | null
          character_limit?: number | null
          copy_guidelines?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          image_height?: number | null
          image_width?: number | null
          is_active?: boolean | null
          max_headline_size?: number | null
          min_body_size?: number | null
          min_cta_size?: number | null
          min_headline_size?: number | null
          name?: string
          occupancy_target?: number | null
          platform_render_rules?: Json | null
          preferred_layouts?: string[] | null
          required_zones?: Json | null
          safe_zone_bottom?: number | null
          safe_zone_left?: number | null
          safe_zone_right?: number | null
          safe_zone_top?: number | null
          slug?: string
          sort_order?: number | null
          supports_svg?: boolean | null
          typography_scale?: Json | null
          visual_density?: string | null
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
          actual_credits_used: number | null
          ai_freedom: number | null
          brand_id: string
          brief: string | null
          campaign_goal: string | null
          created_at: string | null
          creative_mode: string | null
          estimated_credits: number | null
          generation_settings: Json | null
          generation_version: number | null
          id: string
          image_density: number | null
          is_series: boolean | null
          last_generated_at: string | null
          layout_complexity: string | null
          name: string
          next_generation_at: string | null
          output_id: string | null
          selected_library_assets: Json | null
          selected_platform_ids: string[] | null
          series_active: boolean | null
          series_interval: string | null
          status: string | null
          updated_at: string | null
          user_id: string
          visual_assets: Json | null
          visual_direction: string[] | null
        }
        Insert: {
          actual_credits_used?: number | null
          ai_freedom?: number | null
          brand_id: string
          brief?: string | null
          campaign_goal?: string | null
          created_at?: string | null
          creative_mode?: string | null
          estimated_credits?: number | null
          generation_settings?: Json | null
          generation_version?: number | null
          id?: string
          image_density?: number | null
          is_series?: boolean | null
          last_generated_at?: string | null
          layout_complexity?: string | null
          name: string
          next_generation_at?: string | null
          output_id?: string | null
          selected_library_assets?: Json | null
          selected_platform_ids?: string[] | null
          series_active?: boolean | null
          series_interval?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
          visual_assets?: Json | null
          visual_direction?: string[] | null
        }
        Update: {
          actual_credits_used?: number | null
          ai_freedom?: number | null
          brand_id?: string
          brief?: string | null
          campaign_goal?: string | null
          created_at?: string | null
          creative_mode?: string | null
          estimated_credits?: number | null
          generation_settings?: Json | null
          generation_version?: number | null
          id?: string
          image_density?: number | null
          is_series?: boolean | null
          last_generated_at?: string | null
          layout_complexity?: string | null
          name?: string
          next_generation_at?: string | null
          output_id?: string | null
          selected_library_assets?: Json | null
          selected_platform_ids?: string[] | null
          series_active?: boolean | null
          series_interval?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
          visual_assets?: Json | null
          visual_direction?: string[] | null
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
          export_unstable: boolean | null
          generation_fallback_reason: string | null
          generation_quality_score: number | null
          generation_session_id: string | null
          generation_telemetry: Json | null
          hashtags: string[] | null
          headline: string | null
          id: string
          is_approved: boolean | null
          is_saved_to_library: boolean
          platform_id: string
          render_engine: string | null
          scene_json: Json | null
          scene_version: string | null
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
          export_unstable?: boolean | null
          generation_fallback_reason?: string | null
          generation_quality_score?: number | null
          generation_session_id?: string | null
          generation_telemetry?: Json | null
          hashtags?: string[] | null
          headline?: string | null
          id?: string
          is_approved?: boolean | null
          is_saved_to_library?: boolean
          platform_id: string
          render_engine?: string | null
          scene_json?: Json | null
          scene_version?: string | null
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
          export_unstable?: boolean | null
          generation_fallback_reason?: string | null
          generation_quality_score?: number | null
          generation_session_id?: string | null
          generation_telemetry?: Json | null
          hashtags?: string[] | null
          headline?: string | null
          id?: string
          is_approved?: boolean | null
          is_saved_to_library?: boolean
          platform_id?: string
          render_engine?: string | null
          scene_json?: Json | null
          scene_version?: string | null
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
      creative_versions: {
        Row: {
          brief_id: string
          change_size_bytes: number | null
          change_summary: string | null
          content_hash: string
          copy_text: string | null
          created_at: string
          creative_id: string
          hashtags: string[] | null
          headline: string | null
          id: string
          is_current: boolean | null
          is_restored_version: boolean | null
          nodes_added: number | null
          nodes_deleted: number | null
          nodes_modified: number | null
          nodes_unchanged: number | null
          parent_version_id: string | null
          restored_from_version_id: string | null
          scene_json: Json | null
          scene_patch: Json | null
          snapshot_type: Database["public"]["Enums"]["snapshot_storage_type"]
          source_action: string | null
          source_metadata: Json | null
          source_type: Database["public"]["Enums"]["version_source_type"]
          subject_line: string | null
          user_id: string
          version_name: string | null
          version_number: number
          version_type: Database["public"]["Enums"]["creative_version_type"]
          visual_html: string | null
          visual_patch: Json | null
        }
        Insert: {
          brief_id: string
          change_size_bytes?: number | null
          change_summary?: string | null
          content_hash: string
          copy_text?: string | null
          created_at?: string
          creative_id: string
          hashtags?: string[] | null
          headline?: string | null
          id?: string
          is_current?: boolean | null
          is_restored_version?: boolean | null
          nodes_added?: number | null
          nodes_deleted?: number | null
          nodes_modified?: number | null
          nodes_unchanged?: number | null
          parent_version_id?: string | null
          restored_from_version_id?: string | null
          scene_json?: Json | null
          scene_patch?: Json | null
          snapshot_type?: Database["public"]["Enums"]["snapshot_storage_type"]
          source_action?: string | null
          source_metadata?: Json | null
          source_type: Database["public"]["Enums"]["version_source_type"]
          subject_line?: string | null
          user_id: string
          version_name?: string | null
          version_number: number
          version_type?: Database["public"]["Enums"]["creative_version_type"]
          visual_html?: string | null
          visual_patch?: Json | null
        }
        Update: {
          brief_id?: string
          change_size_bytes?: number | null
          change_summary?: string | null
          content_hash?: string
          copy_text?: string | null
          created_at?: string
          creative_id?: string
          hashtags?: string[] | null
          headline?: string | null
          id?: string
          is_current?: boolean | null
          is_restored_version?: boolean | null
          nodes_added?: number | null
          nodes_deleted?: number | null
          nodes_modified?: number | null
          nodes_unchanged?: number | null
          parent_version_id?: string | null
          restored_from_version_id?: string | null
          scene_json?: Json | null
          scene_patch?: Json | null
          snapshot_type?: Database["public"]["Enums"]["snapshot_storage_type"]
          source_action?: string | null
          source_metadata?: Json | null
          source_type?: Database["public"]["Enums"]["version_source_type"]
          subject_line?: string | null
          user_id?: string
          version_name?: string | null
          version_number?: number
          version_type?: Database["public"]["Enums"]["creative_version_type"]
          visual_html?: string | null
          visual_patch?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "creative_versions_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "content_studio_briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_versions_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "content_studio_creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_versions_parent_version_id_fkey"
            columns: ["parent_version_id"]
            isOneToOne: false
            referencedRelation: "creative_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_versions_parent_version_id_fkey"
            columns: ["parent_version_id"]
            isOneToOne: false
            referencedRelation: "version_history_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_versions_restored_from_version_id_fkey"
            columns: ["restored_from_version_id"]
            isOneToOne: false
            referencedRelation: "creative_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_versions_restored_from_version_id_fkey"
            columns: ["restored_from_version_id"]
            isOneToOne: false
            referencedRelation: "version_history_view"
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
      credit_packages: {
        Row: {
          active: boolean
          badge: string | null
          created_at: string | null
          credits: number
          description: string | null
          id: string
          is_subscription: boolean
          max_workspaces: number | null
          monthly_credits: number | null
          name: string
          price_usd: number
          priority_generation: boolean
          rollover_days: number | null
          rollover_enabled: boolean
          slug: string | null
          sort_order: number
          stripe_price_id: string | null
          stripe_product_id: string | null
          updated_at: string | null
          watermark_exports: boolean
        }
        Insert: {
          active?: boolean
          badge?: string | null
          created_at?: string | null
          credits: number
          description?: string | null
          id?: string
          is_subscription?: boolean
          max_workspaces?: number | null
          monthly_credits?: number | null
          name: string
          price_usd: number
          priority_generation?: boolean
          rollover_days?: number | null
          rollover_enabled?: boolean
          slug?: string | null
          sort_order?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string | null
          watermark_exports?: boolean
        }
        Update: {
          active?: boolean
          badge?: string | null
          created_at?: string | null
          credits?: number
          description?: string | null
          id?: string
          is_subscription?: boolean
          max_workspaces?: number | null
          monthly_credits?: number | null
          name?: string
          price_usd?: number
          priority_generation?: boolean
          rollover_days?: number | null
          rollover_enabled?: boolean
          slug?: string | null
          sort_order?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string | null
          watermark_exports?: boolean
        }
        Relationships: []
      }
      credit_purchases: {
        Row: {
          amount_usd: number
          created_at: string | null
          credits: number
          id: string
          metadata: Json | null
          package_id: string | null
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          user_id: string
        }
        Insert: {
          amount_usd: number
          created_at?: string | null
          credits: number
          id?: string
          metadata?: Json | null
          package_id?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          user_id: string
        }
        Update: {
          amount_usd?: number
          created_at?: string | null
          credits?: number
          id?: string
          metadata?: Json | null
          package_id?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_purchases_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "credit_packages"
            referencedColumns: ["id"]
          },
        ]
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
      generation_assets: {
        Row: {
          asset_type: string
          asset_url: string | null
          created_at: string
          generation_id: string
          id: string
          metadata: Json | null
          platform: string
          status: string
        }
        Insert: {
          asset_type: string
          asset_url?: string | null
          created_at?: string
          generation_id: string
          id?: string
          metadata?: Json | null
          platform: string
          status?: string
        }
        Update: {
          asset_type?: string
          asset_url?: string | null
          created_at?: string
          generation_id?: string
          id?: string
          metadata?: Json | null
          platform?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_assets_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_billing_events: {
        Row: {
          billing_status: string | null
          completed_at: string | null
          created_at: string | null
          credits: number | null
          credits_captured: number | null
          credits_refunded: number | null
          credits_reserved: number | null
          event_type: string
          generation_id: string
          generation_session_id: string | null
          id: string
          idempotency_key: string | null
          metadata: Json | null
          pricing_snapshot: Json | null
          provider_cost_usd: number | null
          refunded_at: string | null
          render_engine: string | null
          user_id: string | null
          wallet_id: string | null
        }
        Insert: {
          billing_status?: string | null
          completed_at?: string | null
          created_at?: string | null
          credits?: number | null
          credits_captured?: number | null
          credits_refunded?: number | null
          credits_reserved?: number | null
          event_type: string
          generation_id: string
          generation_session_id?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          pricing_snapshot?: Json | null
          provider_cost_usd?: number | null
          refunded_at?: string | null
          render_engine?: string | null
          user_id?: string | null
          wallet_id?: string | null
        }
        Update: {
          billing_status?: string | null
          completed_at?: string | null
          created_at?: string | null
          credits?: number | null
          credits_captured?: number | null
          credits_refunded?: number | null
          credits_reserved?: number | null
          event_type?: string
          generation_id?: string
          generation_session_id?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          pricing_snapshot?: Json | null
          provider_cost_usd?: number | null
          refunded_at?: string | null
          render_engine?: string | null
          user_id?: string | null
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generation_billing_events_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_billing_events_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallet_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_billing_events_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      generations: {
        Row: {
          ai_completed_at: string | null
          ai_started_at: string | null
          completed_at: string | null
          created_at: string
          credits_captured: number
          credits_reserved: number
          id: string
          metadata: Json | null
          platform: string | null
          prompt: string | null
          provider: string | null
          provider_cost_usd: number | null
          provider_model: string | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_completed_at?: string | null
          ai_started_at?: string | null
          completed_at?: string | null
          created_at?: string
          credits_captured?: number
          credits_reserved?: number
          id?: string
          metadata?: Json | null
          platform?: string | null
          prompt?: string | null
          provider?: string | null
          provider_cost_usd?: number | null
          provider_model?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_completed_at?: string | null
          ai_started_at?: string | null
          completed_at?: string | null
          created_at?: string
          credits_captured?: number
          credits_reserved?: number
          id?: string
          metadata?: Json | null
          platform?: string | null
          prompt?: string | null
          provider?: string | null
          provider_cost_usd?: number | null
          provider_model?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      platform_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
        }
        Relationships: []
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
      stripe_customers: {
        Row: {
          created_at: string | null
          id: string
          stripe_customer_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          stripe_customer_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          stripe_customer_id?: string
          user_id?: string
        }
        Relationships: []
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
          render_engine: string | null
          scene_json: Json | null
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
          render_engine?: string | null
          scene_json?: Json | null
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
          render_engine?: string | null
          scene_json?: Json | null
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
          render_engine: string | null
          scene_json: Json | null
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
          render_engine?: string | null
          scene_json?: Json | null
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
          render_engine?: string | null
          scene_json?: Json | null
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
      version_annotations: {
        Row: {
          annotation_type: Database["public"]["Enums"]["annotation_type"]
          content: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
          version_id: string
        }
        Insert: {
          annotation_type?: Database["public"]["Enums"]["annotation_type"]
          content: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          version_id: string
        }
        Update: {
          annotation_type?: Database["public"]["Enums"]["annotation_type"]
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "version_annotations_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "creative_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "version_annotations_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "version_history_view"
            referencedColumns: ["id"]
          },
        ]
      }
      version_snapshots: {
        Row: {
          compressed_scene_json: string | null
          compressed_size_bytes: number | null
          compression_algorithm: string | null
          content_hash: string
          created_at: string
          creative_id: string
          id: string
          original_size_bytes: number | null
          snapshot_reason: Database["public"]["Enums"]["snapshot_reason_type"]
          version_range_end: number
          version_range_start: number
        }
        Insert: {
          compressed_scene_json?: string | null
          compressed_size_bytes?: number | null
          compression_algorithm?: string | null
          content_hash: string
          created_at?: string
          creative_id: string
          id?: string
          original_size_bytes?: number | null
          snapshot_reason?: Database["public"]["Enums"]["snapshot_reason_type"]
          version_range_end: number
          version_range_start: number
        }
        Update: {
          compressed_scene_json?: string | null
          compressed_size_bytes?: number | null
          compression_algorithm?: string | null
          content_hash?: string
          created_at?: string
          creative_id?: string
          id?: string
          original_size_bytes?: number | null
          snapshot_reason?: Database["public"]["Enums"]["snapshot_reason_type"]
          version_range_end?: number
          version_range_start?: number
        }
        Relationships: [
          {
            foreignKeyName: "version_snapshots_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "content_studio_creatives"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          id: string
          metadata: Json | null
          reference_id: string | null
          reference_type: string | null
          reserved_after: number
          reserved_before: number
          transaction_type: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          reserved_after?: number
          reserved_before?: number
          transaction_type: string
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          reserved_after?: number
          reserved_before?: number
          transaction_type?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallet_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          lifetime_earned: number
          lifetime_refunded: number
          lifetime_spent: number
          reserved_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          lifetime_earned?: number
          lifetime_refunded?: number
          lifetime_spent?: number
          reserved_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          lifetime_earned?: number
          lifetime_refunded?: number
          lifetime_spent?: number
          reserved_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      version_history_view: {
        Row: {
          age_text: string | null
          brief_id: string | null
          change_summary: string | null
          created_at: string | null
          creative_id: string | null
          id: string | null
          is_current: boolean | null
          is_restored_version: boolean | null
          nodes_added: number | null
          nodes_deleted: number | null
          nodes_modified: number | null
          parent_version_id: string | null
          restored_from_version_id: string | null
          source_action: string | null
          source_type: Database["public"]["Enums"]["version_source_type"] | null
          user_id: string | null
          version_name: string | null
          version_number: number | null
          version_type:
            | Database["public"]["Enums"]["creative_version_type"]
            | null
        }
        Insert: {
          age_text?: never
          brief_id?: string | null
          change_summary?: string | null
          created_at?: string | null
          creative_id?: string | null
          id?: string | null
          is_current?: boolean | null
          is_restored_version?: boolean | null
          nodes_added?: number | null
          nodes_deleted?: number | null
          nodes_modified?: number | null
          parent_version_id?: string | null
          restored_from_version_id?: string | null
          source_action?: string | null
          source_type?:
            | Database["public"]["Enums"]["version_source_type"]
            | null
          user_id?: string | null
          version_name?: string | null
          version_number?: number | null
          version_type?:
            | Database["public"]["Enums"]["creative_version_type"]
            | null
        }
        Update: {
          age_text?: never
          brief_id?: string | null
          change_summary?: string | null
          created_at?: string | null
          creative_id?: string | null
          id?: string | null
          is_current?: boolean | null
          is_restored_version?: boolean | null
          nodes_added?: number | null
          nodes_deleted?: number | null
          nodes_modified?: number | null
          parent_version_id?: string | null
          restored_from_version_id?: string | null
          source_action?: string | null
          source_type?:
            | Database["public"]["Enums"]["version_source_type"]
            | null
          user_id?: string | null
          version_name?: string | null
          version_number?: number | null
          version_type?:
            | Database["public"]["Enums"]["creative_version_type"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "creative_versions_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "content_studio_briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_versions_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "content_studio_creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_versions_parent_version_id_fkey"
            columns: ["parent_version_id"]
            isOneToOne: false
            referencedRelation: "creative_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_versions_parent_version_id_fkey"
            columns: ["parent_version_id"]
            isOneToOne: false
            referencedRelation: "version_history_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_versions_restored_from_version_id_fkey"
            columns: ["restored_from_version_id"]
            isOneToOne: false
            referencedRelation: "creative_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_versions_restored_from_version_id_fkey"
            columns: ["restored_from_version_id"]
            isOneToOne: false
            referencedRelation: "version_history_view"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_balances: {
        Row: {
          available_balance: number | null
          balance: number | null
          id: string | null
          reserved_balance: number | null
          user_id: string | null
        }
        Insert: {
          available_balance?: never
          balance?: number | null
          id?: string | null
          reserved_balance?: number | null
          user_id?: string | null
        }
        Update: {
          available_balance?: never
          balance?: number | null
          id?: string | null
          reserved_balance?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_credits: {
        Args: {
          p_amount: number
          p_description?: string
          p_reference_id?: string
          p_reference_type?: string
          p_type?: string
          p_user_id: string
        }
        Returns: Json
      }
      approve_creator: {
        Args: { admin_notes?: string; application_id: string }
        Returns: undefined
      }
      calculate_version_diff: {
        Args: { p_from_version_id: string; p_to_version_id: string }
        Returns: Json
      }
      capture_reserved_credits: {
        Args: {
          p_ai_model?: string
          p_ai_provider?: string
          p_capture_amount?: number
          p_generation_id: string
        }
        Returns: Json
      }
      expire_stale_reservations: {
        Args: { p_max_age_minutes?: number }
        Returns: number
      }
      finalize_generation_billing:
        | {
            Args: {
              p_ai_metadata?: Json
              p_credits_finalized?: number
              p_generation_id: string
              p_provider_cost_usd?: number
              p_status?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_generation_id: string
              p_metadata?: Json
              p_provider_cost_usd?: number
              p_status?: string
            }
            Returns: Json
          }
      fulfill_credit_purchase: {
        Args: {
          p_credits_amount: number
          p_purchase_id: string
          p_stripe_payment_intent_id?: string
          p_user_id: string
        }
        Returns: Json
      }
      get_current_version: { Args: { p_creative_id: string }; Returns: string }
      get_next_version_number: {
        Args: { p_creative_id: string }
        Returns: number
      }
      get_version_lineage: {
        Args: { p_version_id: string }
        Returns: {
          created_at: string
          depth: number
          version_id: string
          version_name: string
          version_number: number
        }[]
      }
      get_wallet_balance: { Args: { p_user_id: string }; Returns: Json }
      claim_free_trial_credits: { Args: Record<PropertyKey, never>; Returns: Json }
      grant_credits_admin: {
        Args: {
          p_admin_user_id?: string
          p_amount: number
          p_description?: string
          p_idempotency_key?: string
          p_type?: string
          p_user_id: string
        }
        Returns: Json
      }
      increment: { Args: { x: number }; Returns: number }
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
      prune_old_versions: {
        Args: { p_creative_id: string; p_keep_count?: number }
        Returns: number
      }
      reject_creator: {
        Args: { admin_notes?: string; application_id: string }
        Returns: undefined
      }
      release_reserved_credits: {
        Args: {
          p_generation_id: string
          p_reason?: string
          p_release_amount?: number
        }
        Returns: Json
      }
      reserve_generation_credits: {
        Args: {
          p_credits: number
          p_generation_id?: string
          p_metadata?: Json
          p_platform?: string
          p_user_id: string
        }
        Returns: Json
      }
      update_generation_status: {
        Args: { p_generation_id: string; p_new_status: string }
        Returns: Json
      }
    }
    Enums: {
      annotation_type: "note" | "tag" | "bookmark"
      creative_version_type: "manual" | "auto" | "named" | "system" | "restore"
      snapshot_reason_type:
        | "periodic"
        | "pre_mutation"
        | "post_mutation"
        | "user_request"
        | "compression"
        | "restore_point"
      snapshot_storage_type: "full" | "patch" | "reference"
      version_source_type:
        | "initial_generation"
        | "ai_regenerate"
        | "ai_rewrite"
        | "user_edit"
        | "user_mutation"
        | "manual_save"
        | "auto_snapshot"
        | "pre_export"
        | "pre_delete"
        | "restore"
        | "platform_switch"
        | "layout_change"
        | "style_change"
        | "node_add"
        | "node_delete"
        | "node_modify"
        | "copy_edit"
        | "visual_edit"
        | "batch_operation"
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
    Enums: {
      annotation_type: ["note", "tag", "bookmark"],
      creative_version_type: ["manual", "auto", "named", "system", "restore"],
      snapshot_reason_type: [
        "periodic",
        "pre_mutation",
        "post_mutation",
        "user_request",
        "compression",
        "restore_point",
      ],
      snapshot_storage_type: ["full", "patch", "reference"],
      version_source_type: [
        "initial_generation",
        "ai_regenerate",
        "ai_rewrite",
        "user_edit",
        "user_mutation",
        "manual_save",
        "auto_snapshot",
        "pre_export",
        "pre_delete",
        "restore",
        "platform_switch",
        "layout_change",
        "style_change",
        "node_add",
        "node_delete",
        "node_modify",
        "copy_edit",
        "visual_edit",
        "batch_operation",
      ],
    },
  },
} as const
