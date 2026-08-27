'use client';

import { useState } from 'react';
import type { Database } from '@/types/database';

type Reservation = Database['purama_marketplace']['Tables']['reservations']['Row'];
type TypeGarde = Database['purama_marketplace']['Enums']['type_garde'];
type StatutReservation = Database['purama_marketplace']['Enums']['statut_reservation'];

interface CreateReservationParams {
  prestataireId: string;
  typeGarde: TypeGarde;
  debutLe: string; // ISO8601 timestamp
  finLe: string;
  tarifCents: number;
}

export function useReservation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createReservation = async (params: CreateReservationParams): Promise<Reservation | null> => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        const { error: errMsg } = await res.json();
        throw new Error(errMsg || 'Échec création réservation');
      }

      const { reservation } = await res.json();
      setLoading(false);
      return reservation;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur création réservation';
      setError(message);
      setLoading(false);
      return null;
    }
  };

  const updateStatut = async (
    reservationId: string,
    newStatut: StatutReservation
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/reservations/${reservationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: newStatut }),
      });

      if (!res.ok) {
        const { error: errMsg } = await res.json();
        throw new Error(errMsg || 'Échec mise à jour statut');
      }

      setLoading(false);
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur mise à jour statut';
      setError(message);
      setLoading(false);
      return false;
    }
  };

  const cancelReservation = async (reservationId: string): Promise<boolean> => {
    return updateStatut(reservationId, 'annulee');
  };

  return {
    loading,
    error,
    createReservation,
    updateStatut,
    cancelReservation,
  };
}
