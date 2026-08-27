'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { WALLET_MIN } from '@/lib/constants';

interface WalletState {
  balanceEuros: number;
  loading: boolean;
  error: string | null;
  canWithdraw: boolean;
}

export function useWallet(userId: string | null | undefined) {
  const [state, setState] = useState<WalletState>({
    balanceEuros: 0,
    loading: true,
    error: null,
    canWithdraw: false,
  });
  const _supabase = createClient();

  useEffect(() => {
    if (!userId) {
      setState({ balanceEuros: 0, loading: false, error: null, canWithdraw: false });
      return;
    }

    // Charge le solde depuis l'API wallet KOSHA (le wallet est partagé écosystème)
    fetch(`/api/wallet/balance?user_id=${userId}`)
      .then((res) => res.json())
      .then((data) => {
        const balance = data.balance_euros ?? 0;
        setState({
          balanceEuros: balance,
          loading: false,
          error: null,
          canWithdraw: balance >= WALLET_MIN,
        });
      })
      .catch((err) => {
        setState({
          balanceEuros: 0,
          loading: false,
          error: err.message || 'Erreur wallet',
          canWithdraw: false,
        });
      });
  }, [userId]);

  const withdraw = async (amountEuros: number): Promise<boolean> => {
    if (amountEuros < WALLET_MIN) {
      setState((s) => ({
        ...s,
        error: `Retrait minimum : ${WALLET_MIN}€`,
      }));
      return false;
    }

    try {
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_euros: amountEuros }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || 'Échec retrait');
      }

      // Met à jour l'état local après succès
      setState((s) => ({
        balanceEuros: s.balanceEuros - amountEuros,
        loading: false,
        error: null,
        canWithdraw: s.balanceEuros - amountEuros >= WALLET_MIN,
      }));

      return true;
    } catch (err) {
      setState((s) => ({ ...s, error: err instanceof Error ? err.message : 'Erreur retrait' }));
      return false;
    }
  };

  return {
    ...state,
    withdraw,
  };
}
