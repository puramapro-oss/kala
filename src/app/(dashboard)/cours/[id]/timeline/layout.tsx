import { APP_NAME } from '@/lib/constants';

// layout.tsx dédié (B30-13, passage 30) : page.tsx est 'use client' (état interactif), seul un
// Server Component peut déclarer `metadata` — même patron que login/layout.tsx et signup/layout.tsx.
// La page partageait sinon le <title> générique de la home.
export const metadata = {
  title: `Timeline du cours · ${APP_NAME}`,
};

export default function TimelineCoursLayout({ children }: { children: React.ReactNode }) {
  return children;
}
