import { APP_NAME } from '@/lib/constants';

// layout.tsx dédié (B28-9, passage 28) : même raison que login/layout.tsx — page.tsx est 'use
// client', seul un Server Component peut déclarer `metadata`.
export const metadata = {
  title: `Créer un compte · ${APP_NAME}`,
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
