/**
 * Mentions légales — KALA
 * EX-106 : contenu réel adapté marketplace de cours de musique et de loisirs à domicile.
 *
 * NIYAMA (2026-08-23) : contenu spécifique conservé tel quel (clauses marketplace propres à
 * KALA non couvertes par le socle générique `@purama/legal`) — seules 2 adresses obsolètes
 * ont été corrigées après vérification en direct (PIEGES.md §16) : Vercel a déménagé (ancienne
 * adresse Walnut, CA), et l'hébergeur DB réel est Hostinger (Paris), pas Hetzner (jamais
 * configuré pour cette app — confirmé par lookup IP de `POSTGRES_HOST`).
 */

import { COMPANY_INFO, APP_NAME, APP_DOMAIN } from '@/lib/constants';

export const metadata = {
  title: `Mentions légales · ${APP_NAME}`,
  description: 'Mentions légales de KALA, marketplace de cours de musique et de loisirs à domicile.',
};

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-background py-12">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-8">
          {/* inline-flex min-h-11 (B28-4, passage 29) : même correctif que cgu/page.tsx. */}
          <a href="/" className="inline-flex min-h-11 items-center text-sm text-primary-on-dark hover:underline">
            ← Retour à l'accueil
          </a>
        </div>

        <h1 className="text-4xl font-bold mb-4">Mentions Légales</h1>
        <p className="text-muted-foreground mb-8">Conformément à la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l'économie numérique</p>

        <div className="max-w-[65ch] space-y-6 text-foreground">
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">1. Éditeur du site</h2>
            <p>
              Le site <strong>{APP_DOMAIN}</strong> est édité par :
            </p>
            <p>
              <strong>{COMPANY_INFO.nom}</strong> ({COMPANY_INFO.forme_juridique})<br />
              Adresse : {COMPANY_INFO.adresse}, {COMPANY_INFO.code_postal} {COMPANY_INFO.commune}, {COMPANY_INFO.pays}<br />
              {COMPANY_INFO.siret ? (
                <>SIRET : {COMPANY_INFO.siret}<br /></>
              ) : (
                <>SIRET en cours d'attribution<br /></>
              )}
              {COMPANY_INFO.mention_tva}<br />
              Email de contact : <a href="mailto:hello@purama.dev" className="text-primary-on-dark underline">hello@purama.dev</a>
            </p>
            <p>
              Directeur de la publication : Matiss Dornier
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">2. Hébergement</h2>
            <p>
              Le site {APP_DOMAIN} est hébergé par :
            </p>
            <p>
              <strong>Vercel Inc.</strong><br />
              440 N Barranca Avenue #4133<br />
              Covina, CA 91723<br />
              États-Unis<br />
              Site web : <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-primary-on-dark underline">vercel.com</a>
            </p>
            <p>
              Les données utilisateur sont hébergées sur un serveur dédié situé en Union européenne :
            </p>
            <p>
              <strong>Hostinger International Ltd</strong><br />
              Serveur physique : Paris, France (conformité RGPD européenne)<br />
              Site web : <a href="https://www.hostinger.fr" target="_blank" rel="noopener noreferrer" className="text-primary-on-dark underline">hostinger.fr</a>
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">3. Propriété intellectuelle</h2>
            <p>
              L'ensemble du contenu de ce site (structure, textes, logos, graphismes, images, logiciels) est
              la propriété exclusive de {COMPANY_INFO.nom}, sauf mentions contraires.
            </p>
            <p>
              Toute reproduction, distribution, modification, adaptation, retransmission ou publication de ces
              différents éléments est strictement interdite sans l'accord écrit de {COMPANY_INFO.nom}.
            </p>
            <p>
              Le nom « {APP_NAME} » ainsi que le logo sont des marques de {COMPANY_INFO.nom}.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">4. Protection des données personnelles</h2>
            <p>
              Conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi Informatique et Libertés,
              vous disposez d'un droit d'accès, de rectification, de suppression et de portabilité de vos données personnelles.
            </p>
            <p>
              Pour exercer ces droits, vous pouvez :
            </p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Consulter, exporter et effacer vos données depuis la page « Ma mémoire » de votre compte.</li>
              <li>Nous contacter par email à : <a href="mailto:hello@purama.dev" className="text-primary-on-dark underline">hello@purama.dev</a></li>
            </ul>
            <p>
              Pour plus de détails sur le traitement de vos données, consultez notre{' '}
              <a href="/politique-confidentialite" className="text-primary-on-dark underline">Politique de confidentialité</a>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">5. Cookies et traceurs</h2>
            <p>
              Le site {APP_DOMAIN} utilise des cookies strictement nécessaires au fonctionnement de la plateforme
              (authentification, session utilisateur). Aucun cookie publicitaire ou de suivi comportemental n'est
              déposé sans votre consentement préalable.
            </p>
            <p>
              Vous pouvez à tout moment gérer vos préférences de cookies via le bandeau de consentement ou les
              paramètres de votre navigateur.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">6. Limitation de responsabilité</h2>
            <p>
              {COMPANY_INFO.nom} s'efforce d'assurer l'exactitude et la mise à jour des informations diffusées sur
              le site {APP_DOMAIN}, mais ne peut garantir l'absence totale d'erreurs ou d'omissions.
            </p>
            <p>
              {COMPANY_INFO.nom} ne saurait être tenue responsable :
            </p>
            <ul className="list-disc ml-6 space-y-1">
              <li>De tout dommage direct ou indirect résultant de l'utilisation du site ou de l'impossibilité d'y accéder.</li>
              <li>De tout préjudice lié à l'intrusion d'un tiers ayant entraîné une modification des informations mises à disposition.</li>
              <li>Des litiges entre Clients et Profs concernant la qualité de la prestation de cours ou des dommages causés à l&apos;élève ou à ses biens.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">7. Droit applicable et juridiction compétente</h2>
            <p>
              Les présentes mentions légales sont régies par le droit français. En cas de litige, une solution amiable
              sera recherchée en priorité. À défaut d'accord, les tribunaux compétents de Besançon (25) seront seuls compétents.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">8. Médiation</h2>
            <p>
              Conformément à l'article L612-1 du Code de la consommation, le Client a le droit de recourir gratuitement
              à un médiateur de la consommation en vue de la résolution amiable d'un litige l'opposant à {COMPANY_INFO.nom}.
            </p>
            <p>
              Coordonnées du médiateur : à préciser ultérieurement.
            </p>
          </section>

          <section className="mt-12 pt-8 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Dernière mise à jour : 7 août 2026
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
