import { APP_NAME } from '@/lib/constants';

// layout.tsx dédié (B28-9, passage 28) : page.tsx est 'use client' (formulaire interactif),
// `export const metadata` n'y fonctionne pas — seul un Server Component peut le déclarer. Ce
// layout ne fait rien d'autre que porter le <title>, `page.tsx` partageait sinon celui générique
// de la home.
export const metadata = {
  title: `Connexion · ${APP_NAME}`,
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
