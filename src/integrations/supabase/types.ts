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
      establishment_settings: {
        Row: {
          id: string
          logo_url: string | null
          name: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          logo_url?: string | null
          name?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          logo_url?: string | null
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      material_reservations: {
        Row: {
          admin_notes: string | null
          block_end: number
          block_start: number
          course_name: string
          created_at: string
          id: string
          material_id: string
          observation: string | null
          quantity: number
          reservation_date: string
          status: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          block_end: number
          block_start: number
          course_name: string
          created_at?: string
          id?: string
          material_id: string
          observation?: string | null
          quantity?: number
          reservation_date: string
          status?: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          block_end?: number
          block_start?: number
          course_name?: string
          created_at?: string
          id?: string
          material_id?: string
          observation?: string | null
          quantity?: number
          reservation_date?: string
          status?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_reservations_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          quantity_available: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          quantity_available?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          quantity_available?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reservation_notes: {
        Row: {
          admin_notes: string | null
          created_at: string
          observation: string | null
          reservation_id: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          observation?: string | null
          reservation_id: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          observation?: string | null
          reservation_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_notes_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: true
            referencedRelation: "public_reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_notes_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: true
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          block_end: number
          block_start: number
          cancellation_reason: string | null
          class_objective: string
          course_name: string
          created_at: string
          id: string
          recurrence_group_id: string | null
          reservation_date: string
          status: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          block_end: number
          block_start: number
          cancellation_reason?: string | null
          class_objective: string
          course_name: string
          created_at?: string
          id?: string
          recurrence_group_id?: string | null
          reservation_date: string
          status?: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          block_end?: number
          block_start?: number
          cancellation_reason?: string | null
          class_objective?: string
          course_name?: string
          created_at?: string
          id?: string
          recurrence_group_id?: string | null
          reservation_date?: string
          status?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      schedule_blocks: {
        Row: {
          available_days: number[]
          block_number: number
          created_at: string
          end_time: string
          id: string
          start_time: string
        }
        Insert: {
          available_days?: number[]
          block_number: number
          created_at?: string
          end_time: string
          id?: string
          start_time: string
        }
        Update: {
          available_days?: number[]
          block_number?: number
          created_at?: string
          end_time?: string
          id?: string
          start_time?: string
        }
        Relationships: []
      }
      schedule_settings: {
        Row: {
          allow_double_blocks: boolean
          block_duration_minutes: number
          end_time: string
          id: string
          start_time: string
          updated_at: string
        }
        Insert: {
          allow_double_blocks?: boolean
          block_duration_minutes?: number
          end_time?: string
          id?: string
          start_time?: string
          updated_at?: string
        }
        Update: {
          allow_double_blocks?: boolean
          block_duration_minutes?: number
          end_time?: string
          id?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_reservations: {
        Row: {
          block_end: number | null
          block_start: number | null
          cancellation_reason: string | null
          class_objective: string | null
          course_name: string | null
          id: string | null
          reservation_date: string | null
          status: string | null
          teacher_name: string | null
        }
        Relationships: []
      }
      public_teachers: {
        Row: {
          full_name: string | null
          user_id: string | null
        }
        Insert: {
          full_name?: string | null
          user_id?: string | null
        }
        Update: {
          full_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "teacher"
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
      app_role: ["admin", "teacher"],
    },
  },
} as const
