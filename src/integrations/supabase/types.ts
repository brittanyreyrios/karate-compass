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
    PostgrestVersion: "14.5"
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
          location: string | null
          next_test_date: string | null
          time_end: string | null
          time_start: string | null
          updated_at: string
        }
        Insert: {
          class_name: string
          created_at?: string
          days?: string | null
          id?: string
          location?: string | null
          next_test_date?: string | null
          time_end?: string | null
          time_start?: string | null
          updated_at?: string
        }
        Update: {
          class_name?: string
          created_at?: string
          days?: string | null
          id?: string
          location?: string | null
          next_test_date?: string | null
          time_end?: string | null
          time_start?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      curriculum_items: {
        Row: {
          active: boolean
          belt: string
          category: string | null
          created_at: string
          id: string
          notes: string | null
          sort_order: number
          technique: string
        }
        Insert: {
          active?: boolean
          belt: string
          category?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          sort_order?: number
          technique: string
        }
        Update: {
          active?: boolean
          belt?: string
          category?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          sort_order?: number
          technique?: string
        }
        Relationships: []
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
      pending_student_imports: {
        Row: {
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
        Relationships: []
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
      students: {
        Row: {
          active: boolean
          attendance_count: number
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
            foreignKeyName: "students_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      check_invite_code: { Args: { _code: string }; Returns: boolean }
      get_leaderboard: {
        Args: never
        Returns: {
          class_name: string
          current_belt: string
          first_name: string
          id: string
          last_name: string
          points: number
        }[]
      }
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
