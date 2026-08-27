/**
 * /api/og — OG image dynamique (EX-026)
 * Génère une image depuis identity_seed (terre/mousse/creme/corbeau/alerte).
 * Utilisé par /prof/[id] et autres pages clés.
 */

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { APP_ID } from '@/lib/constants';

export const runtime = 'edge';

// B22-4 : `ImageResponse` ne charge aucune police par défaut — sans l'option `fonts`, tout texte
// retombe sur la sans-serif système du moteur de rendu, quel que soit le `fontFamily` demandé en CSS.
// Récupère le binaire réel de la police depuis Google Fonts (technique documentée next/og), avec
// `text` pour ne charger que les glyphes réellement utilisés.
async function loadGoogleFont(font: string, text: string) {
  const url = `https://fonts.googleapis.com/css2?family=${font}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(url)).text();
  const match = css.match(/src: url\(([^)]+)\) format\('(?:opentype|truetype)'\)/);
  if (match) {
    const res = await fetch(match[1]);
    if (res.status === 200) return res.arrayBuffer();
  }
  throw new Error('Échec du chargement de la police pour /api/og');
}

function FormeOnde() {
  const c = '#F5F0E6';
  const barres = [38, 60, 84, 60, 38];
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: 96, height: 96 }}>
      {barres.map((h, i) => (
        <div
          key={i}
          style={{
            width: 12,
            height: h,
            borderRadius: 6,
            background: c,
            opacity: i === 4 ? 0.6 : 1,
          }}
        />
      ))}
    </div>
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const type = searchParams.get('type') || 'default';
  const id = searchParams.get('id') || '';

  const terre = '#8B6F47';
  const mousse = '#4A6741';
  const creme = '#F5F0E6';

  let titre = 'KALA';
  let sousTitre = 'Cours de musique et loisirs à domicile';

  if (type === 'prof' && id) {
    const supabase = createServiceClient<unknown, 'purama_marketplace'>();
    const { data: prest } = await supabase
      .schema('purama_marketplace')
      .from('prestataires')
      .select('profil_id, commune, note_moyenne')
      .eq('app_id', APP_ID)
      .eq('id', id)
      .single();

    if (prest) {
      const { data: profil } = await supabase
        .schema('purama_marketplace')
        .from('profils')
        .select('affichage_nom')
        .eq('app_id', APP_ID)
        .eq('id', prest.profil_id)
        .single();

      const prenom = profil?.affichage_nom || 'Prof';
      const note = prest.note_moyenne
        ? parseFloat(String(prest.note_moyenne)).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
        : null;
      titre = prenom;
      sousTitre = note ? `Prof vérifié · ${note} · ${prest.commune}` : `Prof vérifié · ${prest.commune}`;
    } else {
      titre = 'Prof vérifié KALA';
      sousTitre = 'Profil de confiance';
    }
  }

  const fraunces = await loadGoogleFont('Fraunces:wght@700', titre);
  const inter = await loadGoogleFont('Inter:wght@400', sousTitre);

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(135deg, ${mousse} 0%, ${terre} 100%)`,
          color: creme,
          padding: '60px',
        }}
      >
        <FormeOnde />
        <div
          style={{
            fontSize: '72px',
            fontFamily: 'Fraunces',
            fontWeight: 700,
            marginTop: '32px',
            marginBottom: '20px',
            textAlign: 'center',
          }}
        >
          {titre}
        </div>
        <div
          style={{
            fontSize: '36px',
            fontFamily: 'Inter',
            fontWeight: 400,
            textAlign: 'center',
            opacity: 0.9,
          }}
        >
          {sousTitre}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Fraunces', data: fraunces, style: 'normal', weight: 700 },
        { name: 'Inter', data: inter, style: 'normal', weight: 400 },
      ],
    }
  );
}
