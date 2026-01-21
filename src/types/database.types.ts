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
      ateliers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          plan: string
          settings: Json | null
          siret: string | null
          storage_quota_gb: number
          storage_used_gb: number
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          plan?: string
          settings?: Json | null
          siret?: string | null
          storage_quota_gb?: number
          storage_used_gb?: number
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          plan?: string
          settings?: Json | null
          siret?: string | null
          storage_quota_gb?: number
          storage_used_gb?: number
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          atelier_id: string
          created_at: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          atelier_id: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          atelier_id?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          atelier_id: string
          created_at: string
          email: string
          facture_trigger: 'pret' | 'livre'
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          siret: string | null
          tags: string[] | null
          type: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          atelier_id: string
          created_at?: string
          email: string
          facture_trigger?: 'pret' | 'livre'
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          siret?: string | null
          tags?: string[] | null
          type?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          atelier_id?: string
          created_at?: string
          email?: string
          facture_trigger?: 'pret' | 'livre'
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          siret?: string | null
          tags?: string[] | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
        ]
      }
      devis: {
        Row: {
          atelier_id: string
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          items: Json
          numero: string
          pdf_url: string | null
          signature_data: Json | null
          signed_at: string | null
          signed_by: string | null
          signed_ip: string | null
          status: string
          template_id: string | null
          total_ht: number
          total_ttc: number
          tva_rate: number
          updated_at: string
        }
        Insert: {
          atelier_id: string
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          items?: Json
          numero: string
          pdf_url?: string | null
          signature_data?: Json | null
          signed_at?: string | null
          signed_by?: string | null
          signed_ip?: string | null
          status?: string
          template_id?: string | null
          total_ht: number
          total_ttc: number
          tva_rate?: number
          updated_at?: string
        }
        Update: {
          atelier_id?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          items?: Json
          numero?: string
          pdf_url?: string | null
          signature_data?: Json | null
          signed_at?: string | null
          signed_by?: string | null
          signed_ip?: string | null
          status?: string
          template_id?: string | null
          total_ht?: number
          total_ttc?: number
          tva_rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devis_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devis_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devis_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      factures: {
        Row: {
          atelier_id: string
          client_id: string
          created_at: string
          created_by: string | null
          fec_exported: boolean | null
          fec_exported_at: string | null
          id: string
          numero: string
          paid_at: string | null
          payment_method: string | null
          payment_ref: string | null
          pdf_url: string | null
          projet_id: string | null
          status: string
          total_ht: number
          total_ttc: number
          tva_rate: number
          type: string
          updated_at: string
        }
        Insert: {
          atelier_id: string
          client_id: string
          created_at?: string
          created_by?: string | null
          fec_exported?: boolean | null
          fec_exported_at?: string | null
          id?: string
          numero: string
          paid_at?: string | null
          payment_method?: string | null
          payment_ref?: string | null
          pdf_url?: string | null
          projet_id?: string | null
          status?: string
          total_ht: number
          total_ttc: number
          tva_rate?: number
          type: string
          updated_at?: string
        }
        Update: {
          atelier_id?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          fec_exported?: boolean | null
          fec_exported_at?: string | null
          id?: string
          numero?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_ref?: string | null
          pdf_url?: string | null
          projet_id?: string | null
          status?: string
          total_ht?: number
          total_ttc?: number
          tva_rate?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "factures_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "projets"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          atelier_id: string
          created_at: string
          created_by: string | null
          id: string
          metadata: Json | null
          projet_id: string
          size_bytes: number
          step_index: number | null
          storage_path: string
          type: string
          url: string
        }
        Insert: {
          atelier_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json | null
          projet_id: string
          size_bytes: number
          step_index?: number | null
          storage_path: string
          type: string
          url: string
        }
        Update: {
          atelier_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json | null
          projet_id?: string
          size_bytes?: number
          step_index?: number | null
          storage_path?: string
          type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "projets"
            referencedColumns: ["id"]
          },
        ]
      }
      poudres: {
        Row: {
          atelier_id: string
          consommation_m2: number | null
          created_at: string
          densite: number | null
          duree_cuisson: number | null
          epaisseur_conseillee: number | null
          finition: string
          id: string
          marque: string
          prix_kg: number | null
          ral: string | null
          reference: string
          rendement_m2_kg: number | null
          source: string | null
          temp_cuisson: number | null
          type: string
          updated_at: string
        }
        Insert: {
          atelier_id: string
          consommation_m2?: number | null
          created_at?: string
          densite?: number | null
          duree_cuisson?: number | null
          epaisseur_conseillee?: number | null
          finition: string
          id?: string
          marque: string
          prix_kg?: number | null
          ral?: string | null
          reference: string
          rendement_m2_kg?: number | null
          source?: string | null
          temp_cuisson?: number | null
          type: string
          updated_at?: string
        }
        Update: {
          atelier_id?: string
          consommation_m2?: number | null
          created_at?: string
          densite?: number | null
          duree_cuisson?: number | null
          epaisseur_conseillee?: number | null
          finition?: string
          id?: string
          marque?: string
          prix_kg?: number | null
          ral?: string | null
          reference?: string
          rendement_m2_kg?: number | null
          source?: string | null
          temp_cuisson?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "poudres_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
        ]
      }
      projets: {
        Row: {
          atelier_id: string
          client_id: string
          couches: number
          created_at: string
          created_by: string | null
          current_step: number | null
          date_depot: string | null
          date_livre: string | null
          date_promise: string | null
          devis_id: string | null
          duree_cuisson: number | null
          id: string
          name: string
          numero: string
          photos_count: number | null
          photos_size_mb: number | null
          pieces: Json | null
          poudre_id: string | null
          status: string
          temp_cuisson: number | null
          updated_at: string
          workflow_config: Json | null
        }
        Insert: {
          atelier_id: string
          client_id: string
          couches?: number
          created_at?: string
          created_by?: string | null
          current_step?: number | null
          date_depot?: string | null
          date_livre?: string | null
          date_promise?: string | null
          devis_id?: string | null
          duree_cuisson?: number | null
          id?: string
          name: string
          numero: string
          photos_count?: number | null
          photos_size_mb?: number | null
          pieces?: Json | null
          poudre_id?: string | null
          status?: string
          temp_cuisson?: number | null
          updated_at?: string
          workflow_config?: Json | null
        }
        Update: {
          atelier_id?: string
          client_id?: string
          couches?: number
          created_at?: string
          created_by?: string | null
          current_step?: number | null
          date_depot?: string | null
          date_livre?: string | null
          date_promise?: string | null
          devis_id?: string | null
          duree_cuisson?: number | null
          id?: string
          name?: string
          numero?: string
          photos_count?: number | null
          photos_size_mb?: number | null
          pieces?: Json | null
          poudre_id?: string | null
          status?: string
          temp_cuisson?: number | null
          updated_at?: string
          workflow_config?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "projets_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projets_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projets_poudre_id_fkey"
            columns: ["poudre_id"]
            isOneToOne: false
            referencedRelation: "poudres"
            referencedColumns: ["id"]
          },
        ]
      }
      series: {
        Row: {
          atelier_id: string
          created_at: string
          created_by: string | null
          date_creation: string
          date_cuisson: string | null
          id: string
          numero: string
          poudre_id: string
          projets_ids: string[]
          status: string
          updated_at: string
        }
        Insert: {
          atelier_id: string
          created_at?: string
          created_by?: string | null
          date_creation?: string
          date_cuisson?: string | null
          id?: string
          numero: string
          poudre_id: string
          projets_ids: string[]
          status?: string
          updated_at?: string
        }
        Update: {
          atelier_id?: string
          created_at?: string
          created_by?: string | null
          date_creation?: string
          date_cuisson?: string | null
          id?: string
          numero?: string
          poudre_id?: string
          projets_ids?: string[]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_poudre_id_fkey"
            columns: ["poudre_id"]
            isOneToOne: false
            referencedRelation: "poudres"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_poudres: {
        Row: {
          atelier_id: string
          created_at: string
          dernier_pesee_at: string | null
          historique_pesees: Json | null
          id: string
          poudre_id: string
          stock_reel_kg: number | null
          stock_theorique_kg: number
          tare_carton_kg: number | null
          updated_at: string
        }
        Insert: {
          atelier_id: string
          created_at?: string
          dernier_pesee_at?: string | null
          historique_pesees?: Json | null
          id?: string
          poudre_id: string
          stock_reel_kg?: number | null
          stock_theorique_kg?: number
          tare_carton_kg?: number | null
          updated_at?: string
        }
        Update: {
          atelier_id?: string
          created_at?: string
          dernier_pesee_at?: string | null
          historique_pesees?: Json | null
          id?: string
          poudre_id?: string
          stock_reel_kg?: number | null
          stock_theorique_kg?: number
          tare_carton_kg?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_poudres_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_poudres_poudre_id_fkey"
            columns: ["poudre_id"]
            isOneToOne: false
            referencedRelation: "poudres"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          atelier_id: string
          created_at: string
          email: string
          full_name: string | null
          id: string
          last_login_at: string | null
          phone: string | null
          role: string
          two_factor_enabled: boolean | null
          two_factor_secret: string | null
          updated_at: string
        }
        Insert: {
          atelier_id: string
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          last_login_at?: string | null
          phone?: string | null
          role?: string
          two_factor_enabled?: boolean | null
          two_factor_secret?: string | null
          updated_at?: string
        }
        Update: {
          atelier_id?: string
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          phone?: string | null
          role?: string
          two_factor_enabled?: boolean | null
          two_factor_secret?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_atelier_id: { Args: never; Returns: string }
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
