/**
 * Accueil KALA — Server Component (B23-6).
 * Récupère la liste des profs par défaut (Frasne, EX-003) au premier rendu serveur, pour que le
 * HTML envoyé contienne déjà du contenu réel : sans ça, un crawler, un aperçu de lien, ou un
 * visiteur dont le chunk JS n'arrive pas ne voit jamais que 5 rectangles gris (le fetch vivait
 * uniquement dans un useEffect côté client). La partie interactive (géoloc, code postal, hero) vit
 * dans HomeClient.tsx, qui reçoit cette liste comme état de départ.
 */

import HomeClient from '@/components/landing/HomeClient';
import { getProfsPublics } from '@/lib/profs-query';

export default async function HomePage() {
  // Fallback Frasne (DESIGN-PLAN §wireframe, EX-003) — même défaut que /api/profs.
  const initialProfs = await getProfsPublics({ lat: 46.85, lon: 6.16 }, 25, 5);

  return <HomeClient initialProfs={initialProfs} />;
}
