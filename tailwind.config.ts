import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'selector',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      screens: {
        // B20-2 : le breakpoint `md` (768px) ne regarde que la LARGEUR — un téléphone en paysage
        // (ex. 844×390) le franchit et hérite du profil d'espacement desktop (py-16, space-y-6,
        // ratio 7/6) alors que sa HAUTEUR reste minuscule. `short:` cible la hauteur réelle,
        // indépendamment de la largeur, pour resserrer le héros quand la place verticale manque.
        short: { raw: '(max-height: 500px) and (orientation: landscape)' },
        // B21-5 : `short` exige le paysage — un reflow WCAG 1.4.10 à 400% (320×256, mais aussi
        // 320×400 en PORTRAIT) reste hors de sa portée. `xshort` ne regarde que la hauteur, pour
        // compacter en-tête/barre d'achat/barre d'onglets quelle que soit l'orientation.
        xshort: { raw: '(max-height: 420px)' },
        // B22-1 (CRITIQUE) : 8 passages (D-067, B14-1, B15-1, B19-1, B20-2, B21-4) ont réglé le
        // budget vertical du héros en ne faisant varier QUE la largeur, toujours à une hauteur de
        // viewport de 812/780px. Sur les téléphones portrait les plus courts encore en circulation
        // (iPhone SE 667px, Android d'entrée de gamme 640px, iPhone SE 1re gén. 568px), rien dans le
        // héros ne réagissait à la hauteur — le CTA finissait jusqu'à 209px sous la barre d'onglets,
        // visible EN FANTÔME à travers elle (cf. B22-2) plutôt que simplement hors écran. `orientation:
        // portrait` explicite : ne doit JAMAIS chevaucher `short` (paysage) pour ne pas retoucher un
        // tuning déjà validé sur 4 formats paysage (B20-2).
        shortp: { raw: '(max-height: 700px) and (orientation: portrait)' },
      },
      colors: {
        // Identity_seed KALA (noms littéraux, DESIGN-PLAN §1)
        laiton: '#C9A227',
        applaudissement: '#E5484D',
        portee: '#E9E6DE',
        pupitre: '#1C1F26',
        feutre: '#4A4E57',
        alerte: '#F06A6E', // applaudissement éclairci — seul rouge texte-AA de la palette
        // Tokens sémantiques mappés sur variables CSS (dialecte unique).
        // background/background-soft/primary/primary-on-dark/accent-light passent par un triplet
        // RGB (--x-rgb dans globals.css) pour que les utilitaires d'opacité Tailwind (`bg-x/NN`)
        // compilent en CSS valide (B18-9) — `var(--x)` seul ne peut pas être blend-opacity par Tailwind.
        background: 'rgb(var(--background-rgb) / <alpha-value>)',
        'background-soft': 'rgb(var(--background-soft-rgb) / <alpha-value>)',
        foreground: 'var(--foreground)',
        'foreground-muted': 'var(--foreground-muted)',
        'muted-foreground': 'var(--foreground-muted)', // alias pour les 22 usages existants
        primary: 'rgb(var(--primary-rgb) / <alpha-value>)',
        'primary-on-dark': 'rgb(var(--primary-on-dark-rgb) / <alpha-value>)', // laiton pour texte/bordure/fond bouton sur fond sombre (WCAG AA)
        // B24-3 : secondary (applaudissement) rejoint le dialecte triplet RGB — un `bg-secondary/NN`
        // sur `var(--secondary)` seul aurait reproduit B18-9 (opacité silencieusement ignorée).
        secondary: 'rgb(var(--secondary-rgb) / <alpha-value>)',
        'secondary-on-dark': 'rgb(var(--secondary-on-dark-rgb) / <alpha-value>)', // applaudissement éclairci pour texte/bordure sur fond sombre (WCAG AA)
        'accent-light': 'rgb(var(--accent-light-rgb) / <alpha-value>)',
        'accent-dark': 'var(--accent-dark)',
        alert: 'var(--alert)',
        card: 'var(--card)',
        border: 'var(--border)',
        // B26-13 : `--glass-border` existait dans globals.css (utilisé en dur par `.glass`) mais
        // n'était jamais enregistré ici — `border-glass-border`/`bg-glass-border` ne généraient
        // aucun CSS, laissant les champs login/signup retomber sur le gris par défaut de Tailwind
        // (rgb(229,231,235)) au lieu de la bordure de marque.
        'glass-border': 'var(--glass-border)',
        'primary-foreground': '#1C1F26', // laiton est CLAIR : le texte sur primary est pupitre, pas blanc
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        pill: 'var(--radius-pill)',
      },
      fontFamily: {
        display: ['var(--font-syne)', 'sans-serif'],
        body: ['var(--font-work-sans)', 'sans-serif'],
        mono: ['var(--font-anonymous-pro)', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
