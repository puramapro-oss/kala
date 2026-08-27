import { Syne, Work_Sans, Anonymous_Pro } from 'next/font/google';
import './globals.css';
import Header from '@/components/layout/Header';
import BottomTabBar from '@/components/layout/BottomTabBar';
import Footer from '@/components/layout/Footer';
import ServiceWorkerRegister from '@/components/shared/ServiceWorkerRegister';
import CookieBanner from '@/components/shared/CookieBanner';

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  display: 'swap',
});

const workSans = Work_Sans({
  subsets: ['latin'],
  variable: '--font-work-sans',
  display: 'swap',
});

const anonymousPro = Anonymous_Pro({
  subsets: ['latin'],
  variable: '--font-anonymous-pro',
  weight: ['400', '700'],
  display: 'swap',
});

// B22-4(c) : 0 balise og:*/twitter: sur la home — un lien partagé n'affichait aucune carte du tout.
const title = 'KALA · Cours de musique et loisirs à domicile';
const description =
  'Trouvez un prof vérifié pour vos cours de musique et de loisirs à domicile. Transparence totale, 0 % de commission prof.';

export const metadata = {
  metadataBase: new URL('https://kala.purama.dev'),
  title,
  description,
  icons: {
    icon: '/icon.svg',
  },
  openGraph: {
    title,
    description,
    type: 'website',
    images: ['/api/og'],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['/api/og'],
  },
};

export const viewport = {
  themeColor: '#1C1F26',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${syne.variable} ${workSans.variable} ${anonymousPro.variable}`}>
      <body>
        <ServiceWorkerRegister />
        {/* B25-8 (passage 25) : `<Header/>` vivait EN DEHORS de ce conteneur `min-h-screen flex-col` —
            sa hauteur s'ajoutait donc PAR-DESSUS les 100vh déjà réservés par la colonne, poussant
            structurellement CHAQUE page à `hauteur_header + 100vh`. Invisible sur les pages dont le
            contenu dépasse déjà 100vh de toute façon (accueil, fiche) ; mesurable uniquement sur une
            page courte (login/signup, carte de 500px) : 176 à 264px de défilement en trop, centrage
            visuellement asymétrique. Header déplacé À L'INTÉRIEUR de la colonne, aux côtés de `main`
            (`flex-1`) et `Footer` — le motif standard, correct par construction. */}
        <div className="flex min-h-screen flex-col">
          <Header />
          {/* flex flex-col (B25-8) : `main` doit être lui-même un conteneur flex pour qu'une page
              courte (login/signup) puisse s'y centrer verticalement via `flex-1` plutôt que via son
              propre `min-h-screen` — qui recréait le même défaut un niveau plus bas. Les pages dont le
              contenu dépasse déjà la hauteur disponible (accueil, fiche) ne changent pas de
              comportement : sans `flex-1` sur leur propre racine, elles restent dimensionnées à leur
              contenu, comme avant. */}
          <main className="flex-1 flex flex-col">{children}</main>
          <Footer />
        </div>
        <BottomTabBar />
        <CookieBanner />
      </body>
    </html>
  );
}
