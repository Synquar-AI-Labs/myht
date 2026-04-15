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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          address: string | null
          created_at: string
          date: string
          description: string | null
          doctor_name: string
          id: string
          reason: string
          time: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          date: string
          description?: string | null
          doctor_name: string
          id?: string
          reason: string
          time?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          date?: string
          description?: string | null
          doctor_name?: string
          id?: string
          reason?: string
          time?: string
        }
        Relationships: []
      }
      audio_transcripts: {
        Row: {
          action_items: Json
          audio_url: string | null
          created_at: string
          date: string
          follow_ups: Json
          id: string
          recorded_by: string
          summary: string
          title: string | null
          transcript: string
        }
        Insert: {
          action_items?: Json
          audio_url?: string | null
          created_at?: string
          date: string
          follow_ups?: Json
          id?: string
          recorded_by?: string
          summary: string
          title?: string | null
          transcript: string
        }
        Update: {
          action_items?: Json
          audio_url?: string | null
          created_at?: string
          date?: string
          follow_ups?: Json
          id?: string
          recorded_by?: string
          summary?: string
          title?: string | null
          transcript?: string
        }
        Relationships: []
      }
      bp_readings: {
        Row: {
          created_at: string
          date: string
          diastolic: number
          id: string
          recorded_by: string
          systolic: number
        }
        Insert: {
          created_at?: string
          date: string
          diastolic: number
          id?: string
          recorded_by?: string
          systolic: number
        }
        Update: {
          created_at?: string
          date?: string
          diastolic?: number
          id?: string
          recorded_by?: string
          systolic?: number
        }
        Relationships: []
      }
      custom_action_logs: {
        Row: {
          action_id: string
          am_pm: string
          created_at: string
          date: string
          hour: number
          id: string
          recorded_by: string
          value: number
        }
        Insert: {
          action_id: string
          am_pm?: string
          created_at?: string
          date: string
          hour?: number
          id?: string
          recorded_by?: string
          value?: number
        }
        Update: {
          action_id?: string
          am_pm?: string
          created_at?: string
          date?: string
          hour?: number
          id?: string
          recorded_by?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "custom_action_logs_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "custom_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_actions: {
        Row: {
          color: string
          created_at: string
          default_value: number
          id: string
          name: string
          show_graph: boolean
          unit: string
        }
        Insert: {
          color?: string
          created_at?: string
          default_value?: number
          id?: string
          name: string
          show_graph?: boolean
          unit?: string
        }
        Update: {
          color?: string
          created_at?: string
          default_value?: number
          id?: string
          name?: string
          show_graph?: boolean
          unit?: string
        }
        Relationships: []
      }
      health_records: {
        Row: {
          bile_bags: number
          bp_diastolic: number
          bp_systolic: number
          constipation: boolean
          created_at: string
          date: string
          feed_bags: number
          flush_count: number
          flush_ml: number
          food_description: string | null
          food_taken: boolean
          id: string
          misc_notes: string
          recorded_by: string
          stool_count: number
          stool_passed: boolean
          updated_at: string
          urine_count: number
          vomit_count: number
          vomiting: boolean
          weight: number
        }
        Insert: {
          bile_bags?: number
          bp_diastolic?: number
          bp_systolic?: number
          constipation?: boolean
          created_at?: string
          date: string
          feed_bags?: number
          flush_count?: number
          flush_ml?: number
          food_description?: string | null
          food_taken?: boolean
          id?: string
          misc_notes?: string
          recorded_by?: string
          stool_count?: number
          stool_passed?: boolean
          updated_at?: string
          urine_count?: number
          vomit_count?: number
          vomiting?: boolean
          weight?: number
        }
        Update: {
          bile_bags?: number
          bp_diastolic?: number
          bp_systolic?: number
          constipation?: boolean
          created_at?: string
          date?: string
          feed_bags?: number
          flush_count?: number
          flush_ml?: number
          food_description?: string | null
          food_taken?: boolean
          id?: string
          misc_notes?: string
          recorded_by?: string
          stool_count?: number
          stool_passed?: boolean
          updated_at?: string
          urine_count?: number
          vomit_count?: number
          vomiting?: boolean
          weight?: number
        }
        Relationships: []
      }
      hospital_stays: {
        Row: {
          created_at: string
          date: string
          end_hour: number
          id: string
          is_unavailable: boolean
          person_name: string
          start_hour: number
        }
        Insert: {
          created_at?: string
          date: string
          end_hour: number
          id?: string
          is_unavailable?: boolean
          person_name: string
          start_hour: number
        }
        Update: {
          created_at?: string
          date?: string
          end_hour?: number
          id?: string
          is_unavailable?: boolean
          person_name?: string
          start_hour?: number
        }
        Relationships: []
      }
      medicine_logs: {
        Row: {
          am_pm: string
          created_at: string
          date: string
          hour: number
          id: string
          medicine_id: string
          recorded_by: string
        }
        Insert: {
          am_pm?: string
          created_at?: string
          date: string
          hour?: number
          id?: string
          medicine_id: string
          recorded_by?: string
        }
        Update: {
          am_pm?: string
          created_at?: string
          date?: string
          hour?: number
          id?: string
          medicine_id?: string
          recorded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "medicine_logs_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
        ]
      }
      medicines: {
        Row: {
          amount: string
          category: string
          created_at: string
          frequency: string
          id: string
          med_type: string
          name: string
          potency: string
          schedule_note: string
          schedule_time: string
          show_in_quick_log: boolean
        }
        Insert: {
          amount?: string
          category?: string
          created_at?: string
          frequency?: string
          id?: string
          med_type?: string
          name: string
          potency?: string
          schedule_note?: string
          schedule_time?: string
          show_in_quick_log?: boolean
        }
        Update: {
          amount?: string
          category?: string
          created_at?: string
          frequency?: string
          id?: string
          med_type?: string
          name?: string
          potency?: string
          schedule_note?: string
          schedule_time?: string
          show_in_quick_log?: boolean
        }
        Relationships: []
      }
      reminder_settings: {
        Row: {
          appointment_reminder_days: number
          created_at: string
          daily_reminder_time: string
          emails: string[]
          id: string
          updated_at: string
        }
        Insert: {
          appointment_reminder_days?: number
          created_at?: string
          daily_reminder_time?: string
          emails?: string[]
          id?: string
          updated_at?: string
        }
        Update: {
          appointment_reminder_days?: number
          created_at?: string
          daily_reminder_time?: string
          emails?: string[]
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      written_notes: {
        Row: {
          content: string
          created_at: string
          date: string
          id: string
          recorded_by: string
          title: string | null
        }
        Insert: {
          content: string
          created_at?: string
          date?: string
          id?: string
          recorded_by?: string
          title?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          date?: string
          id?: string
          recorded_by?: string
          title?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
