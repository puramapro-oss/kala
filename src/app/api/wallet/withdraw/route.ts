/**
 * POST /api/wallet/withdraw — Retrait wallet KOSHA (EX-085, EX-086)
 * Débit atomique via fonction debit_wallet (PIEGES.md §1 race condition).
 * Refuse sous WALLET_MIN = 5€.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { createClient } from '@/lib/supabase';
import { APP_ID, WALLET_MIN } from '@/lib/constants';
import { z } from 'zod';

const WithdrawSchema = z.object({
  amount_euros: z.number().positive().min(WALLET_MIN, `Retrait minimum : ${WALLET_MIN}€`),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const supabaseService = createServiceClient();

    // Vérifie auth
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Parse body
    const body = await req.json();
    const validation = WithdrawSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || 'Montant invalide' },
        { status: 400 }
      );
    }

    const { amount_euros } = validation.data;
    const amountCents = Math.round(amount_euros * 100);

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

    // Débit atomique (EX-085: WHERE solde >= montant, 1 seule requête)
    const { data: walletId, error: debitErr } = await supabaseService.rpc('debit_wallet', {
      p_app_id: APP_ID,
      p_profil_id: profil.id,
      p_montant_cents: amountCents,
      p_categorie: 'retrait',
      p_description: `Retrait ${amount_euros.toFixed(2)}€`,
    });

    if (debitErr) {
      console.error('[wallet/withdraw] Erreur debit_wallet:', debitErr);
      return NextResponse.json({ error: 'Erreur débit wallet' }, { status: 500 });
    }

    if (!walletId) {
      // Solde insuffisant (debit_wallet retourne NULL)
      return NextResponse.json(
        { error: 'Solde insuffisant pour ce retrait' },
        { status: 400 }
      );
    }

    // Log mouvement_argent (catégorie 'retrait' pour réconciliation BK-024)
    const { error: logErr } = await supabaseService.from('mouvements_argent').insert({
      app_id: APP_ID,
      reservation_id: null, // retrait non lié à une garde
      categorie: 'retrait',
      montant_cents: -amountCents, // négatif = sortie
      stripe_id: null, // TODO V1.1: créer payout vers IBAN utilisateur si implémenté
      cree_le: new Date().toISOString(),
    });

    if (logErr) {
      console.error('[wallet/withdraw] Erreur log mouvement_argent (non bloquant):', logErr);
      // Non bloquant : le débit a réussi, le log est pour audit
    }

    console.log(`[wallet/withdraw] Retrait ${amount_euros}€ profil ${profil.id.substring(0, 8)}`);

    return NextResponse.json({
      success: true,
      amount_euros,
      message: `Retrait de ${amount_euros.toFixed(2)}€ effectué`,
    });
  } catch (err) {
    console.error('[wallet/withdraw] Exception:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
