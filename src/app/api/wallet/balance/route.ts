/**
 * GET /api/wallet/balance — Solde wallet KOSHA client (EX-086)
 * Lecture depuis table wallets via RLS (profil voit SON solde uniquement).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { APP_ID } from '@/lib/constants';

export async function GET() {
  try {
    const supabase = createClient();

    // Vérifie auth
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Lecture profil_id
    const { data: profil, error: profilErr } = await supabase
      .from('profils')
      .select('id')
      .eq('app_id', APP_ID)
      .eq('user_id', user.id)
      .maybeSingle();

    if (profilErr || !profil) {
      return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });
    }

    // Lecture wallet (RLS filtre app_id + profil_id automatiquement)
    const { data: wallet, error: walletErr } = await supabase
      .from('wallets')
      .select('solde_cents, maj_le')
      .eq('app_id', APP_ID)
      .eq('profil_id', profil.id)
      .maybeSingle();

    if (walletErr) {
      console.error('[wallet/balance] Erreur lecture wallet:', walletErr);
      return NextResponse.json({ error: 'Erreur lecture wallet' }, { status: 500 });
    }

    // Si wallet n'existe pas encore (jamais crédité), retourner solde 0
    const soldeCents = wallet?.solde_cents ?? 0;

    return NextResponse.json({
      balance_euros: soldeCents / 100,
      balance_cents: soldeCents,
      last_updated: wallet?.maj_le || null,
    });
  } catch (err) {
    console.error('[wallet/balance] Exception:', err);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
