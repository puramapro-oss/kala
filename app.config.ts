/**
 * Types inlineés du Moule d'Or (`_templates/marketplace/app.config.ts`) :
 * import cross-répertoire impossible sur Vercel (root build = kala/, le sibling
 * monorepo n'existe pas) — TS2307. Copie verbatim, ne pas laisser diverger.
 */

export interface TypographyPair {
  /** Police d'affichage — porte la personnalité de l'app (VEGA-2 §9.1) */
  display: string;
  /** Police de corps de texte, lisible, discrète */
  body: string;
  /** Police utilitaire chiffres/labels (souvent monospace ou tabular-nums) */
  utility: string;
}

export interface IdentitySeed {
  /** 4 à 6 couleurs NOMMÉES (jamais "primary/secondary" générique) */
  colors: Record<string, string>;
  typography: TypographyPair;
  /** Description courte de la forme de la signature visuelle unique de l'app (VEGA-2 §9.1) */
  signatureShape: string;
  /** L'élément le plus caractéristique du monde de l'app, affiché en hero (jamais "gros chiffre + dégradé") */
  heroThesis: string;
}

export interface EcranMetier {
  route: string;
  titre: string;
  /** V1-CORE ou V1.1-BACKLOG (PILIER 21) */
  vague: 'V1-CORE' | 'V1.1-BACKLOG';
}

export interface ChampSpecifique {
  entite: string;
  nom: string;
  type: 'texte' | 'nombre' | 'date' | 'booleen' | 'enum' | 'photo' | 'geo';
  requis: boolean;
  /** Pour type enum */
  valeurs?: string[];
}

export interface TextesLegaux {
  cguRef: string;
  cgvRef: string;
  mentionsRef: string;
  politiqueConfidentialiteRef: string;
}

export interface AppConfig {
  slug: string;
  nom: string;
  identitySeed: IdentitySeed;
  categorieMetier: string;
  /** Frais de service côté client (le prestataire garde 100% de son tarif — modèle Vinted) */
  pctFraisService: number;
  champsSpecifiques: ChampSpecifique[];
  ecransMetier: EcranMetier[];
  textesLegaux: TextesLegaux;
  /** Agrément Services à la Personne — crédit d'impôt 50% (si applicable au métier) */
  agrementSap: boolean;
}

export const kalaConfig: AppConfig = {
  slug: 'kala',
  nom: 'KALA',
  identitySeed: {
    colors: {
      pupitre: '#1C1F26',
      laiton: '#C9A227',
      feutre: '#4A4E57',
      portee: '#E9E6DE',
      applaudissement: '#E5484D',
    },
    typography: {
      display: 'Syne',
      body: 'Work Sans',
      utility: 'Anonymous Pro',
    },
    signatureShape: 'forme d\'onde de 30s (avant/après)',
    heroThesis: 'on choisit son prof en l\'entendant jouer, pas en lisant sa bio',
  },
  categorieMetier: 'cours-musique-domicile',
  pctFraisService: 9,
  champsSpecifiques: [
    { entite: 'prof', nom: 'video_30s_url', type: 'texte', requis: true },
    { entite: 'eleve', nom: 'mineur', type: 'booleen', requis: true },
    { entite: 'enregistrement', nom: 'prive', type: 'booleen', requis: true },
  ],
  ecransMetier: [
    { route: '/profs', titre: 'Découverte vidéos', vague: 'V1-CORE' },
    { route: '/prof/[id]', titre: 'Profil prof', vague: 'V1-CORE' },
    { route: '/mes-cours', titre: 'Réservation récurrence', vague: 'V1-CORE' },
    { route: '/timeline', titre: 'Timeline privée', vague: 'V1-CORE' },
    { route: '/cours-partages', titre: 'Cours partagés', vague: 'V1.1-BACKLOG' },
  ],
  textesLegaux: {
    cguRef: '@purama/legal/cgu/kala',
    cgvRef: '@purama/legal/cgv/kala',
    mentionsRef: '@purama/legal/mentions/kala',
    politiqueConfidentialiteRef: '@purama/legal/rgpd/kala',
  },
  agrementSap: true,
};
