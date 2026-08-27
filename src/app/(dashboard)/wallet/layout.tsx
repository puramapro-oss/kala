import type { Metadata } from 'next';
import { APP_NAME } from '@/lib/constants';

// <title> dédié (B32-6) : la page est un composant client — le titre vit dans ce layout,
// même patron que cours/[id]/timeline/layout.tsx. Séparateur « · » commun aux 16 pages (B32-7).
export const metadata: Metadata = {
  title: `Wallet KOSHA · ${APP_NAME}`,
  description: 'Votre cagnotte écosystème PURAMA : cashback KARMA, primes et retraits.',
};

export default function WalletLayout({ children }: { children: React.ReactNode }) {
  return children;
}
