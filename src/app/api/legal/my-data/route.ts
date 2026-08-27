/**
 * GET /api/legal/my-data — export complet des données personnelles au format JSON
 * (droit à la portabilité, art. 20 RGPD ; page « Ma mémoire »). RÉELLEMENT lit les tables,
 * jamais un stub `{success:true}` (cf PIEGES.md "export/RGPD absent malgré CLAUDE.md").
 *
 * ADAPTÉ pour KALA (schéma partagé `purama_marketplace`, PIEGES.md §16) : la table de profil
 * s'appelle `profils` (pas `profiles`) et la donnée personnelle réelle de cette app (élèves,
 * réservations, avis, journal de cours, wallet) est reliée par `profil_id`, jamais directement
 * par `user_id` — impossible de couvrir ça avec le simple gabarit `EXTRA_TABLES{table,userIdColumn}`
 * du socle générique, chaque table est donc requêtée explicitement ci-dessous.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { APP_ID } from '@/lib/constants';

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });

  const [{ data: profil }, { data: acceptances }, { data: cookieConsent }] = await Promise.all([
    supabase.from('profils').select('*').eq('app_id', APP_ID).eq('user_id', user.id).maybeSingle(),
    supabase.from('legal_acceptances').select('doc_type, version, accepted_at').eq('app_id', APP_ID).eq('user_id', user.id),
    supabase.from('cookie_consents').select('*').eq('app_id', APP_ID).eq('user_id', user.id).maybeSingle(),
  ]);

  let animaux: unknown[] = [];
  let reservationsClient: unknown[] = [];
  let avis: unknown[] = [];
  let journalGarde: unknown[] = [];
  let wallet: unknown = null;
  let walletMouvements: unknown[] = [];
  let prestataire: unknown = null;
  let reservationsProf: unknown[] = [];

  if (profil) {
    const [
      { data: animauxData },
      { data: reservationsClientData },
      { data: avisData },
      { data: journalGardeData },
      { data: walletData },
      { data: walletMouvementsData },
      { data: prestataireData },
    ] = await Promise.all([
      supabase.from('animaux').select('*').eq('app_id', APP_ID).eq('profil_id', profil.id),
      supabase.from('reservations').select('*').eq('app_id', APP_ID).eq('client_profil_id', profil.id),
      supabase.from('avis').select('*').eq('app_id', APP_ID).eq('auteur_profil_id', profil.id),
      supabase.from('journal_garde').select('*').eq('app_id', APP_ID).eq('auteur_profil_id', profil.id),
      supabase.from('wallets').select('*').eq('app_id', APP_ID).eq('profil_id', profil.id).maybeSingle(),
      supabase.from('wallet_mouvements').select('*').eq('app_id', APP_ID).eq('profil_id', profil.id),
      supabase.from('prestataires').select('*').eq('app_id', APP_ID).eq('profil_id', profil.id).maybeSingle(),
    ]);

    animaux = animauxData ?? [];
    reservationsClient = reservationsClientData ?? [];
    avis = avisData ?? [];
    journalGarde = journalGardeData ?? [];
    wallet = walletData ?? null;
    walletMouvements = walletMouvementsData ?? [];
    prestataire = prestataireData ?? null;

    if (prestataire && typeof prestataire === 'object' && 'id' in prestataire) {
      const { data: reservationsProfData } = await supabase
        .from('reservations')
        .select('*')
        .eq('app_id', APP_ID)
        .eq('prestataire_id', (prestataire as { id: string }).id);
      reservationsProf = reservationsProfData ?? [];
    }
  }

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    compte: { id: user.id, email: user.email, createdAt: user.created_at },
    profil: profil ?? null,
    acceptationsLegales: acceptances ?? [],
    consentementCookies: cookieConsent ?? null,
    animaux,
    reservationsEnTantQueClient: reservationsClient,
    avisPublies: avis,
    journalDeGarde: journalGarde,
    profilProf: prestataire,
    reservationsEnTantQueProf: reservationsProf,
    wallet,
    walletMouvements,
  };

  return new NextResponse(JSON.stringify(exportPayload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="mes-donnees.json"',
    },
  });
}
