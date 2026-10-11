export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
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
          household_id: string
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
          household_id: string
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
          household_id?: string
          id?: string
          reason?: string
          time?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_transcripts: {
        Row: {
          action_items: Json
          audio_path: string | null
          caregiver_id: string | null
          created_at: string
          date: string
          follow_ups: Json
          household_id: string
          id: string
          recorded_by: string
          summary: string
          title: string | null
          transcript: string
        }
        Insert: {
          action_items?: Json
          audio_path?: string | null
          caregiver_id?: string | null
          created_at?: string
          date: string
          follow_ups?: Json
          household_id: string
          id?: string
          recorded_by?: string
          summary: string
          title?: string | null
          transcript: string
        }
        Update: {
          action_items?: Json
          audio_path?: string | null
          caregiver_id?: string | null
          created_at?: string
          date?: string
          follow_ups?: Json
          household_id?: string
          id?: string
          recorded_by?: string
          summary?: string
          title?: string | null
          transcript?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_transcripts_household_id_caregiver_id_fkey"
            columns: ["household_id", "caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregivers"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "audio_transcripts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          at: string
          household_id: string
          id: number
          new_row: Json | null
          old_row: Json | null
          row_key: string
          table_name: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          at?: string
          household_id: string
          id?: never
          new_row?: Json | null
          old_row?: Json | null
          row_key: string
          table_name: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          at?: string
          household_id?: string
          id?: never
          new_row?: Json | null
          old_row?: Json | null
          row_key?: string
          table_name?: string
        }
        Relationships: []
      }
      bp_readings: {
        Row: {
          caregiver_id: string | null
          created_at: string
          date: string
          diastolic: number
          household_id: string
          id: string
          recorded_by: string
          systolic: number
        }
        Insert: {
          caregiver_id?: string | null
          created_at?: string
          date: string
          diastolic: number
          household_id: string
          id?: string
          recorded_by?: string
          systolic: number
        }
        Update: {
          caregiver_id?: string | null
          created_at?: string
          date?: string
          diastolic?: number
          household_id?: string
          id?: string
          recorded_by?: string
          systolic?: number
        }
        Relationships: [
          {
            foreignKeyName: "bp_readings_household_id_caregiver_id_fkey"
            columns: ["household_id", "caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregivers"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "bp_readings_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      caregivers: {
        Row: {
          created_at: string
          display_name: string
          household_id: string
          id: string
          is_active: boolean
          user_id: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          household_id: string
          id?: string
          is_active?: boolean
          user_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          household_id?: string
          id?: string
          is_active?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "caregivers_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_action_logs: {
        Row: {
          action_id: string
          am_pm: string
          caregiver_id: string | null
          created_at: string
          date: string
          hour: number
          household_id: string
          id: string
          recorded_by: string
          value: number
        }
        Insert: {
          action_id: string
          am_pm?: string
          caregiver_id?: string | null
          created_at?: string
          date: string
          hour?: number
          household_id: string
          id?: string
          recorded_by?: string
          value?: number
        }
        Update: {
          action_id?: string
          am_pm?: string
          caregiver_id?: string | null
          created_at?: string
          date?: string
          hour?: number
          household_id?: string
          id?: string
          recorded_by?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "custom_action_logs_household_id_action_id_fkey"
            columns: ["household_id", "action_id"]
            isOneToOne: false
            referencedRelation: "custom_actions"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "custom_action_logs_household_id_caregiver_id_fkey"
            columns: ["household_id", "caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregivers"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "custom_action_logs_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_actions: {
        Row: {
          color: string
          created_at: string
          default_value: number
          household_id: string
          id: string
          name: string
          show_graph: boolean
          unit: string
        }
        Insert: {
          color?: string
          created_at?: string
          default_value?: number
          household_id: string
          id?: string
          name: string
          show_graph?: boolean
          unit?: string
        }
        Update: {
          color?: string
          created_at?: string
          default_value?: number
          household_id?: string
          id?: string
          name?: string
          show_graph?: boolean
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_actions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      health_records: {
        Row: {
          bile_bags: number
          bp_diastolic: number
          bp_systolic: number
          caregiver_id: string | null
          constipation: boolean
          created_at: string
          date: string
          feed_bags: number
          flush_count: number
          flush_ml: number
          food_description: string | null
          food_taken: boolean
          household_id: string
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
          caregiver_id?: string | null
          constipation?: boolean
          created_at?: string
          date: string
          feed_bags?: number
          flush_count?: number
          flush_ml?: number
          food_description?: string | null
          food_taken?: boolean
          household_id: string
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
          caregiver_id?: string | null
          constipation?: boolean
          created_at?: string
          date?: string
          feed_bags?: number
          flush_count?: number
          flush_ml?: number
          food_description?: string | null
          food_taken?: boolean
          household_id?: string
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
        Relationships: [
          {
            foreignKeyName: "health_records_household_id_caregiver_id_fkey"
            columns: ["household_id", "caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregivers"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "health_records_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_stays: {
        Row: {
          caregiver_id: string | null
          created_at: string
          date: string
          end_hour: number
          household_id: string
          id: string
          is_unavailable: boolean
          person_name: string
          start_hour: number
        }
        Insert: {
          caregiver_id?: string | null
          created_at?: string
          date: string
          end_hour: number
          household_id: string
          id?: string
          is_unavailable?: boolean
          person_name: string
          start_hour: number
        }
        Update: {
          caregiver_id?: string | null
          created_at?: string
          date?: string
          end_hour?: number
          household_id?: string
          id?: string
          is_unavailable?: boolean
          person_name?: string
          start_hour?: number
        }
        Relationships: [
          {
            foreignKeyName: "hospital_stays_household_id_caregiver_id_fkey"
            columns: ["household_id", "caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregivers"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "hospital_stays_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          caregiver_id: string | null
          created_at: string
          email: string
          expires_at: string
          household_id: string
          id: string
          invited_by: string
          revoked_at: string | null
          role: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          caregiver_id?: string | null
          created_at?: string
          email: string
          expires_at?: string
          household_id: string
          id?: string
          invited_by: string
          revoked_at?: string | null
          role?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          caregiver_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          household_id?: string
          id?: string
          invited_by?: string
          revoked_at?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_invites_household_id_caregiver_id_fkey"
            columns: ["household_id", "caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregivers"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "household_invites_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          created_at: string
          household_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          household_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          household_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_sync: {
        Row: {
          at: string
          household_id: string
          seq: number
          table_name: string
        }
        Insert: {
          at?: string
          household_id: string
          seq?: number
          table_name: string
        }
        Update: {
          at?: string
          household_id?: string
          seq?: number
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_sync_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: true
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          care_recipient_name: string
          created_at: string
          created_by: string
          id: string
          timezone: string
        }
        Insert: {
          care_recipient_name: string
          created_at?: string
          created_by: string
          id?: string
          timezone?: string
        }
        Update: {
          care_recipient_name?: string
          created_at?: string
          created_by?: string
          id?: string
          timezone?: string
        }
        Relationships: []
      }
      medicine_logs: {
        Row: {
          am_pm: string
          caregiver_id: string | null
          created_at: string
          date: string
          hour: number
          household_id: string
          id: string
          medicine_id: string
          recorded_by: string
        }
        Insert: {
          am_pm?: string
          caregiver_id?: string | null
          created_at?: string
          date: string
          hour?: number
          household_id: string
          id?: string
          medicine_id: string
          recorded_by?: string
        }
        Update: {
          am_pm?: string
          caregiver_id?: string | null
          created_at?: string
          date?: string
          hour?: number
          household_id?: string
          id?: string
          medicine_id?: string
          recorded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "medicine_logs_household_id_caregiver_id_fkey"
            columns: ["household_id", "caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregivers"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "medicine_logs_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicine_logs_household_id_medicine_id_fkey"
            columns: ["household_id", "medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["household_id", "id"]
          },
        ]
      }
      medicines: {
        Row: {
          amount: string
          category: string
          created_at: string
          frequency: string
          household_id: string
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
          household_id: string
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
          household_id?: string
          id?: string
          med_type?: string
          name?: string
          potency?: string
          schedule_note?: string
          schedule_time?: string
          show_in_quick_log?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "medicines_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      transcription_usage: {
        Row: {
          at: string
          household_id: string
          id: number
          user_id: string
        }
        Insert: {
          at?: string
          household_id: string
          id?: never
          user_id: string
        }
        Update: {
          at?: string
          household_id?: string
          id?: never
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcription_usage_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      written_notes: {
        Row: {
          caregiver_id: string | null
          content: string
          created_at: string
          date: string
          household_id: string
          id: string
          recorded_by: string
          title: string | null
        }
        Insert: {
          caregiver_id?: string | null
          content: string
          created_at?: string
          date?: string
          household_id: string
          id?: string
          recorded_by?: string
          title?: string | null
        }
        Update: {
          caregiver_id?: string | null
          content?: string
          created_at?: string
          date?: string
          household_id?: string
          id?: string
          recorded_by?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "written_notes_household_id_caregiver_id_fkey"
            columns: ["household_id", "caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregivers"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "written_notes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: {
        Args: { p_display_name: string; p_invite_id: string }
        Returns: string
      }
      claim_transcription: {
        Args: { p_household_id: string }
        Returns: undefined
      }
      create_household: {
        Args: {
          p_care_recipient_name: string
          p_display_name: string
          p_timezone?: string
        }
        Returns: string
      }
      household_people: {
        Args: never
        Returns: {
          caregiver_id: string
          display_name: string
          email: string
          is_active: boolean
          role: string
          user_id: string
        }[]
      }
      invite_member: {
        Args: { p_caregiver_id?: string; p_email: string }
        Returns: string
      }
      log_bp_reading: {
        Args: {
          p_caregiver_id: string
          p_date: string
          p_diastolic: number
          p_household_id: string
          p_recorded_by: string
          p_systolic: number
        }
        Returns: {
          caregiver_id: string | null
          created_at: string
          date: string
          diastolic: number
          household_id: string
          id: string
          recorded_by: string
          systolic: number
        }
        SetofOptions: {
          from: "*"
          to: "bp_readings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      log_reading: {
        Args: {
          p_bile_bags?: number
          p_caregiver_id?: string
          p_date: string
          p_feed_bags?: number
          p_flush_count?: number
          p_flush_ml?: number
          p_household_id: string
          p_recorded_by?: string
          p_stool_count?: number
          p_urine_count?: number
          p_vomit_count?: number
          p_weight?: number
        }
        Returns: {
          bile_bags: number
          bp_diastolic: number
          bp_systolic: number
          caregiver_id: string | null
          constipation: boolean
          created_at: string
          date: string
          feed_bags: number
          flush_count: number
          flush_ml: number
          food_description: string | null
          food_taken: boolean
          household_id: string
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
        SetofOptions: {
          from: "*"
          to: "health_records"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pending_invite: {
        Args: never
        Returns: {
          care_recipient_name: string
          invite_id: string
          inviter_display_name: string
        }[]
      }
      remove_member: { Args: { p_user_id: string }; Returns: undefined }
      revoke_invite: { Args: { p_invite_id: string }; Returns: undefined }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
}
