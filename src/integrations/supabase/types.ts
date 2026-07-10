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
          body: string
          category: string
          created_at: string
          created_by: string | null
          discipline: string | null
          event_date: string | null
          id: string
          location: string | null
          tag: string | null
          title: string
        }
        Insert: {
          body: string
          category: string
          created_at?: string
          created_by?: string | null
          discipline?: string | null
          event_date?: string | null
          id?: string
          location?: string | null
          tag?: string | null
          title: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          created_by?: string | null
          discipline?: string | null
          event_date?: string | null
          id?: string
          location?: string | null
          tag?: string | null
          title?: string
        }
        Relationships: []
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
      profiles: {
        Row: {
          created_at: string
          email: string
          family_name: string
          id: string
          subscription_status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          family_name?: string
          id: string
          subscription_status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          family_name?: string
          id?: string
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
