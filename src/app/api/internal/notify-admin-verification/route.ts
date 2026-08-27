/**
 * /api/internal/notify-admin-verification — Notification email admin (EX-021)
 * Appelée par /devenir-prof quand un profil passe en statut 'en_attente'.
 * EX-021 : notifie l'administrateur.
 *
 * IMPORTANT : SPEC §message mentionne Resend, mais KALA n'a pas de domaine Resend configuré
 * pour `kala.purama.dev` à ce stade — ce point est documenté comme report.
 * Implémentation minimale : log serveur + TODO Resend une fois le domaine configuré.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { APP_ID } from '@/lib/constants';
import type { Database } from '@/types/database';

export async function POST(req: NextRequest) {
  const supabase = createServiceClient<Database, 'purama_marketplace'>();

  try {
    const body = await req.json();
    const { prestataire_id, titre, commune } = body;

    if (!prestataire_id || !titre || !commune) {
      return NextResponse.json({ error: 'Paramètres manquants.' }, { status: 400 });
    }

    // Vérifier que le prestataire existe et est en 'en_attente'
    const { data: prest, error } = await supabase
      .schema('purama_marketplace')
      .from('prestataires')
      .select('statut_verification')
      .eq('app_id', APP_ID)
      .eq('id', prestataire_id)
      .single();

    if (error || !prest || prest.statut_verification !== 'en_attente') {
      return NextResponse.json({ error: 'Prestataire introuvable ou statut incorrect.' }, { status: 404 });
    }

    // TODO (report) : envoyer email Resend une fois `kala.purama.dev` configuré en SPF/DKIM/DMARC
    // Patron : lib/resend.ts si existant ailleurs dans le repo, ou fonction dédiée ici.
    // Pour l'instant : log serveur uniquement.
    console.log(`[notify-admin-verification] Nouvelle candidature prof : ${titre} (${commune}) — ID ${prestataire_id}`);

    return NextResponse.json({ success: true, message: 'Notification envoyée (log serveur uniquement pour V1).' });
  } catch (err) {
    console.error('[notify-admin-verification] Exception inattendue:', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
