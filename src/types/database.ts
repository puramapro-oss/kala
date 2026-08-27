/**
 * database.ts — Types MANUELS depuis le schéma Postgres réel `purama_marketplace` (VPS 2026-08-07).
 * Généré manuellement d'après `\d purama_marketplace.*` — sync avec PROOF-P0-DB.md.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  purama_marketplace: {
    Tables: {
      apps: {
        Row: {
          app_id: string;
          nom: string;
          actif: boolean;
          cree_le: string;
        };
        Insert: Omit<Database['purama_marketplace']['Tables']['apps']['Row'], 'cree_le'>;
        Update: Partial<Database['purama_marketplace']['Tables']['apps']['Insert']>;
        Relationships: [];
      };
      profils: {
        Row: {
          id: string;
          app_id: string;
          user_id: string;
          affichage_nom: string;
          avatar_url: string | null;
          commune: string | null;
          telephone: string | null;
          est_demo: boolean;
          cree_le: string;
          maj_le: string;
        };
        Insert: Omit<Database['purama_marketplace']['Tables']['profils']['Row'], 'id' | 'cree_le' | 'maj_le'>;
        Update: Partial<Database['purama_marketplace']['Tables']['profils']['Insert']>;
        Relationships: [];
      };
      prestataires: {
        Row: {
          id: string;
          app_id: string;
          profil_id: string;
          titre: string;
          presentation: string;
          commune: string;
          code_postal: string;
          latitude: number;
          longitude: number;
          rayon_km: number;
          adresse_exacte: string | null;
          video_30s_url: string | null;
          statut_verification: Database['purama_marketplace']['Enums']['statut_verification'];
          badge_verifie: boolean;
          identite_verifiee_le: string | null;
          entretien_video_le: string | null;
          acaced_numero: string | null;
          acaced_date_delivrance: string | null;
          acaced_verifie: boolean;
          acaced_verifie_le: string | null;
          karma_score: number;
          note_moyenne: number | null;
          nb_avis: number;
          nb_gardes_terminees: number;
          stripe_account_id: string | null;
          payouts_actifs: boolean;
          est_demo: boolean;
          cree_le: string;
          maj_le: string;
        };
        Insert: Omit<Database['purama_marketplace']['Tables']['prestataires']['Row'], 'id' | 'cree_le' | 'maj_le'>;
        Update: Partial<Database['purama_marketplace']['Tables']['prestataires']['Insert']>;
        Relationships: [];
      };
      prestations: {
        Row: {
          id: string;
          app_id: string;
          prestataire_id: string;
          type_garde: Database['purama_marketplace']['Enums']['type_garde'];
          prix_cents: number;
          actif: boolean;
          est_demo: boolean;
          cree_le: string;
        };
        Insert: Omit<Database['purama_marketplace']['Tables']['prestations']['Row'], 'id' | 'cree_le'>;
        Update: Partial<Database['purama_marketplace']['Tables']['prestations']['Insert']>;
        Relationships: [];
      };
      reservations: {
        Row: {
          id: string;
          app_id: string;
          client_profil_id: string;
          prestataire_id: string;
          type_garde: Database['purama_marketplace']['Enums']['type_garde'];
          debut_le: string;
          fin_le: string;
          tarif_cents: number;
          frais_service_cents: number;
          statut: Database['purama_marketplace']['Enums']['statut_reservation'];
          recurrence: string;
          serie_id: string | null;
          payment_intent_id: string | null;
          transfer_id: string | null;
          payout_id: string | null;
          eleve_mineur: boolean;
          compte_parent_id: string | null;
          cree_le: string;
          maj_le: string;
        };
        Insert: Omit<Database['purama_marketplace']['Tables']['reservations']['Row'], 'id' | 'cree_le' | 'maj_le'>;
        Update: Partial<Database['purama_marketplace']['Tables']['reservations']['Insert']>;
        Relationships: [];
      };
      enregistrements: {
        Row: {
          id: string;
          app_id: string;
          reservation_id: string;
          url: string;
          duree_s: number;
          prive: boolean;
          cree_le: string;
        };
        Insert: Omit<Database['purama_marketplace']['Tables']['enregistrements']['Row'], 'id' | 'cree_le'>;
        Update: Partial<Database['purama_marketplace']['Tables']['enregistrements']['Insert']>;
        Relationships: [];
      };
      animaux: {
        Row: {
          id: string;
          app_id: string;
          profil_id: string;
          nom: string;
          espece: string;
          race: string | null;
          age_annees: number | null;
          poids_kg: number | null;
          photo_url: string | null;
          caractere: string | null;
          allergies: string | null;
          medicaments: string | null;
          veterinaire_nom: string | null;
          veterinaire_telephone: string | null;
          habitudes: string | null;
          est_demo: boolean;
          cree_le: string;
          maj_le: string;
        };
        Insert: Omit<Database['purama_marketplace']['Tables']['animaux']['Row'], 'id' | 'cree_le' | 'maj_le'>;
        Update: Partial<Database['purama_marketplace']['Tables']['animaux']['Insert']>;
        Relationships: [];
      };
      reservation_animaux: {
        Row: {
          reservation_id: string;
          animal_id: string;
        };
        Insert: Database['purama_marketplace']['Tables']['reservation_animaux']['Row'];
        Update: Partial<Database['purama_marketplace']['Tables']['reservation_animaux']['Row']>;
        Relationships: [];
      };
      avis: {
        Row: {
          id: string;
          app_id: string;
          reservation_id: string;
          prestataire_id: string;
          auteur_profil_id: string;
          note: number;
          commentaire: string | null;
          verifie: boolean;
          cree_le: string;
        };
        Insert: Omit<Database['purama_marketplace']['Tables']['avis']['Row'], 'id' | 'cree_le'>;
        Update: Partial<Database['purama_marketplace']['Tables']['avis']['Insert']>;
        Relationships: [];
      };
      // B4/schéma réel vs colonnes fantômes (passage 29) : Row corrigé sur le schéma DÉPLOYÉ
      // (migrations/0001_marketplace_core.sql:160-179), pas sur les noms de colonnes historiques
      // du code applicatif (type_entree, contenu_texte, photo_url, coords_gps_*, trace_gps,
      // distance_km, duree_minutes, horodatage n'existent pas en base → PostgREST 400).
      journal_garde: {
        Row: {
          id: string;
          app_id: string;
          reservation_id: string;
          auteur_profil_id: string;
          type: Database['purama_marketplace']['Enums']['type_entree_journal'];
          message: string | null;
          photo_path: string | null;
          trace_points: Json | null;
          trace_interrompue: boolean;
          distance_m: number | null;
          duree_s: number | null;
          survenu_le: string;
          cree_le: string;
        };
        Insert: Omit<Database['purama_marketplace']['Tables']['journal_garde']['Row'], 'id' | 'cree_le'>;
        Update: Partial<Database['purama_marketplace']['Tables']['journal_garde']['Insert']>;
        Relationships: [];
      };
      mouvements_argent: {
        Row: {
          id: string;
          app_id: string;
          reservation_id: string | null;
          profil_id: string | null;
          categorie: string;
          montant_cents: number;
          devise: string;
          metadata: Json | null;
          stripe_event_id: string | null;
          cree_le: string;
        };
        Insert: Omit<Database['purama_marketplace']['Tables']['mouvements_argent']['Row'], 'id' | 'cree_le'>;
        Update: Partial<Database['purama_marketplace']['Tables']['mouvements_argent']['Insert']>;
        Relationships: [];
      };
      stripe_events: {
        Row: {
          id: string;
          app_id: string;
          event_id: string;
          type_event: string;
          traite_le: string | null;
          erreur: string | null;
          cree_le: string;
        };
        Insert: Omit<Database['purama_marketplace']['Tables']['stripe_events']['Row'], 'id' | 'cree_le'>;
        Update: Partial<Database['purama_marketplace']['Tables']['stripe_events']['Insert']>;
        Relationships: [];
      };
      wallets: {
        Row: {
          id: string;
          app_id: string;
          profil_id: string;
          solde_cents: number;
          maj_le: string;
        };
        Insert: Omit<Database['purama_marketplace']['Tables']['wallets']['Row'], 'id' | 'maj_le'>;
        Update: Partial<Database['purama_marketplace']['Tables']['wallets']['Insert']>;
        Relationships: [];
      };
      wallet_mouvements: {
        Row: {
          id: string;
          app_id: string;
          wallet_id: string;
          profil_id: string;
          montant_cents: number;
          categorie: string;
          reservation_id: string | null;
          cree_le: string;
          disponible_le: string | null;
          description: string | null;
        };
        Insert: Omit<Database['purama_marketplace']['Tables']['wallet_mouvements']['Row'], 'id' | 'cree_le'>;
        Update: Partial<Database['purama_marketplace']['Tables']['wallet_mouvements']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_app_id: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      mon_profil_id: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      credit_wallet: {
        Args: {
          p_app_id: string;
          p_profil_id: string;
          p_montant_cents: number;
          p_categorie: string;
          p_reservation_id?: string | null;
          p_description?: string | null;
        };
        Returns: string; // wallet_id
      };
      debit_wallet: {
        Args: {
          p_app_id: string;
          p_profil_id: string;
          p_montant_cents: number;
          p_categorie: string;
          p_description?: string | null;
        };
        Returns: string | null; // wallet_id si succès, NULL si solde insuffisant
      };
    };
    Enums: {
      type_garde: 'domicile' | 'visite' | 'promenade';
      statut_verification: 'brouillon' | 'en_attente' | 'verifie' | 'refuse';
      statut_reservation: 'confirmee' | 'en_cours' | 'terminee' | 'annulee' | 'litige';
      type_entree_journal: 'photo' | 'promenade' | 'repas' | 'note';
      recurrence: 'aucune' | 'hebdomadaire';
    };
    CompositeTypes: Record<string, never>;
  };
}
