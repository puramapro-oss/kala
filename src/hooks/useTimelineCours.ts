'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Table partagée purama_marketplace.journal_garde (schéma marketplace commun, nom immuable)
type EntreeTimeline = Database['purama_marketplace']['Tables']['journal_garde']['Row'];
type TypeEntree = Database['purama_marketplace']['Enums']['type_entree_journal'];

export function useTimelineCours(reservationId: string | null) {
  const [entries, setEntries] = useState<EntreeTimeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!reservationId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    let channel: RealtimeChannel | null = null;

    // Charge l'historique initial
    const loadEntries = async () => {
      // B4/schéma réel vs colonnes fantômes (passage 29) : `horodatage` n'existe pas dans
      // purama_marketplace.journal_garde, la vraie colonne est `survenu_le` (PostgREST 400 sinon).
      const { data, error: fetchError } = await supabase
        .from('journal_garde')
        .select('*')
        .eq('reservation_id', reservationId)
        .order('survenu_le', { ascending: true });

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      setEntries(data ?? []);
      setLoading(false);
    };

    loadEntries();

    // Écoute Realtime pour les nouvelles entrées
    channel = supabase
      .channel(`journal_garde:${reservationId}`)
      .on<EntreeTimeline>(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'purama_marketplace',
          table: 'journal_garde',
          filter: `reservation_id=eq.${reservationId}`,
        },
        (payload) => {
          setEntries((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [reservationId, supabase]);

  const addEntry = async (params: {
    typeEntree: TypeEntree;
    contenuTexte?: string;
    photoUrl?: string;
  }): Promise<boolean> => {
    if (!reservationId) {
      setError('Aucune réservation sélectionnée');
      return false;
    }

    try {
      const res = await fetch('/api/enregistrements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservation_id: reservationId,
          ...params,
        }),
      });

      if (!res.ok) {
        const { error: errMsg } = await res.json();
        throw new Error(errMsg || 'Échec ajout entrée timeline');
      }

      // L'entrée apparaîtra via Realtime, pas besoin de rafraîchir manuellement
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur ajout timeline';
      setError(message);
      return false;
    }
  };

  return {
    entries,
    loading,
    error,
    addEntry,
  };
}
