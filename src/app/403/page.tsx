/**
 * /403 — Accès interdit (EX-023 : utilisé par /admin/verifications)
 * <title> dédié + phrase dans le ton du produit (B32-7, passage 32) : seule page avec un
 * <title> générique et une formulation administrative sur un produit qui parle par ailleurs
 * de musique (404 : « Cette note s'est tue avant d'arriver ici »).
 */

import type { Metadata } from 'next';
import { APP_NAME } from '@/lib/constants';

export const metadata: Metadata = {
  title: `Accès interdit · ${APP_NAME}`,
};

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="max-w-md text-center">
        <h1 className="mb-4 text-6xl font-bold text-alerte">403</h1>
        <h2 className="mb-2 text-2xl font-semibold">Accès interdit</h2>
        <p className="mb-6 text-muted-foreground">
          Cette page est réservée à d&apos;autres mains que la vôtre.
        </p>
        <a
          href="/"
          className="inline-block rounded-lg bg-primary-on-dark px-6 py-3 font-semibold text-[#1C1F26] transition hover:bg-primary-on-dark/90"
        >
          Retour à l'accueil
        </a>
      </div>
    </div>
  );
}
