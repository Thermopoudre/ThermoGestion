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
      alertes: {
        Row: {
          atelier_id: string
          created_at: string | null
          data: Json | null
          id: string
          lien: string | null
          lu: boolean | null
          lu_at: string | null
          lu_par: string | null
          message: string | null
          titre: string
          type: string
        }
        Insert: {
          atelier_id: string
          created_at?: string | null
          data?: Json | null
          id?: string
          lien?: string | null
          lu?: boolean | null
          lu_at?: string | null
          lu_par?: string | null
          message?: string | null
          titre: string
          type: string
        }
        Update: {
          atelier_id?: string
          created_at?: string | null
          data?: Json | null
          id?: string
          lien?: string | null
          lu?: boolean | null
          lu_at?: string | null
          lu_par?: string | null
          message?: string | null
          titre?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertes_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertes_lu_par_fkey"
            columns: ["lu_par"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ateliers: {
        Row: {
          address: string | null
          assujetti_tva: boolean | null
          auto_review_enabled: boolean | null
          avis_google_api_key: string | null
          avis_google_delay_days: number | null
          avis_google_enabled: boolean | null
          avis_google_location_id: string | null
          avis_google_relance_days: number | null
          bic: string | null
          bl_numero_counter: number | null
          bl_numero_format: string | null
          capacite_m2_jour: number | null
          capital_social: string | null
          created_at: string
          ecran_atelier_config: Json | null
          email: string | null
          facture_numero_counter: number | null
          facture_numero_format: string | null
          forme_juridique: string | null
          google_calendar_connected: boolean | null
          google_calendar_id: string | null
          google_review_link: string | null
          iban: string | null
          id: string
          name: string
          nb_cabines: number | null
          nb_fours: number | null
          numero_rm: string | null
          outlook_connected: boolean | null
          paypal_email: string | null
          paypal_merchant_id: string | null
          phone: string | null
          plan: string
          rcs: string | null
          review_delay_days: number | null
          settings: Json | null
          siret: string | null
          sms_enabled: boolean | null
          sms_templates: Json | null
          storage_quota_gb: number
          storage_used_gb: number
          stripe_account_status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          trial_ends_at: string | null
          tva_intra: string | null
          twilio_account_sid: string | null
          twilio_auth_token: string | null
          twilio_phone_number: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          assujetti_tva?: boolean | null
          auto_review_enabled?: boolean | null
          avis_google_api_key?: string | null
          avis_google_delay_days?: number | null
          avis_google_enabled?: boolean | null
          avis_google_location_id?: string | null
          avis_google_relance_days?: number | null
          bic?: string | null
          bl_numero_counter?: number | null
          bl_numero_format?: string | null
          capacite_m2_jour?: number | null
          capital_social?: string | null
          created_at?: string
          ecran_atelier_config?: Json | null
          email?: string | null
          facture_numero_counter?: number | null
          facture_numero_format?: string | null
          forme_juridique?: string | null
          google_calendar_connected?: boolean | null
          google_calendar_id?: string | null
          google_review_link?: string | null
          iban?: string | null
          id?: string
          name: string
          nb_cabines?: number | null
          nb_fours?: number | null
          numero_rm?: string | null
          outlook_connected?: boolean | null
          paypal_email?: string | null
          paypal_merchant_id?: string | null
          phone?: string | null
          plan?: string
          rcs?: string | null
          review_delay_days?: number | null
          settings?: Json | null
          siret?: string | null
          sms_enabled?: boolean | null
          sms_templates?: Json | null
          storage_quota_gb?: number
          storage_used_gb?: number
          stripe_account_status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          tva_intra?: string | null
          twilio_account_sid?: string | null
          twilio_auth_token?: string | null
          twilio_phone_number?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          assujetti_tva?: boolean | null
          auto_review_enabled?: boolean | null
          avis_google_api_key?: string | null
          avis_google_delay_days?: number | null
          avis_google_enabled?: boolean | null
          avis_google_location_id?: string | null
          avis_google_relance_days?: number | null
          bic?: string | null
          bl_numero_counter?: number | null
          bl_numero_format?: string | null
          capacite_m2_jour?: number | null
          capital_social?: string | null
          created_at?: string
          ecran_atelier_config?: Json | null
          email?: string | null
          facture_numero_counter?: number | null
          facture_numero_format?: string | null
          forme_juridique?: string | null
          google_calendar_connected?: boolean | null
          google_calendar_id?: string | null
          google_review_link?: string | null
          iban?: string | null
          id?: string
          name?: string
          nb_cabines?: number | null
          nb_fours?: number | null
          numero_rm?: string | null
          outlook_connected?: boolean | null
          paypal_email?: string | null
          paypal_merchant_id?: string | null
          phone?: string | null
          plan?: string
          rcs?: string | null
          review_delay_days?: number | null
          settings?: Json | null
          siret?: string | null
          sms_enabled?: boolean | null
          sms_templates?: Json | null
          storage_quota_gb?: number
          storage_used_gb?: number
          stripe_account_status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          tva_intra?: string | null
          twilio_account_sid?: string | null
          twilio_auth_token?: string | null
          twilio_phone_number?: string | null
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
      avis_google: {
        Row: {
          atelier_id: string
          avis_rating: number | null
          avis_received_at: string | null
          avis_text: string | null
          avis_url: string | null
          client_id: string
          created_at: string
          email_relance_sent_at: string | null
          email_sent_at: string | null
          id: string
          projet_id: string
          status: string
          updated_at: string
        }
        Insert: {
          atelier_id: string
          avis_rating?: number | null
          avis_received_at?: string | null
          avis_text?: string | null
          avis_url?: string | null
          client_id: string
          created_at?: string
          email_relance_sent_at?: string | null
          email_sent_at?: string | null
          id?: string
          projet_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          atelier_id?: string
          avis_rating?: number | null
          avis_received_at?: string | null
          avis_text?: string | null
          avis_url?: string | null
          client_id?: string
          created_at?: string
          email_relance_sent_at?: string | null
          email_sent_at?: string | null
          id?: string
          projet_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avis_google_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avis_google_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avis_google_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "projets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avis_google_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "v_rentabilite_projets"
            referencedColumns: ["projet_id"]
          },
        ]
      }
      avoirs: {
        Row: {
          atelier_id: string
          client_id: string
          created_at: string
          created_by: string | null
          facture_id: string
          id: string
          items: Json | null
          montant_ht: number
          montant_ttc: number
          montant_tva: number
          motif: string
          motif_detail: string | null
          notes: string | null
          numero: string
          remboursement_date: string | null
          remboursement_method: string | null
          status: string
          stripe_refund_id: string | null
          tva_rate: number | null
          type: string
          updated_at: string
        }
        Insert: {
          atelier_id: string
          client_id: string
          created_at?: string
          created_by?: string | null
          facture_id: string
          id?: string
          items?: Json | null
          montant_ht: number
          montant_ttc: number
          montant_tva?: number
          motif: string
          motif_detail?: string | null
          notes?: string | null
          numero: string
          remboursement_date?: string | null
          remboursement_method?: string | null
          status?: string
          stripe_refund_id?: string | null
          tva_rate?: number | null
          type?: string
          updated_at?: string
        }
        Update: {
          atelier_id?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          facture_id?: string
          id?: string
          items?: Json | null
          montant_ht?: number
          montant_ttc?: number
          montant_tva?: number
          motif?: string
          motif_detail?: string | null
          notes?: string | null
          numero?: string
          remboursement_date?: string | null
          remboursement_method?: string | null
          status?: string
          stripe_refund_id?: string | null
          tva_rate?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avoirs_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avoirs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avoirs_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
        ]
      }
      bons_livraison: {
        Row: {
          adresse_livraison: string | null
          atelier_id: string
          client_id: string
          created_at: string
          created_by: string | null
          date_livraison: string
          etat_pieces: string | null
          id: string
          items: Json
          numero: string
          observations: string | null
          pdf_url: string | null
          projet_id: string
          reserves: string | null
          signature_client: string | null
          signature_client_data: string | null
          signe_par_client: boolean | null
          signed_at: string | null
          transporteur: string | null
          updated_at: string
        }
        Insert: {
          adresse_livraison?: string | null
          atelier_id: string
          client_id: string
          created_at?: string
          created_by?: string | null
          date_livraison?: string
          etat_pieces?: string | null
          id?: string
          items?: Json
          numero: string
          observations?: string | null
          pdf_url?: string | null
          projet_id: string
          reserves?: string | null
          signature_client?: string | null
          signature_client_data?: string | null
          signe_par_client?: boolean | null
          signed_at?: string | null
          transporteur?: string | null
          updated_at?: string
        }
        Update: {
          adresse_livraison?: string | null
          atelier_id?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          date_livraison?: string
          etat_pieces?: string | null
          id?: string
          items?: Json
          numero?: string
          observations?: string | null
          pdf_url?: string | null
          projet_id?: string
          reserves?: string | null
          signature_client?: string | null
          signature_client_data?: string | null
          signe_par_client?: boolean | null
          signed_at?: string | null
          transporteur?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bons_livraison_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bons_livraison_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bons_livraison_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bons_livraison_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "projets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bons_livraison_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "v_rentabilite_projets"
            referencedColumns: ["projet_id"]
          },
        ]
      }
      certifications_atelier: {
        Row: {
          atelier_id: string
          created_at: string | null
          date_expiration: string | null
          date_obtention: string | null
          document_url: string | null
          id: string
          is_active: boolean | null
          numero_certification: string | null
          rappel_renouvellement_jours: number | null
          type: string
        }
        Insert: {
          atelier_id: string
          created_at?: string | null
          date_expiration?: string | null
          date_obtention?: string | null
          document_url?: string | null
          id?: string
          is_active?: boolean | null
          numero_certification?: string | null
          rappel_renouvellement_jours?: number | null
          type: string
        }
        Update: {
          atelier_id?: string
          created_at?: string | null
          date_expiration?: string | null
          date_obtention?: string | null
          document_url?: string | null
          id?: string
          is_active?: boolean | null
          numero_certification?: string | null
          rappel_renouvellement_jours?: number | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "certifications_atelier_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
        ]
      }
      certificats_conformite: {
        Row: {
          adherence_conforme: boolean | null
          aspect_conforme: boolean | null
          atelier_id: string
          brillance_conforme: boolean | null
          controleur_nom: string | null
          controleur_signature: string | null
          couleur_conforme: boolean | null
          created_at: string | null
          date_cuisson: string | null
          date_emission: string | null
          duree_cuisson: number | null
          epaisseur_mesuree_um: number | null
          id: string
          norme_reference: string | null
          numero: string
          observations: string | null
          pdf_url: string | null
          poudre_fabricant: string | null
          poudre_lot: string | null
          poudre_reference: string | null
          projet_id: string
          temperature_cuisson: number | null
        }
        Insert: {
          adherence_conforme?: boolean | null
          aspect_conforme?: boolean | null
          atelier_id: string
          brillance_conforme?: boolean | null
          controleur_nom?: string | null
          controleur_signature?: string | null
          couleur_conforme?: boolean | null
          created_at?: string | null
          date_cuisson?: string | null
          date_emission?: string | null
          duree_cuisson?: number | null
          epaisseur_mesuree_um?: number | null
          id?: string
          norme_reference?: string | null
          numero: string
          observations?: string | null
          pdf_url?: string | null
          poudre_fabricant?: string | null
          poudre_lot?: string | null
          poudre_reference?: string | null
          projet_id: string
          temperature_cuisson?: number | null
        }
        Update: {
          adherence_conforme?: boolean | null
          aspect_conforme?: boolean | null
          atelier_id?: string
          brillance_conforme?: boolean | null
          controleur_nom?: string | null
          controleur_signature?: string | null
          couleur_conforme?: boolean | null
          created_at?: string | null
          date_cuisson?: string | null
          date_emission?: string | null
          duree_cuisson?: number | null
          epaisseur_mesuree_um?: number | null
          id?: string
          norme_reference?: string | null
          numero?: string
          observations?: string | null
          pdf_url?: string | null
          poudre_fabricant?: string | null
          poudre_lot?: string | null
          poudre_reference?: string | null
          projet_id?: string
          temperature_cuisson?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "certificats_conformite_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificats_conformite_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "projets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificats_conformite_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "v_rentabilite_projets"
            referencedColumns: ["projet_id"]
          },
        ]
      }
      client_confirmations: {
        Row: {
          client_user_id: string | null
          confirmation_code: string | null
          confirmed_at: string
          created_at: string
          id: string
          notes: string | null
          projet_id: string
          type: string
        }
        Insert: {
          client_user_id?: string | null
          confirmation_code?: string | null
          confirmed_at?: string
          created_at?: string
          id?: string
          notes?: string | null
          projet_id: string
          type: string
        }
        Update: {
          client_user_id?: string | null
          confirmation_code?: string | null
          confirmed_at?: string
          created_at?: string
          id?: string
          notes?: string | null
          projet_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_confirmations_client_user_id_fkey"
            columns: ["client_user_id"]
            isOneToOne: false
            referencedRelation: "client_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_confirmations_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "projets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_confirmations_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "v_rentabilite_projets"
            referencedColumns: ["projet_id"]
          },
        ]
      }
      client_invitations: {
        Row: {
          atelier_id: string | null
          client_id: string | null
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          atelier_id?: string | null
          client_id?: string | null
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          token?: string
          used_at?: string | null
        }
        Update: {
          atelier_id?: string | null
          client_id?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_invitations_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_invitations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_users: {
        Row: {
          atelier_id: string
          client_id: string
          created_at: string
          email: string
          email_verified: boolean | null
          full_name: string | null
          id: string
          last_login_at: string | null
          updated_at: string
        }
        Insert: {
          atelier_id: string
          client_id: string
          created_at?: string
          email: string
          email_verified?: boolean | null
          full_name?: string | null
          id: string
          last_login_at?: string | null
          updated_at?: string
        }
        Update: {
          atelier_id?: string
          client_id?: string
          created_at?: string
          email?: string
          email_verified?: boolean | null
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_users_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          adresse_livraison: string | null
          atelier_id: string
          ca_total: number | null
          categorie: string | null
          created_at: string
          date_dernier_contact: string | null
          date_premier_contact: string | null
          email: string
          facture_trigger: string | null
          full_name: string
          horaires_contact: string | null
          id: string
          nb_projets: number | null
          notes: string | null
          phone: string | null
          preferences_contact: string | null
          score_fidelite: number | null
          siret: string | null
          sms_notifications: Json | null
          sms_optin: boolean | null
          source_acquisition: string | null
          tags: string[] | null
          tva_intra: string | null
          type: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          adresse_livraison?: string | null
          atelier_id: string
          ca_total?: number | null
          categorie?: string | null
          created_at?: string
          date_dernier_contact?: string | null
          date_premier_contact?: string | null
          email: string
          facture_trigger?: string | null
          full_name: string
          horaires_contact?: string | null
          id?: string
          nb_projets?: number | null
          notes?: string | null
          phone?: string | null
          preferences_contact?: string | null
          score_fidelite?: number | null
          siret?: string | null
          sms_notifications?: Json | null
          sms_optin?: boolean | null
          source_acquisition?: string | null
          tags?: string[] | null
          tva_intra?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          adresse_livraison?: string | null
          atelier_id?: string
          ca_total?: number | null
          categorie?: string | null
          created_at?: string
          date_dernier_contact?: string | null
          date_premier_contact?: string | null
          email?: string
          facture_trigger?: string | null
          full_name?: string
          horaires_contact?: string | null
          id?: string
          nb_projets?: number | null
          notes?: string | null
          phone?: string | null
          preferences_contact?: string | null
          score_fidelite?: number | null
          siret?: string | null
          sms_notifications?: Json | null
          sms_optin?: boolean | null
          source_acquisition?: string | null
          tags?: string[] | null
          tva_intra?: string | null
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
      config_relances: {
        Row: {
          actif: boolean | null
          atelier_id: string
          canal_j1: string | null
          canal_j2: string | null
          canal_j3: string | null
          created_at: string | null
          delai_j1: number | null
          delai_j2: number | null
          delai_j3: number | null
          id: string
          template_email: string | null
          template_sms: string | null
          type_relance: string
          updated_at: string | null
        }
        Insert: {
          actif?: boolean | null
          atelier_id: string
          canal_j1?: string | null
          canal_j2?: string | null
          canal_j3?: string | null
          created_at?: string | null
          delai_j1?: number | null
          delai_j2?: number | null
          delai_j3?: number | null
          id?: string
          template_email?: string | null
          template_sms?: string | null
          type_relance: string
          updated_at?: string | null
        }
        Update: {
          actif?: boolean | null
          atelier_id?: string
          canal_j1?: string | null
          canal_j2?: string | null
          canal_j3?: string | null
          created_at?: string | null
          delai_j1?: number | null
          delai_j2?: number | null
          delai_j3?: number | null
          id?: string
          template_email?: string | null
          template_sms?: string | null
          type_relance?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "config_relances_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
        ]
      }
      contrats_clients: {
        Row: {
          actif: boolean | null
          atelier_id: string
          client_id: string
          conditions_paiement: string | null
          created_at: string | null
          date_debut: string
          date_fin: string | null
          delai_paiement_jours: number | null
          id: string
          notes: string | null
          numero: string | null
          prix_m2_negocie: number | null
          remise_globale_pourcent: number | null
          updated_at: string | null
          volume_engagement_m2: number | null
        }
        Insert: {
          actif?: boolean | null
          atelier_id: string
          client_id: string
          conditions_paiement?: string | null
          created_at?: string | null
          date_debut: string
          date_fin?: string | null
          delai_paiement_jours?: number | null
          id?: string
          notes?: string | null
          numero?: string | null
          prix_m2_negocie?: number | null
          remise_globale_pourcent?: number | null
          updated_at?: string | null
          volume_engagement_m2?: number | null
        }
        Update: {
          actif?: boolean | null
          atelier_id?: string
          client_id?: string
          conditions_paiement?: string | null
          created_at?: string | null
          date_debut?: string
          date_fin?: string | null
          delai_paiement_jours?: number | null
          id?: string
          notes?: string | null
          numero?: string | null
          prix_m2_negocie?: number | null
          remise_globale_pourcent?: number | null
          updated_at?: string | null
          volume_engagement_m2?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contrats_clients_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrats_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      controles_qualite: {
        Row: {
          adherence_ok: boolean | null
          aspect_visuel_ok: boolean | null
          atelier_id: string
          brillance_ok: boolean | null
          commentaires: string | null
          controleur_id: string | null
          created_at: string | null
          date_controle: string | null
          epaisseur_mesure: number | null
          epaisseur_ok: boolean | null
          etape: string
          id: string
          photos: string[] | null
          projet_id: string
          resultat: string | null
          teinte_conforme: boolean | null
        }
        Insert: {
          adherence_ok?: boolean | null
          aspect_visuel_ok?: boolean | null
          atelier_id: string
          brillance_ok?: boolean | null
          commentaires?: string | null
          controleur_id?: string | null
          created_at?: string | null
          date_controle?: string | null
          epaisseur_mesure?: number | null
          epaisseur_ok?: boolean | null
          etape: string
          id?: string
          photos?: string[] | null
          projet_id: string
          resultat?: string | null
          teinte_conforme?: boolean | null
        }
        Update: {
          adherence_ok?: boolean | null
          aspect_visuel_ok?: boolean | null
          atelier_id?: string
          brillance_ok?: boolean | null
          commentaires?: string | null
          controleur_id?: string | null
          created_at?: string | null
          date_controle?: string | null
          epaisseur_mesure?: number | null
          epaisseur_ok?: boolean | null
          etape?: string
          id?: string
          photos?: string[] | null
          projet_id?: string
          resultat?: string | null
          teinte_conforme?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "controles_qualite_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controles_qualite_controleur_id_fkey"
            columns: ["controleur_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controles_qualite_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "projets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controles_qualite_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "v_rentabilite_projets"
            referencedColumns: ["projet_id"]
          },
        ]
      }
      couts_projet: {
        Row: {
          atelier_id: string
          cout_total: number
          cout_unitaire: number | null
          created_at: string | null
          created_by: string | null
          date_cout: string | null
          description: string | null
          id: string
          projet_id: string
          quantite: number | null
          type_cout: string
          unite: string | null
        }
        Insert: {
          atelier_id: string
          cout_total: number
          cout_unitaire?: number | null
          created_at?: string | null
          created_by?: string | null
          date_cout?: string | null
          description?: string | null
          id?: string
          projet_id: string
          quantite?: number | null
          type_cout: string
          unite?: string | null
        }
        Update: {
          atelier_id?: string
          cout_total?: number
          cout_unitaire?: number | null
          created_at?: string | null
          created_by?: string | null
          date_cout?: string | null
          description?: string | null
          id?: string
          projet_id?: string
          quantite?: number | null
          type_cout?: string
          unite?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "couts_projet_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couts_projet_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couts_projet_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "projets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couts_projet_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "v_rentabilite_projets"
            referencedColumns: ["projet_id"]
          },
        ]
      }
      dashboard_widgets: {
        Row: {
          created_at: string | null
          height: number | null
          id: string
          position_x: number | null
          position_y: number | null
          updated_at: string | null
          user_id: string
          visible: boolean | null
          widget_config: Json | null
          widget_type: string
          width: number | null
        }
        Insert: {
          created_at?: string | null
          height?: number | null
          id?: string
          position_x?: number | null
          position_y?: number | null
          updated_at?: string | null
          user_id: string
          visible?: boolean | null
          widget_config?: Json | null
          widget_type: string
          width?: number | null
        }
        Update: {
          created_at?: string | null
          height?: number | null
          id?: string
          position_x?: number | null
          position_y?: number | null
          updated_at?: string | null
          user_id?: string
          visible?: boolean | null
          widget_config?: Json | null
          widget_type?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_widgets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      defaut_types: {
        Row: {
          atelier_id: string
          category: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          atelier_id: string
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          atelier_id?: string
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "defaut_types_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
        ]
      }
      demandes_devis: {
        Row: {
          atelier_id: string
          client_id: string
          couleur_souhaitee: string | null
          created_at: string | null
          date_souhaitee: string | null
          description: string | null
          devis_id: string | null
          finition: string | null
          id: string
          notes: string | null
          quantite: number | null
          status: string | null
          titre: string
          traite_at: string | null
          traite_par: string | null
          type_pieces: string | null
          updated_at: string | null
          urgence: string | null
        }
        Insert: {
          atelier_id: string
          client_id: string
          couleur_souhaitee?: string | null
          created_at?: string | null
          date_souhaitee?: string | null
          description?: string | null
          devis_id?: string | null
          finition?: string | null
          id?: string
          notes?: string | null
          quantite?: number | null
          status?: string | null
          titre: string
          traite_at?: string | null
          traite_par?: string | null
          type_pieces?: string | null
          updated_at?: string | null
          urgence?: string | null
        }
        Update: {
          atelier_id?: string
          client_id?: string
          couleur_souhaitee?: string | null
          created_at?: string | null
          date_souhaitee?: string | null
          description?: string | null
          devis_id?: string | null
          finition?: string | null
          id?: string
          notes?: string | null
          quantite?: number | null
          status?: string | null
          titre?: string
          traite_at?: string | null
          traite_par?: string | null
          type_pieces?: string | null
          updated_at?: string | null
          urgence?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demandes_devis_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_devis_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_devis_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_devis_traite_par_fkey"
            columns: ["traite_par"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      devis: {
        Row: {
          atelier_id: string
          auto_projet_created_at: string | null
          client_id: string
          created_at: string
          created_by: string | null
          derniere_relance_at: string | null
          devis_parent_id: string | null
          id: string
          items: Json
          marge_pct: number | null
          numero: string
          pdf_url: string | null
          public_token: string | null
          relance_count: number | null
          relance_desactivee: boolean | null
          remise: Json | null
          signature_data: Json | null
          signature_ip: string | null
          signature_user_agent: string | null
          signed_at: string | null
          signed_by: string | null
          signed_ip: string | null
          status: string
          template_id: string | null
          total_ht: number
          total_revient: number | null
          total_ttc: number
          tva_rate: number
          updated_at: string
          version_actuelle: number | null
        }
        Insert: {
          atelier_id: string
          auto_projet_created_at?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          derniere_relance_at?: string | null
          devis_parent_id?: string | null
          id?: string
          items?: Json
          marge_pct?: number | null
          numero: string
          pdf_url?: string | null
          public_token?: string | null
          relance_count?: number | null
          relance_desactivee?: boolean | null
          remise?: Json | null
          signature_data?: Json | null
          signature_ip?: string | null
          signature_user_agent?: string | null
          signed_at?: string | null
          signed_by?: string | null
          signed_ip?: string | null
          status?: string
          template_id?: string | null
          total_ht: number
          total_revient?: number | null
          total_ttc: number
          tva_rate?: number
          updated_at?: string
          version_actuelle?: number | null
        }
        Update: {
          atelier_id?: string
          auto_projet_created_at?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          derniere_relance_at?: string | null
          devis_parent_id?: string | null
          id?: string
          items?: Json
          marge_pct?: number | null
          numero?: string
          pdf_url?: string | null
          public_token?: string | null
          relance_count?: number | null
          relance_desactivee?: boolean | null
          remise?: Json | null
          signature_data?: Json | null
          signature_ip?: string | null
          signature_user_agent?: string | null
          signed_at?: string | null
          signed_by?: string | null
          signed_ip?: string | null
          status?: string
          template_id?: string | null
          total_ht?: number
          total_revient?: number | null
          total_ttc?: number
          tva_rate?: number
          updated_at?: string
          version_actuelle?: number | null
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
          {
            foreignKeyName: "devis_devis_parent_id_fkey"
            columns: ["devis_parent_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_devis_template"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "devis_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      devis_templates: {
        Row: {
          atelier_id: string
          config: Json
          created_at: string
          created_by: string | null
          css_template: string | null
          description: string | null
          html_template: string | null
          id: string
          is_default: boolean | null
          is_system: boolean | null
          name: string
          template_type: string
          updated_at: string
        }
        Insert: {
          atelier_id: string
          config?: Json
          created_at?: string
          created_by?: string | null
          css_template?: string | null
          description?: string | null
          html_template?: string | null
          id?: string
          is_default?: boolean | null
          is_system?: boolean | null
          name: string
          template_type?: string
          updated_at?: string
        }
        Update: {
          atelier_id?: string
          config?: Json
          created_at?: string
          created_by?: string | null
          css_template?: string | null
          description?: string | null
          html_template?: string | null
          id?: string
          is_default?: boolean | null
          is_system?: boolean | null
          name?: string
          template_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devis_templates_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devis_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      devis_versions: {
        Row: {
          created_at: string | null
          created_by: string | null
          devis_id: string
          id: string
          items: Json
          motif_modification: string | null
          notes: string | null
          total_ht: number
          total_ttc: number
          version_number: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          devis_id: string
          id?: string
          items: Json
          motif_modification?: string | null
          notes?: string | null
          total_ht: number
          total_ttc: number
          version_number?: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          devis_id?: string
          id?: string
          items?: Json
          motif_modification?: string | null
          notes?: string | null
          total_ht?: number
          total_ttc?: number
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "devis_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devis_versions_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
        ]
      }
      email_config: {
        Row: {
          api_key: string | null
          atelier_id: string
          created_at: string
          id: string
          oauth_access_token: string | null
          oauth_expires_at: string | null
          oauth_refresh_token: string | null
          provider: string
          reply_to: string | null
          sender_email: string | null
          sender_name: string | null
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_secure: boolean | null
          smtp_user: string | null
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          atelier_id: string
          created_at?: string
          id?: string
          oauth_access_token?: string | null
          oauth_expires_at?: string | null
          oauth_refresh_token?: string | null
          provider?: string
          reply_to?: string | null
          sender_email?: string | null
          sender_name?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean | null
          smtp_user?: string | null
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          atelier_id?: string
          created_at?: string
          id?: string
          oauth_access_token?: string | null
          oauth_expires_at?: string | null
          oauth_refresh_token?: string | null
          provider?: string
          reply_to?: string | null
          sender_email?: string | null
          sender_name?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean | null
          smtp_user?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_config_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: true
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
        ]
      }
      email_oauth_tokens: {
        Row: {
          access_token: string
          atelier_id: string
          created_at: string
          expires_at: string | null
          id: string
          provider: string
          refresh_token: string | null
          scope: string | null
          token_type: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          atelier_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          provider: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          atelier_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          provider?: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_oauth_tokens_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
        ]
      }
      email_queue: {
        Row: {
          atelier_id: string
          attachments: Json | null
          created_at: string
          error_message: string | null
          html_content: string
          id: string
          max_retries: number | null
          retry_count: number | null
          sent_at: string | null
          status: string
          subject: string
          text_content: string | null
          to_email: string
          to_name: string | null
          updated_at: string
        }
        Insert: {
          atelier_id: string
          attachments?: Json | null
          created_at?: string
          error_message?: string | null
          html_content: string
          id?: string
          max_retries?: number | null
          retry_count?: number | null
          sent_at?: string | null
          status?: string
          subject: string
          text_content?: string | null
          to_email: string
          to_name?: string | null
          updated_at?: string
        }
        Update: {
          atelier_id?: string
          attachments?: Json | null
          created_at?: string
          error_message?: string | null
          html_content?: string
          id?: string
          max_retries?: number | null
          retry_count?: number | null
          sent_at?: string | null
          status?: string
          subject?: string
          text_content?: string | null
          to_email?: string
          to_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_queue_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
        ]
      }
      equipements: {
        Row: {
          atelier_id: string
          capacite_kg: number | null
          created_at: string | null
          disponible: boolean | null
          hauteur_cm: number | null
          horaires_ouverture: string | null
          id: string
          largeur_cm: number | null
          longueur_cm: number | null
          nom: string
          notes: string | null
          prochaine_maintenance: string | null
          temp_max: number | null
          type: string
          updated_at: string | null
        }
        Insert: {
          atelier_id: string
          capacite_kg?: number | null
          created_at?: string | null
          disponible?: boolean | null
          hauteur_cm?: number | null
          horaires_ouverture?: string | null
          id?: string
          largeur_cm?: number | null
          longueur_cm?: number | null
          nom: string
          notes?: string | null
          prochaine_maintenance?: string | null
          temp_max?: number | null
          type: string
          updated_at?: string | null
        }
        Update: {
          atelier_id?: string
          capacite_kg?: number | null
          created_at?: string | null
          disponible?: boolean | null
          hauteur_cm?: number | null
          horaires_ouverture?: string | null
          id?: string
          largeur_cm?: number | null
          longueur_cm?: number | null
          nom?: string
          notes?: string | null
          prochaine_maintenance?: string | null
          temp_max?: number | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipements_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
        ]
      }
      exports_comptables: {
        Row: {
          atelier_id: string
          created_at: string | null
          created_by: string | null
          date_debut: string
          date_fin: string
          fichier_url: string | null
          id: string
          nb_ecritures: number | null
          type_export: string
        }
        Insert: {
          atelier_id: string
          created_at?: string | null
          created_by?: string | null
          date_debut: string
          date_fin: string
          fichier_url?: string | null
          id?: string
          nb_ecritures?: number | null
          type_export: string
        }
        Update: {
          atelier_id?: string
          created_at?: string | null
          created_by?: string | null
          date_debut?: string
          date_fin?: string
          fichier_url?: string | null
          id?: string
          nb_ecritures?: number | null
          type_export?: string
        }
        Relationships: [
          {
            foreignKeyName: "exports_comptables_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exports_comptables_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      factures: {
        Row: {
          acompte_amount: number | null
          atelier_id: string
          auto_created: boolean | null
          categorie_operation: string | null
          client_id: string
          created_at: string
          created_by: string | null
          devis_id: string | null
          devis_numero: string | null
          due_date: string | null
          fec_exported: boolean | null
          fec_exported_at: string | null
          format_numero: string | null
          id: string
          items: Json | null
          notes: string | null
          numero: string
          paid_at: string | null
          payment_initiated_at: string | null
          payment_method: string | null
          payment_ref: string | null
          payment_status: string | null
          pdf_url: string | null
          pourcentage_acompte: number | null
          projet_id: string | null
          public_token: string | null
          signature_url: string | null
          signed_at: string | null
          status: string
          stripe_payment_intent_id: string | null
          stripe_payment_link_id: string | null
          stripe_session_id: string | null
          total_ht: number
          total_ttc: number
          tva_rate: number
          type: string
          updated_at: string
        }
        Insert: {
          acompte_amount?: number | null
          atelier_id: string
          auto_created?: boolean | null
          categorie_operation?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          devis_id?: string | null
          devis_numero?: string | null
          due_date?: string | null
          fec_exported?: boolean | null
          fec_exported_at?: string | null
          format_numero?: string | null
          id?: string
          items?: Json | null
          notes?: string | null
          numero: string
          paid_at?: string | null
          payment_initiated_at?: string | null
          payment_method?: string | null
          payment_ref?: string | null
          payment_status?: string | null
          pdf_url?: string | null
          pourcentage_acompte?: number | null
          projet_id?: string | null
          public_token?: string | null
          signature_url?: string | null
          signed_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_payment_link_id?: string | null
          stripe_session_id?: string | null
          total_ht: number
          total_ttc: number
          tva_rate?: number
          type: string
          updated_at?: string
        }
        Update: {
          acompte_amount?: number | null
          atelier_id?: string
          auto_created?: boolean | null
          categorie_operation?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          devis_id?: string | null
          devis_numero?: string | null
          due_date?: string | null
          fec_exported?: boolean | null
          fec_exported_at?: string | null
          format_numero?: string | null
          id?: string
          items?: Json | null
          notes?: string | null
          numero?: string
          paid_at?: string | null
          payment_initiated_at?: string | null
          payment_method?: string | null
          payment_ref?: string | null
          payment_status?: string | null
          pdf_url?: string | null
          pourcentage_acompte?: number | null
          projet_id?: string | null
          public_token?: string | null
          signature_url?: string | null
          signed_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_payment_link_id?: string | null
          stripe_session_id?: string | null
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
            foreignKeyName: "factures_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "projets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "v_rentabilite_projets"
            referencedColumns: ["projet_id"]
          },
        ]
      }
      grilles_tarifaires: {
        Row: {
          atelier_id: string
          complexite_complexe_coef: number | null
          complexite_moyenne_coef: number | null
          complexite_simple_coef: number | null
          created_at: string | null
          finition_brillant_coef: number | null
          finition_mat_coef: number | null
          finition_metallise_coef: number | null
          finition_satine_coef: number | null
          finition_texture_coef: number | null
          forfait_minimum: number | null
          id: string
          is_default: boolean | null
          nom: string
          palier_1_coef: number | null
          palier_1_max_m2: number | null
          palier_2_coef: number | null
          palier_2_max_m2: number | null
          palier_3_coef: number | null
          palier_3_max_m2: number | null
          palier_4_coef: number | null
          prix_base_m2: number | null
          prix_couche_sup: number | null
          prix_degraissage_m2: number | null
          prix_primaire_m2: number | null
          prix_sablage_m2: number | null
          updated_at: string | null
        }
        Insert: {
          atelier_id: string
          complexite_complexe_coef?: number | null
          complexite_moyenne_coef?: number | null
          complexite_simple_coef?: number | null
          created_at?: string | null
          finition_brillant_coef?: number | null
          finition_mat_coef?: number | null
          finition_metallise_coef?: number | null
          finition_satine_coef?: number | null
          finition_texture_coef?: number | null
          forfait_minimum?: number | null
          id?: string
          is_default?: boolean | null
          nom?: string
          palier_1_coef?: number | null
          palier_1_max_m2?: number | null
          palier_2_coef?: number | null
          palier_2_max_m2?: number | null
          palier_3_coef?: number | null
          palier_3_max_m2?: number | null
          palier_4_coef?: number | null
          prix_base_m2?: number | null
          prix_couche_sup?: number | null
          prix_degraissage_m2?: number | null
          prix_primaire_m2?: number | null
          prix_sablage_m2?: number | null
          updated_at?: string | null
        }
        Update: {
          atelier_id?: string
          complexite_complexe_coef?: number | null
          complexite_moyenne_coef?: number | null
          complexite_simple_coef?: number | null
          created_at?: string | null
          finition_brillant_coef?: number | null
          finition_mat_coef?: number | null
          finition_metallise_coef?: number | null
          finition_satine_coef?: number | null
          finition_texture_coef?: number | null
          forfait_minimum?: number | null
          id?: string
          is_default?: boolean | null
          nom?: string
          palier_1_coef?: number | null
          palier_1_max_m2?: number | null
          palier_2_coef?: number | null
          palier_2_max_m2?: number | null
          palier_3_coef?: number | null
          palier_3_max_m2?: number | null
          palier_4_coef?: number | null
          prix_base_m2?: number | null
          prix_couche_sup?: number | null
          prix_degraissage_m2?: number | null
          prix_primaire_m2?: number | null
          prix_sablage_m2?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grilles_tarifaires_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions_client: {
        Row: {
          atelier_id: string
          client_id: string
          contenu: string | null
          created_at: string | null
          date_interaction: string | null
          duree_minutes: number | null
          id: string
          relance_prevue: string | null
          resultat: string | null
          sujet: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          atelier_id: string
          client_id: string
          contenu?: string | null
          created_at?: string | null
          date_interaction?: string | null
          duree_minutes?: number | null
          id?: string
          relance_prevue?: string | null
          resultat?: string | null
          sujet?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          atelier_id?: string
          client_id?: string
          contenu?: string | null
          created_at?: string | null
          date_interaction?: string | null
          duree_minutes?: number | null
          id?: string
          relance_prevue?: string | null
          resultat?: string | null
          sujet?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interactions_client_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_client_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_client_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunites: {
        Row: {
          atelier_id: string
          client_id: string
          created_at: string | null
          date_cloture_prevue: string | null
          description: string | null
          devis_id: string | null
          id: string
          montant_estime: number | null
          notes: string | null
          probabilite: number | null
          responsable_id: string | null
          source: string | null
          statut: string | null
          titre: string
          updated_at: string | null
        }
        Insert: {
          atelier_id: string
          client_id: string
          created_at?: string | null
          date_cloture_prevue?: string | null
          description?: string | null
          devis_id?: string | null
          id?: string
          montant_estime?: number | null
          notes?: string | null
          probabilite?: number | null
          responsable_id?: string | null
          source?: string | null
          statut?: string | null
          titre: string
          updated_at?: string | null
        }
        Update: {
          atelier_id?: string
          client_id?: string
          created_at?: string | null
          date_cloture_prevue?: string | null
          description?: string | null
          devis_id?: string | null
          id?: string
          montant_estime?: number | null
          notes?: string | null
          probabilite?: number | null
          responsable_id?: string | null
          source?: string | null
          statut?: string | null
          titre?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunites_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunites_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunites_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      paiements: {
        Row: {
          amount: number
          atelier_id: string
          client_id: string
          created_at: string
          facture_id: string
          id: string
          notes: string | null
          paid_at: string | null
          payment_method: string
          payment_ref: string | null
          status: string
          stripe_payment_intent_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          atelier_id: string
          client_id: string
          created_at?: string
          facture_id: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method: string
          payment_ref?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          atelier_id?: string
          client_id?: string
          created_at?: string
          facture_id?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string
          payment_ref?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paiements_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paiements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paiements_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "factures"
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
          {
            foreignKeyName: "photos_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "v_rentabilite_projets"
            referencedColumns: ["projet_id"]
          },
        ]
      }
      pointages: {
        Row: {
          atelier_id: string
          created_at: string | null
          date_debut: string
          date_fin: string | null
          duree_minutes: number | null
          etape: string
          id: string
          notes: string | null
          pause_minutes: number | null
          projet_id: string
          user_id: string
        }
        Insert: {
          atelier_id: string
          created_at?: string | null
          date_debut?: string
          date_fin?: string | null
          duree_minutes?: number | null
          etape: string
          id?: string
          notes?: string | null
          pause_minutes?: number | null
          projet_id: string
          user_id: string
        }
        Update: {
          atelier_id?: string
          created_at?: string | null
          date_debut?: string
          date_fin?: string | null
          duree_minutes?: number | null
          etape?: string
          id?: string
          notes?: string | null
          pause_minutes?: number | null
          projet_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pointages_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pointages_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "projets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pointages_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "v_rentabilite_projets"
            referencedColumns: ["projet_id"]
          },
          {
            foreignKeyName: "pointages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      poudres: {
        Row: {
          atelier_id: string
          certifications: string[] | null
          consommation_m2: number | null
          created_at: string
          date_peremption: string | null
          date_reception: string | null
          densite: number | null
          duree_cuisson: number | null
          epaisseur_conseillee: number | null
          fds_url: string | null
          fiche_technique_url: string | null
          finition: string
          fournisseur: string | null
          id: string
          marque: string
          numero_lot: string | null
          prix_kg: number | null
          qualicoat_approved: boolean | null
          qualimarine_approved: boolean | null
          ral: string | null
          reference: string
          rendement_m2_kg: number | null
          source: string | null
          stock_min_kg: number | null
          stock_reel_kg: number | null
          stock_theorique_kg: number | null
          temp_cuisson: number | null
          type: string
          updated_at: string
        }
        Insert: {
          atelier_id: string
          certifications?: string[] | null
          consommation_m2?: number | null
          created_at?: string
          date_peremption?: string | null
          date_reception?: string | null
          densite?: number | null
          duree_cuisson?: number | null
          epaisseur_conseillee?: number | null
          fds_url?: string | null
          fiche_technique_url?: string | null
          finition: string
          fournisseur?: string | null
          id?: string
          marque: string
          numero_lot?: string | null
          prix_kg?: number | null
          qualicoat_approved?: boolean | null
          qualimarine_approved?: boolean | null
          ral?: string | null
          reference: string
          rendement_m2_kg?: number | null
          source?: string | null
          stock_min_kg?: number | null
          stock_reel_kg?: number | null
          stock_theorique_kg?: number | null
          temp_cuisson?: number | null
          type: string
          updated_at?: string
        }
        Update: {
          atelier_id?: string
          certifications?: string[] | null
          consommation_m2?: number | null
          created_at?: string
          date_peremption?: string | null
          date_reception?: string | null
          densite?: number | null
          duree_cuisson?: number | null
          epaisseur_conseillee?: number | null
          fds_url?: string | null
          fiche_technique_url?: string | null
          finition?: string
          fournisseur?: string | null
          id?: string
          marque?: string
          numero_lot?: string | null
          prix_kg?: number | null
          qualicoat_approved?: boolean | null
          qualimarine_approved?: boolean | null
          ral?: string | null
          reference?: string
          rendement_m2_kg?: number | null
          source?: string | null
          stock_min_kg?: number | null
          stock_reel_kg?: number | null
          stock_theorique_kg?: number | null
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
      predictions: {
        Row: {
          atelier_id: string
          confidence: number | null
          created_at: string | null
          entite_id: string | null
          entite_type: string | null
          id: string
          modele_version: string | null
          prediction_value: Json
          type: string
          was_correct: boolean | null
        }
        Insert: {
          atelier_id: string
          confidence?: number | null
          created_at?: string | null
          entite_id?: string | null
          entite_type?: string | null
          id?: string
          modele_version?: string | null
          prediction_value: Json
          type: string
          was_correct?: boolean | null
        }
        Update: {
          atelier_id?: string
          confidence?: number | null
          created_at?: string | null
          entite_id?: string | null
          entite_type?: string | null
          id?: string
          modele_version?: string | null
          prediction_value?: Json
          type?: string
          was_correct?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "predictions_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
        ]
      }
      prestations: {
        Row: {
          atelier_id: string
          categorie: string | null
          code: string
          created_at: string | null
          description: string | null
          duree_estimee_min: number | null
          id: string
          is_active: boolean | null
          nom: string
          ordre_affichage: number | null
          prix_unitaire_ht: number
          tva_rate: number | null
          unite: string | null
          updated_at: string | null
        }
        Insert: {
          atelier_id: string
          categorie?: string | null
          code: string
          created_at?: string | null
          description?: string | null
          duree_estimee_min?: number | null
          id?: string
          is_active?: boolean | null
          nom: string
          ordre_affichage?: number | null
          prix_unitaire_ht: number
          tva_rate?: number | null
          unite?: string | null
          updated_at?: string | null
        }
        Update: {
          atelier_id?: string
          categorie?: string | null
          code?: string
          created_at?: string | null
          description?: string | null
          duree_estimee_min?: number | null
          id?: string
          is_active?: boolean | null
          nom?: string
          ordre_affichage?: number | null
          prix_unitaire_ht?: number
          tva_rate?: number | null
          unite?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prestations_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
        ]
      }
      projet_racks: {
        Row: {
          created_at: string | null
          date_chargement: string | null
          date_dechargement: string | null
          id: string
          notes: string | null
          photo_chargement_url: string | null
          projet_id: string
          rack_id: string
        }
        Insert: {
          created_at?: string | null
          date_chargement?: string | null
          date_dechargement?: string | null
          id?: string
          notes?: string | null
          photo_chargement_url?: string | null
          projet_id: string
          rack_id: string
        }
        Update: {
          created_at?: string | null
          date_chargement?: string | null
          date_dechargement?: string | null
          id?: string
          notes?: string | null
          photo_chargement_url?: string | null
          projet_id?: string
          rack_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projet_racks_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "projets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projet_racks_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "v_rentabilite_projets"
            referencedColumns: ["projet_id"]
          },
          {
            foreignKeyName: "projet_racks_rack_id_fkey"
            columns: ["rack_id"]
            isOneToOne: false
            referencedRelation: "racks"
            referencedColumns: ["id"]
          },
        ]
      }
      projets: {
        Row: {
          atelier_id: string
          auto_created: boolean | null
          auto_facture_created_at: string | null
          auto_stock_decremented_at: string | null
          bl_id: string | null
          certification_requise: string | null
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
          facture_acompte_id: string | null
          facture_solde_id: string | null
          id: string
          montant_acompte: number | null
          montant_facture: number | null
          montant_paye: number | null
          montant_total: number | null
          name: string
          numero: string
          parametres_cuisson: Json | null
          photos_count: number | null
          photos_size_mb: number | null
          pieces: Json | null
          poudre_id: string | null
          poudre_quantite_kg: number | null
          public_token: string | null
          qr_generated_at: string | null
          qr_token: string | null
          status: string
          temp_cuisson: number | null
          temps_estime_min: number | null
          temps_reel_min: number | null
          updated_at: string
          workflow_config: Json | null
        }
        Insert: {
          atelier_id: string
          auto_created?: boolean | null
          auto_facture_created_at?: string | null
          auto_stock_decremented_at?: string | null
          bl_id?: string | null
          certification_requise?: string | null
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
          facture_acompte_id?: string | null
          facture_solde_id?: string | null
          id?: string
          montant_acompte?: number | null
          montant_facture?: number | null
          montant_paye?: number | null
          montant_total?: number | null
          name: string
          numero: string
          parametres_cuisson?: Json | null
          photos_count?: number | null
          photos_size_mb?: number | null
          pieces?: Json | null
          poudre_id?: string | null
          poudre_quantite_kg?: number | null
          public_token?: string | null
          qr_generated_at?: string | null
          qr_token?: string | null
          status?: string
          temp_cuisson?: number | null
          temps_estime_min?: number | null
          temps_reel_min?: number | null
          updated_at?: string
          workflow_config?: Json | null
        }
        Update: {
          atelier_id?: string
          auto_created?: boolean | null
          auto_facture_created_at?: string | null
          auto_stock_decremented_at?: string | null
          bl_id?: string | null
          certification_requise?: string | null
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
          facture_acompte_id?: string | null
          facture_solde_id?: string | null
          id?: string
          montant_acompte?: number | null
          montant_facture?: number | null
          montant_paye?: number | null
          montant_total?: number | null
          name?: string
          numero?: string
          parametres_cuisson?: Json | null
          photos_count?: number | null
          photos_size_mb?: number | null
          pieces?: Json | null
          poudre_id?: string | null
          poudre_quantite_kg?: number | null
          public_token?: string | null
          qr_generated_at?: string | null
          qr_token?: string | null
          status?: string
          temp_cuisson?: number | null
          temps_estime_min?: number | null
          temps_reel_min?: number | null
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
            foreignKeyName: "projets_facture_acompte_id_fkey"
            columns: ["facture_acompte_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projets_facture_solde_id_fkey"
            columns: ["facture_solde_id"]
            isOneToOne: false
            referencedRelation: "factures"
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
      push_notifications: {
        Row: {
          atelier_id: string
          badge: string | null
          body: string
          created_at: string
          data: Json | null
          error_message: string | null
          icon: string | null
          id: string
          sent_at: string | null
          status: string
          subscription_id: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          atelier_id: string
          badge?: string | null
          body: string
          created_at?: string
          data?: Json | null
          error_message?: string | null
          icon?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          subscription_id?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          atelier_id?: string
          badge?: string | null
          body?: string
          created_at?: string
          data?: Json | null
          error_message?: string | null
          icon?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          subscription_id?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_notifications_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_notifications_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "push_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          atelier_id: string
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          atelier_id: string
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          atelier_id?: string
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      racks: {
        Row: {
          atelier_id: string
          capacite_kg: number | null
          created_at: string | null
          hauteur_cm: number | null
          id: string
          largeur_cm: number | null
          longueur_cm: number | null
          nb_crochets: number | null
          nom: string | null
          notes: string | null
          numero: string
          photo_url: string | null
          status: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          atelier_id: string
          capacite_kg?: number | null
          created_at?: string | null
          hauteur_cm?: number | null
          id?: string
          largeur_cm?: number | null
          longueur_cm?: number | null
          nb_crochets?: number | null
          nom?: string | null
          notes?: string | null
          numero: string
          photo_url?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          atelier_id?: string
          capacite_kg?: number | null
          created_at?: string | null
          hauteur_cm?: number | null
          id?: string
          largeur_cm?: number | null
          longueur_cm?: number | null
          nb_crochets?: number | null
          nom?: string | null
          notes?: string | null
          numero?: string
          photo_url?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "racks_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_seconds: number
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_seconds?: number
          window_start?: string
        }
        Update: {
          count?: number
          key?: string
          window_seconds?: number
          window_start?: string
        }
        Relationships: []
      }
      relances: {
        Row: {
          atelier_id: string
          canal: string | null
          client_id: string
          contenu: string | null
          created_at: string | null
          date_relance: string | null
          id: string
          niveau: number | null
          prochaine_relance: string | null
          reference_id: string
          reference_type: string
          repondu_at: string | null
          reponse: string | null
          statut: string | null
          type_relance: string
        }
        Insert: {
          atelier_id: string
          canal?: string | null
          client_id: string
          contenu?: string | null
          created_at?: string | null
          date_relance?: string | null
          id?: string
          niveau?: number | null
          prochaine_relance?: string | null
          reference_id: string
          reference_type: string
          repondu_at?: string | null
          reponse?: string | null
          statut?: string | null
          type_relance: string
        }
        Update: {
          atelier_id?: string
          canal?: string | null
          client_id?: string
          contenu?: string | null
          created_at?: string | null
          date_relance?: string | null
          id?: string
          niveau?: number | null
          prochaine_relance?: string | null
          reference_id?: string
          reference_type?: string
          repondu_at?: string | null
          reponse?: string | null
          statut?: string | null
          type_relance?: string
        }
        Relationships: [
          {
            foreignKeyName: "relances_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relances_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations_equipement: {
        Row: {
          created_at: string | null
          created_by: string | null
          date_debut: string
          date_fin: string
          equipement_id: string
          id: string
          notes: string | null
          projet_id: string | null
          temperature: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date_debut: string
          date_fin: string
          equipement_id: string
          id?: string
          notes?: string | null
          projet_id?: string | null
          temperature?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date_debut?: string
          date_fin?: string
          equipement_id?: string
          id?: string
          notes?: string | null
          projet_id?: string | null
          temperature?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_equipement_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_equipement_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "equipements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_equipement_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "projets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_equipement_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "v_rentabilite_projets"
            referencedColumns: ["projet_id"]
          },
        ]
      }
      retouches: {
        Row: {
          action_corrective: string | null
          atelier_id: string
          cout_estime: number | null
          created_at: string
          created_by: string | null
          date_validation: string | null
          defaut_type_id: string | null
          delai_induit_jours: number | null
          description: string
          gravite: string | null
          id: string
          photo_url: string | null
          photos_apres: string[] | null
          photos_avant: string[] | null
          projet_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          step_index: number | null
          temps_estime_min: number | null
          temps_reel_min: number | null
          type_defaut_id: string | null
          updated_at: string
          valide_par: string | null
        }
        Insert: {
          action_corrective?: string | null
          atelier_id: string
          cout_estime?: number | null
          created_at?: string
          created_by?: string | null
          date_validation?: string | null
          defaut_type_id?: string | null
          delai_induit_jours?: number | null
          description: string
          gravite?: string | null
          id?: string
          photo_url?: string | null
          photos_apres?: string[] | null
          photos_avant?: string[] | null
          projet_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          step_index?: number | null
          temps_estime_min?: number | null
          temps_reel_min?: number | null
          type_defaut_id?: string | null
          updated_at?: string
          valide_par?: string | null
        }
        Update: {
          action_corrective?: string | null
          atelier_id?: string
          cout_estime?: number | null
          created_at?: string
          created_by?: string | null
          date_validation?: string | null
          defaut_type_id?: string | null
          delai_induit_jours?: number | null
          description?: string
          gravite?: string | null
          id?: string
          photo_url?: string | null
          photos_apres?: string[] | null
          photos_avant?: string[] | null
          projet_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          step_index?: number | null
          temps_estime_min?: number | null
          temps_reel_min?: number | null
          type_defaut_id?: string | null
          updated_at?: string
          valide_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retouches_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retouches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retouches_defaut_type_id_fkey"
            columns: ["defaut_type_id"]
            isOneToOne: false
            referencedRelation: "defaut_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retouches_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "projets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retouches_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "v_rentabilite_projets"
            referencedColumns: ["projet_id"]
          },
          {
            foreignKeyName: "retouches_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retouches_type_defaut_id_fkey"
            columns: ["type_defaut_id"]
            isOneToOne: false
            referencedRelation: "types_defauts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retouches_valide_par_fkey"
            columns: ["valide_par"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      review_requests: {
        Row: {
          atelier_id: string
          clicked_at: string | null
          client_id: string | null
          created_at: string | null
          email: string
          id: string
          projet_id: string | null
          sent_at: string | null
          tracking_token: string | null
        }
        Insert: {
          atelier_id: string
          clicked_at?: string | null
          client_id?: string | null
          created_at?: string | null
          email: string
          id?: string
          projet_id?: string | null
          sent_at?: string | null
          tracking_token?: string | null
        }
        Update: {
          atelier_id?: string
          clicked_at?: string | null
          client_id?: string | null
          created_at?: string | null
          email?: string
          id?: string
          projet_id?: string | null
          sent_at?: string | null
          tracking_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_requests_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_requests_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "projets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_requests_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "v_rentabilite_projets"
            referencedColumns: ["projet_id"]
          },
        ]
      }
      saas_invoices: {
        Row: {
          amount_ht: number
          amount_ttc: number
          amount_tva: number | null
          atelier_id: string
          created_at: string | null
          hosted_url: string | null
          id: string
          numero: string
          paid_at: string | null
          pdf_url: string | null
          period_end: string | null
          period_start: string | null
          status: string
          stripe_invoice_id: string | null
          subscription_id: string | null
          tva_rate: number | null
        }
        Insert: {
          amount_ht: number
          amount_ttc: number
          amount_tva?: number | null
          atelier_id: string
          created_at?: string | null
          hosted_url?: string | null
          id?: string
          numero: string
          paid_at?: string | null
          pdf_url?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          stripe_invoice_id?: string | null
          subscription_id?: string | null
          tva_rate?: number | null
        }
        Update: {
          amount_ht?: number
          amount_ttc?: number
          amount_tva?: number | null
          atelier_id?: string
          created_at?: string | null
          hosted_url?: string | null
          id?: string
          numero?: string
          paid_at?: string | null
          pdf_url?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          stripe_invoice_id?: string | null
          subscription_id?: string | null
          tva_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "saas_invoices_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saas_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
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
      sms_logs: {
        Row: {
          atelier_id: string
          client_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          message: string
          phone_number: string
          projet_id: string | null
          sent_at: string | null
          status: string | null
          twilio_sid: string | null
          type: string | null
        }
        Insert: {
          atelier_id: string
          client_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          message: string
          phone_number: string
          projet_id?: string | null
          sent_at?: string | null
          status?: string | null
          twilio_sid?: string | null
          type?: string | null
        }
        Update: {
          atelier_id?: string
          client_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          message?: string
          phone_number?: string
          projet_id?: string | null
          sent_at?: string | null
          status?: string | null
          twilio_sid?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "projets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "v_rentabilite_projets"
            referencedColumns: ["projet_id"]
          },
        ]
      }
      stats_projets_historique: {
        Row: {
          atelier_id: string
          ca_total: number | null
          created_at: string | null
          delai_moyen_jours: number | null
          id: string
          mois: string
          nb_projets: number | null
          surface_totale_m2: number | null
          taux_retouche: number | null
          temps_moyen_min: number | null
        }
        Insert: {
          atelier_id: string
          ca_total?: number | null
          created_at?: string | null
          delai_moyen_jours?: number | null
          id?: string
          mois: string
          nb_projets?: number | null
          surface_totale_m2?: number | null
          taux_retouche?: number | null
          temps_moyen_min?: number | null
        }
        Update: {
          atelier_id?: string
          ca_total?: number | null
          created_at?: string | null
          delai_moyen_jours?: number | null
          id?: string
          mois?: string
          nb_projets?: number | null
          surface_totale_m2?: number | null
          taux_retouche?: number | null
          temps_moyen_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stats_projets_historique_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_mouvements: {
        Row: {
          atelier_id: string
          created_at: string
          created_by: string | null
          id: string
          motif: string | null
          poudre_id: string
          projet_id: string | null
          quantite: number
          quantite_apres: number | null
          quantite_avant: number | null
          type: string
        }
        Insert: {
          atelier_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          motif?: string | null
          poudre_id: string
          projet_id?: string | null
          quantite: number
          quantite_apres?: number | null
          quantite_avant?: number | null
          type: string
        }
        Update: {
          atelier_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          motif?: string | null
          poudre_id?: string
          projet_id?: string | null
          quantite?: number
          quantite_apres?: number | null
          quantite_avant?: number | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_mouvements_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_mouvements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_mouvements_poudre_id_fkey"
            columns: ["poudre_id"]
            isOneToOne: false
            referencedRelation: "poudres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_mouvements_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "projets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_mouvements_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "v_rentabilite_projets"
            referencedColumns: ["projet_id"]
          },
        ]
      }
      stock_poudres: {
        Row: {
          alerte_active: boolean | null
          atelier_id: string
          created_at: string
          dernier_pesee_at: string | null
          derniere_alerte_at: string | null
          historique_pesees: Json | null
          id: string
          poudre_id: string
          seuil_alerte_kg: number | null
          stock_reel_kg: number | null
          stock_theorique_kg: number
          tare_carton_kg: number | null
          updated_at: string
        }
        Insert: {
          alerte_active?: boolean | null
          atelier_id: string
          created_at?: string
          dernier_pesee_at?: string | null
          derniere_alerte_at?: string | null
          historique_pesees?: Json | null
          id?: string
          poudre_id: string
          seuil_alerte_kg?: number | null
          stock_reel_kg?: number | null
          stock_theorique_kg?: number
          tare_carton_kg?: number | null
          updated_at?: string
        }
        Update: {
          alerte_active?: boolean | null
          atelier_id?: string
          created_at?: string
          dernier_pesee_at?: string | null
          derniere_alerte_at?: string | null
          historique_pesees?: Json | null
          id?: string
          poudre_id?: string
          seuil_alerte_kg?: number | null
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
      subscriptions: {
        Row: {
          atelier_id: string
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan: string
          price_monthly: number | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_end: string | null
          updated_at: string | null
        }
        Insert: {
          atelier_id: string
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          price_monthly?: number | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string | null
        }
        Update: {
          atelier_id?: string
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          price_monthly?: number | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: true
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
        ]
      }
      tarifs_client: {
        Row: {
          contrat_id: string
          created_at: string | null
          description: string | null
          id: string
          prestation_id: string | null
          prix_unitaire_ht: number
          remise_pourcent: number | null
        }
        Insert: {
          contrat_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          prestation_id?: string | null
          prix_unitaire_ht: number
          remise_pourcent?: number | null
        }
        Update: {
          contrat_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          prestation_id?: string | null
          prix_unitaire_ht?: number
          remise_pourcent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tarifs_client_contrat_id_fkey"
            columns: ["contrat_id"]
            isOneToOne: false
            referencedRelation: "contrats_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarifs_client_prestation_id_fkey"
            columns: ["prestation_id"]
            isOneToOne: false
            referencedRelation: "prestations"
            referencedColumns: ["id"]
          },
        ]
      }
      tarifs_clients: {
        Row: {
          atelier_id: string
          client_id: string
          conditions_paiement: string | null
          created_at: string | null
          grille_id: string | null
          id: string
          notes: string | null
          remise_globale_pct: number | null
          updated_at: string | null
        }
        Insert: {
          atelier_id: string
          client_id: string
          conditions_paiement?: string | null
          created_at?: string | null
          grille_id?: string | null
          id?: string
          notes?: string | null
          remise_globale_pct?: number | null
          updated_at?: string | null
        }
        Update: {
          atelier_id?: string
          client_id?: string
          conditions_paiement?: string | null
          created_at?: string | null
          grille_id?: string | null
          id?: string
          notes?: string | null
          remise_globale_pct?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tarifs_clients_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarifs_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarifs_clients_grille_id_fkey"
            columns: ["grille_id"]
            isOneToOne: false
            referencedRelation: "grilles_tarifaires"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          accepted_at: string | null
          atelier_id: string
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          invited_by: string | null
          role: string
          status: string | null
          token: string | null
        }
        Insert: {
          accepted_at?: string | null
          atelier_id: string
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          role?: string
          status?: string | null
          token?: string | null
        }
        Update: {
          accepted_at?: string | null
          atelier_id?: string
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          role?: string
          status?: string | null
          token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
        ]
      }
      types_defauts: {
        Row: {
          action_corrective: string | null
          atelier_id: string
          code: string
          created_at: string | null
          description: string | null
          gravite: string | null
          id: string
          is_active: boolean | null
          nom: string
        }
        Insert: {
          action_corrective?: string | null
          atelier_id: string
          code: string
          created_at?: string | null
          description?: string | null
          gravite?: string | null
          id?: string
          is_active?: boolean | null
          nom: string
        }
        Update: {
          action_corrective?: string | null
          atelier_id?: string
          code?: string
          created_at?: string | null
          description?: string | null
          gravite?: string | null
          id?: string
          is_active?: boolean | null
          nom?: string
        }
        Relationships: [
          {
            foreignKeyName: "types_defauts_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          atelier_id: string
          backup_codes: Json | null
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
          backup_codes?: Json | null
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
          backup_codes?: Json | null
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
      v_charge_travail: {
        Row: {
          atelier_id: string | null
          date_prevue: string | null
          nb_projets: number | null
          surface_totale_m2: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projets_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
        ]
      }
      v_devis_stats: {
        Row: {
          annee: number | null
          atelier_id: string | null
          delai_moyen_signature_jours: number | null
          devis_acceptes: number | null
          devis_en_attente: number | null
          devis_expires: number | null
          devis_refuses: number | null
          mois: number | null
          montant_accepte_ht: number | null
          montant_total_ht: number | null
          taux_conversion: number | null
          total_devis: number | null
        }
        Relationships: [
          {
            foreignKeyName: "devis_atelier_id_fkey"
            columns: ["atelier_id"]
            isOneToOne: false
            referencedRelation: "ateliers"
            referencedColumns: ["id"]
          },
        ]
      }
      v_rentabilite_projets: {
        Row: {
          atelier_id: string | null
          client_id: string | null
          client_name: string | null
          cout_reel_total: number | null
          created_at: string | null
          marge_brute: number | null
          marge_pourcent: number | null
          montant_devis_ht: number | null
          montant_devis_ttc: number | null
          name: string | null
          numero: string | null
          projet_id: string | null
          status: string | null
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
        ]
      }
    }
    Functions: {
      calculate_nc_rate: {
        Args: { p_atelier_id: string; p_end_date: string; p_start_date: string }
        Returns: {
          projets_avec_nc: number
          taux_nc: number
          total_projets: number
          total_retouches: number
        }[]
      }
      check_rate_limit: {
        Args: {
          p_key: string
          p_max_attempts: number
          p_window_seconds: number
        }
        Returns: Json
      }
      cleanup_rate_limits: { Args: never; Returns: number }
      client_has_portal_account: {
        Args: { p_client_id: string }
        Returns: boolean
      }
      create_default_devis_templates: {
        Args: { p_atelier_id: string }
        Returns: undefined
      }
      decrement_poudre_stock: {
        Args: { p_poudre_id: string; p_quantite: number }
        Returns: {
          stock_apres: number
          stock_avant: number
        }[]
      }
      generate_avoir_numero: { Args: { p_atelier_id: string }; Returns: string }
      generate_bl_numero: { Args: { p_atelier_id: string }; Returns: string }
      generate_facture_numero: {
        Args: { p_atelier_id: string }
        Returns: string
      }
      generate_projet_numero: {
        Args: { p_atelier_id: string }
        Returns: string
      }
      get_main_nc_causes: {
        Args: {
          p_atelier_id: string
          p_end_date: string
          p_limit?: number
          p_start_date: string
        }
        Returns: {
          count: number
          defaut_name: string
          defaut_type_id: string
          percentage: number
        }[]
      }
      get_projets_ready_for_avis: {
        Args: { p_atelier_id: string; p_delay_days?: number }
        Returns: {
          client_email: string
          client_id: string
          date_livre: string
          projet_id: string
          projet_name: string
          projet_numero: string
        }[]
      }
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
