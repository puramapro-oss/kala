import { APP_NAME } from '@/lib/constants';

// layout.tsx dédié (B30-13, passage 30) : page.tsx est 'use client' (formulaire interactif), seul
// un Server Component peut déclarer `metadata` — même patron que login/layout.tsx et signup/layout.tsx.
export const metadata = {
  title: `Devenir prof · ${APP_NAME}`,
};

export default function DevenirProfLayout({ children }: { children: React.ReactNode }) {
  return children;
}
