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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          address: string | null
          body: string
          category: string
          created_at: string
          created_by: string | null
          discipline: string | null
          disciplines: string[] | null
          divisions: string | null
          event_date: string | null
          event_end_date: string | null
          event_url: string | null
          id: string
          location: string | null
          registration_deadline: string | null
          spectator_info: string | null
          tag: string | null
          title: string
          venue: string | null
        }
        Insert: {
          address?: string | null
          body: string
          category: string
          created_at?: string
          created_by?: string | null
          discipline?: string | null
          disciplines?: string[] | null
          divisions?: string | null
          event_date?: string | null
          event_end_date?: string | null
          event_url?: string | null
          id?: string
          location?: string | null
          registration_deadline?: string | null
          spectator_info?: string | null
          tag?: string | null
          title: string
          venue?: string | null
        }
        Update: {
          address?: string | null
          body?: string
          category?: string
          created_at?: string
          created_by?: string | null
          discipline?: string | null
          disciplines?: string[] | null
          divisions?: string | null
          event_date?: string | null
          event_end_date?: string | null
          event_url?: string | null
          id?: string
          location?: string | null
          registration_deadline?: string | null
          spectator_info?: string | null
          tag?: string | null
          title?: string
          venue?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      attendance_events: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          occurred_on: string
          student_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          occurred_on?: string
          student_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          occurred_on?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      belt_ranks: {
        Row: {
          active: boolean
          color_accent: string | null
          color_primary: string
          created_at: string
          curriculum_tier: string
          id: string
          name: string
          pattern: string
          short_name: string | null
          sort_order: number
          system_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          color_accent?: string | null
          color_primary: string
          created_at?: string
          curriculum_tier?: string
          id?: string
          name: string
          pattern?: string
          short_name?: string | null
          sort_order?: number
          system_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          color_accent?: string | null
          color_primary?: string
          created_at?: string
          curriculum_tier?: string
          id?: string
          name?: string
          pattern?: string
          short_name?: string | null
          sort_order?: number
          system_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "belt_ranks_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "belt_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      belt_systems: {
        Row: {
          age_guidance: string | null
          created_at: string
          id: string
          name: string
          program_id: string | null
          slug: string
          sort_order: number
          updated_at: string
          uses_belts: boolean
        }
        Insert: {
          age_guidance?: string | null
          created_at?: string
          id?: string
          name: string
          program_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
          uses_belts?: boolean
        }
        Update: {
          age_guidance?: string | null
          created_at?: string
          id?: string
          name?: string
          program_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
          uses_belts?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "belt_systems_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      class_holidays: {
        Row: {
          class_name: string
          created_at: string
          created_by: string | null
          holiday_date: string
          id: string
          note: string | null
        }
        Insert: {
          class_name: string
          created_at?: string
          created_by?: string | null
          holiday_date: string
          id?: string
          note?: string | null
        }
        Update: {
          class_name?: string
          created_at?: string
          created_by?: string | null
          holiday_date?: string
          id?: string
          note?: string | null
        }
        Relationships: []
      }
      class_schedules: {
        Row: {
          class_name: string
          created_at: string
          days: string | null
          id: string
          is_teen_adult: boolean
          location: string | null
          next_test_date: string | null
          program_id: string | null
          test_announcement_id: string | null
          time_end: string | null
          time_start: string | null
          updated_at: string
        }
        Insert: {
          class_name: string
          created_at?: string
          days?: string | null
          id?: string
          is_teen_adult?: boolean
          location?: string | null
          next_test_date?: string | null
          program_id?: string | null
          test_announcement_id?: string | null
          time_end?: string | null
          time_start?: string | null
          updated_at?: string
        }
        Update: {
          class_name?: string
          created_at?: string
          days?: string | null
          id?: string
          is_teen_adult?: boolean
          location?: string | null
          next_test_date?: string | null
          program_id?: string | null
          test_announcement_id?: string | null
          time_end?: string | null
          time_start?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_schedules_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedules_test_announcement_id_fkey"
            columns: ["test_announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_items: {
        Row: {
          active: boolean
          belt: string | null
          belt_rank_id: string | null
          category: string | null
          created_at: string
          curriculum_tier: string | null
          id: string
          notes: string | null
          program_id: string | null
          sort_order: number
          technique: string
          video_orientation: string | null
          video_seconds: number | null
          video_title: string | null
          video_youtube_id: string | null
        }
        Insert: {
          active?: boolean
          belt?: string | null
          belt_rank_id?: string | null
          category?: string | null
          created_at?: string
          curriculum_tier?: string | null
          id?: string
          notes?: string | null
          program_id?: string | null
          sort_order?: number
          technique: string
          video_orientation?: string | null
          video_seconds?: number | null
          video_title?: string | null
          video_youtube_id?: string | null
        }
        Update: {
          active?: boolean
          belt?: string | null
          belt_rank_id?: string | null
          category?: string | null
          created_at?: string
          curriculum_tier?: string | null
          id?: string
          notes?: string | null
          program_id?: string | null
          sort_order?: number
          technique?: string
          video_orientation?: string | null
          video_seconds?: number | null
          video_title?: string | null
          video_youtube_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_items_belt_rank_id_fkey"
            columns: ["belt_rank_id"]
            isOneToOne: false
            referencedRelation: "belt_ranks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_items_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      dojo_point_guidelines: {
        Row: {
          created_at: string
          id: string
          rule_text: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          rule_text: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          rule_text?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          all_day: boolean
          announcement_id: string | null
          audience_label: string | null
          created_at: string
          created_by: string | null
          description: string | null
          disciplines: string[] | null
          ends_at: string | null
          event_type: string
          id: string
          location: string | null
          published: boolean
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          announcement_id?: string | null
          audience_label?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          disciplines?: string[] | null
          ends_at?: string | null
          event_type?: string
          id?: string
          location?: string | null
          published?: boolean
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          announcement_id?: string | null
          audience_label?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          disciplines?: string[] | null
          ends_at?: string | null
          event_type?: string
          id?: string
          location?: string | null
          published?: boolean
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_albums: {
        Row: {
          active: boolean
          cover_image_url: string | null
          created_at: string
          description: string | null
          event_date: string | null
          external_url: string
          id: string
          sort_order: number
          title: string
        }
        Insert: {
          active?: boolean
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          event_date?: string | null
          external_url: string
          id?: string
          sort_order?: number
          title: string
        }
        Update: {
          active?: boolean
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          event_date?: string | null
          external_url?: string
          id?: string
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      invite_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          label: string | null
          max_uses: number
          used_count: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          label?: string | null
          max_uses?: number
          used_count?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          label?: string | null
          max_uses?: number
          used_count?: number
        }
        Relationships: []
      }
      leaderboard_divisions: {
        Row: {
          created_at: string
          key: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          key: string
          name: string
          sort_order: number
        }
        Update: {
          created_at?: string
          key?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      pending_student_imports: {
        Row: {
          belt_rank_id: string | null
          class_id: string | null
          class_name: string
          created_at: string
          current_belt: string
          first_name: string
          id: string
          last_name: string
          parent_email: string
          reason: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          belt_rank_id?: string | null
          class_id?: string | null
          class_name: string
          created_at?: string
          current_belt?: string
          first_name: string
          id?: string
          last_name: string
          parent_email: string
          reason?: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          belt_rank_id?: string | null
          class_id?: string | null
          class_name?: string
          created_at?: string
          current_belt?: string
          first_name?: string
          id?: string
          last_name?: string
          parent_email?: string
          reason?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_student_imports_belt_rank_id_fkey"
            columns: ["belt_rank_id"]
            isOneToOne: false
            referencedRelation: "belt_ranks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_student_imports_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "class_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_consent_events: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          changed_at: string
          id: string
          new_value: boolean
          profile_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          changed_at?: string
          id?: string
          new_value: boolean
          profile_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          changed_at?: string
          id?: string
          new_value?: boolean
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_consent_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      point_events: {
        Row: {
          awarded_by: string | null
          created_at: string
          delta: number
          id: string
          occurred_on: string
          reason: string | null
          student_id: string
        }
        Insert: {
          awarded_by?: string | null
          created_at?: string
          delta: number
          id?: string
          occurred_on?: string
          reason?: string | null
          student_id: string
        }
        Update: {
          awarded_by?: string | null
          created_at?: string
          delta?: number
          id?: string
          occurred_on?: string
          reason?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_options: {
        Row: {
          created_at: string
          id: string
          label: string
          poll_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          poll_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          poll_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string
          id: string
          option_id: string
          poll_id: string
          profile_id: string
          student_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          option_id: string
          poll_id: string
          profile_id: string
          student_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          option_id?: string
          poll_id?: string
          profile_id?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          anonymous: boolean
          closes_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          multi_select: boolean
          published: boolean
          question: string
          respond_per: string
          results_visible: string
          updated_at: string
        }
        Insert: {
          anonymous?: boolean
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          multi_select?: boolean
          published?: boolean
          question: string
          respond_per?: string
          results_visible?: string
          updated_at?: string
        }
        Update: {
          anonymous?: boolean
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          multi_select?: boolean
          published?: boolean
          question?: string
          respond_per?: string
          results_visible?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          family_name: string
          id: string
          media_release_accepted_at: string | null
          media_release_version: string | null
          photo_consent: boolean
          photo_consent_updated_at: string | null
          subscription_status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          family_name?: string
          id: string
          media_release_accepted_at?: string | null
          media_release_version?: string | null
          photo_consent?: boolean
          photo_consent_updated_at?: string | null
          subscription_status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          family_name?: string
          id?: string
          media_release_accepted_at?: string | null
          media_release_version?: string | null
          photo_consent?: boolean
          photo_consent_updated_at?: string | null
          subscription_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      programs: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      review_prompt_dismissals: {
        Row: {
          dismissed_at: string
          profile_id: string
        }
        Insert: {
          dismissed_at?: string
          profile_id: string
        }
        Update: {
          dismissed_at?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_prompt_dismissals_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_change_events: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          target_user_id?: string
        }
        Relationships: []
      }
      student_classes: {
        Row: {
          class_id: string
          created_at: string
          id: string
          is_primary: boolean
          student_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          student_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_classes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "class_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_classes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          active: boolean
          attendance_count: number
          belt_rank_id: string | null
          class_name: string
          consecutive_absences: number
          created_at: string
          current_belt: string
          first_name: string
          id: string
          last_name: string
          next_test_date: string | null
          parent_id: string
          points: number
          start_date: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          attendance_count?: number
          belt_rank_id?: string | null
          class_name?: string
          consecutive_absences?: number
          created_at?: string
          current_belt?: string
          first_name: string
          id?: string
          last_name: string
          next_test_date?: string | null
          parent_id: string
          points?: number
          start_date?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          attendance_count?: number
          belt_rank_id?: string | null
          class_name?: string
          consecutive_absences?: number
          created_at?: string
          current_belt?: string
          first_name?: string
          id?: string
          last_name?: string
          next_test_date?: string | null
          parent_id?: string
          points?: number
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_belt_rank_id_fkey"
            columns: ["belt_rank_id"]
            isOneToOne: false
            referencedRelation: "belt_ranks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      technique_library: {
        Row: {
          belt_rank_id: string | null
          category: string
          created_at: string
          created_by: string | null
          difficulty: string | null
          id: string
          label: string
          notes: string | null
          program_id: string
          published: boolean
          sort_order: number
          title: string
          updated_at: string
          video_orientation: string | null
          video_seconds: number | null
          video_title: string | null
          video_youtube_id: string | null
        }
        Insert: {
          belt_rank_id?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          difficulty?: string | null
          id?: string
          label: string
          notes?: string | null
          program_id: string
          published?: boolean
          sort_order?: number
          title: string
          updated_at?: string
          video_orientation?: string | null
          video_seconds?: number | null
          video_title?: string | null
          video_youtube_id?: string | null
        }
        Update: {
          belt_rank_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          difficulty?: string | null
          id?: string
          label?: string
          notes?: string | null
          program_id?: string
          published?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
          video_orientation?: string | null
          video_seconds?: number | null
          video_title?: string | null
          video_youtube_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technique_library_belt_rank_id_fkey"
            columns: ["belt_rank_id"]
            isOneToOne: false
            referencedRelation: "belt_ranks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technique_library_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_reassign_student: {
        Args: { _new_parent_email: string; _student_id: string }
        Returns: Json
      }
      assign_jiu_jitsu_levels: { Args: never; Returns: Json }
      check_invite_code: { Args: { _code: string }; Returns: boolean }
      class_student_counts: {
        Args: never
        Returns: {
          class_name: string
          student_count: number
        }[]
      }
      division_of: { Args: { _student_id: string }; Returns: string }
      divisions_of: { Args: { _student_id: string }; Returns: string[] }
      get_curriculum_for_all_children: {
        Args: never
        Returns: {
          belt_rank_id: string
          belt_rank_id_student: string
          category: string
          curriculum_tier: string
          first_name: string
          group_label: string
          id: string
          is_current: boolean
          notes: string
          rank_name: string
          sort_order: number
          student_created_at: string
          student_id: string
          technique: string
          video_orientation: string
          video_seconds: number
          video_title: string
          video_youtube_id: string
        }[]
      }
      get_curriculum_for_student: {
        Args: { _student_id: string }
        Returns: {
          belt_rank_id: string
          category: string
          curriculum_tier: string
          group_label: string
          id: string
          is_current: boolean
          notes: string
          rank_name: string
          sort_order: number
          technique: string
          video_orientation: string
          video_seconds: number
          video_title: string
          video_youtube_id: string
        }[]
      }
      get_leaderboard: {
        Args: { _division: string; _period?: string }
        Returns: {
          class_name: string
          color_accent: string
          color_primary: string
          first_name: string
          id: string
          last_initial: string
          pattern: string
          period_points: number
          rank_name: string
          rank_short_name: string
          uses_belts: boolean
        }[]
      }
      get_my_division: { Args: never; Returns: string }
      get_poll_breakdown: {
        Args: { _poll_id: string }
        Returns: {
          email: string
          family_name: string
          option_label: string
          student_name: string
          voted_at: string
        }[]
      }
      get_poll_results: {
        Args: { _poll_id: string }
        Returns: {
          label: string
          option_id: string
          vote_count: number
        }[]
      }
      get_technique_library: {
        Args: never
        Returns: {
          category: string
          difficulty: string
          id: string
          label: string
          notes: string
          program_id: string
          program_name: string
          published: boolean
          sort_order: number
          title: string
          video_orientation: string
          video_seconds: number
          video_title: string
          video_youtube_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      next_curriculum_sort_order: {
        Args: { _belt_rank_id: string; _curriculum_tier: string }
        Returns: number
      }
      resolve_belt_rank_id: { Args: { _belt: string }; Returns: string }
      set_class_test_date: {
        Args: {
          _date: string
          _post_announcement: boolean
          _schedule_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "parent"
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
      app_role: ["admin", "parent"],
    },
  },
} as const
