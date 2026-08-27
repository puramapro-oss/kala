/**
 * /api/profs — Liste des profs vérifiés, accessible SANS session.
 * Logique de requête partagée avec le premier rendu SSR de la home (B23-6) : voir
 * `src/lib/profs-query.ts`.
 */

import { getProfsPublics } from '@/lib/profs-query';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get('lat');
  const lon = req.nextUrl.searchParams.get('lon');
  const rayon = parseInt(req.nextUrl.searchParams.get('rayon') || '25', 10);
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '5', 10);

  // Fallback Frasne (DESIGN-PLAN §wireframe, EX-003)
  const coords = {
    lat: lat ? parseFloat(lat) : 46.85,
    lon: lon ? parseFloat(lon) : 6.16,
  };

  try {
    const profs = await getProfsPublics(coords, rayon, limit);
    return NextResponse.json({ profs });
  } catch (err) {
    console.error('[/api/profs] Exception inattendue:', err);
    const message = err instanceof Error ? err.message : 'Une erreur interne est survenue.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
