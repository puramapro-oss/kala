import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'KALA — Cours de musique et loisirs à domicile',
    short_name: 'KALA',
    description:
      'Trouvez un prof vérifié pour vos cours de musique et de loisirs à domicile. Transparence totale, 0 % de commission prof.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0f',
    theme_color: '#0a0a0f',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
