/**
 * CGU — Conditions Générales d'Utilisation KALA
 * EX-106 : contenu réel adapté marketplace de cours de musique et de loisirs à domicile.
 *
 * NIYAMA (2026-08-23) : contenu spécifique conservé tel quel (clauses marketplace propres à
 * KALA non couvertes par le socle générique `@purama/legal`) — seule la référence à l'exercice
 * des droits RGPD a été mise à jour vers la nouvelle page « Ma mémoire ».
 */

import { COMPANY_INFO, APP_NAME, APP_DOMAIN } from '@/lib/constants';

export const metadata = {
  title: `CGU · ${APP_NAME}`,
  description: 'Conditions générales d\'utilisation de KALA, marketplace de cours de musique et de loisirs à domicile.',
};

export default function CguPage() {
  return (
    <div className="min-h-screen bg-background py-12">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-8">
          {/* inline-flex min-h-11 (B28-4, passage 29) : boîte réelle 44px, même correctif que Footer.tsx
              — le pseudo-élément hors flux laissait la boîte mesurable à 17px. */}
          <a href="/" className="inline-flex min-h-11 items-center text-sm text-primary-on-dark hover:underline">
            ← Retour à l&apos;accueil
          </a>
        </div>

        <h1 className="text-4xl font-bold mb-4">Conditions Générales d&apos;Utilisation</h1>
        <p className="text-muted-foreground mb-8">Dernière mise à jour : 7 août 2026</p>

        {/* space-y-3 sur chaque <section> (B28-8, passage 28) : les <p> consécutifs à l'intérieur
            d'une section n'avaient aucun espacement propre — seul `space-y-6` sur ce conteneur
            séparait les SECTIONS entre elles, laissant les paragraphes d'une même section collés
            (0px d'écart, 11 paires sur cette page). */}
        <div className="max-w-[65ch] space-y-6 text-foreground">
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">1. Objet du service</h2>
            <p>
              {APP_NAME} est une plateforme numérique éditée par {COMPANY_INFO.nom} ({COMPANY_INFO.forme_juridique}),
              permettant la mise en relation entre élèves — ou leurs parents pour les mineurs (« Clients ») et
              profs indépendants (« Profs ») pour des cours de musique et de loisirs, à domicile ou chez le prof.
            </p>
            <p>
              {COMPANY_INFO.nom} agit en qualité d&apos;intermédiaire technique et financier. La relation contractuelle
              de cours s&apos;établit directement entre le Client et le Prof.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">2. Inscription et compte utilisateur</h2>
            <p>
              L&apos;inscription à {APP_NAME} est gratuite et ouverte à toute personne majeure. Chaque utilisateur
              garantit l&apos;exactitude des informations fournies lors de l&apos;inscription et s&apos;engage à les maintenir à jour.
            </p>
            <p>
              Les identifiants de connexion sont personnels et confidentiels. L&apos;utilisateur est seul responsable
              de leur utilisation.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">3. Obligations du Client</h2>
            <p>Le Client s&apos;engage à :</p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Fournir des informations complètes et exactes sur l&apos;élève (instrument ou discipline, niveau, objectif, contraintes du domicile).</li>
              <li>Informer le Prof de tout besoin particulier de l&apos;élève (mineur, débutant complet, rythme souhaité).</li>
              <li>Respecter les modalités de réservation et d&apos;annulation définies aux présentes.</li>
              <li>Régler le prix convenu via la plateforme avant le début du cours.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">4. Obligations et responsabilités du Prof</h2>
            <p>Le Prof s&apos;engage à :</p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Dispenser le cours avec pédagogie, ponctualité et bienveillance.</li>
              <li>Respecter le niveau et les objectifs communiqués par le Client via le profil de l&apos;élève.</li>
              <li>Maintenir la timeline du cours (photos, notes) pour rassurer l&apos;élève ou son parent.</li>
              <li>Ne présenter que des références exactes (diplômes, expérience), contrôlées par {APP_NAME} lors de la vérification prof.</li>
            </ul>
            <p>
              Le Prof déclare exercer cette activité en tant que prof indépendant, dans la limite du cadre légal
              applicable. Il est responsable de tout dommage causé à l&apos;élève ou à des tiers pendant la durée
              du cours.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">5. Tarification et paiement</h2>
            <p>
              Le Prof fixe librement son tarif horaire ou journalier, affiché sur son profil.
              <strong> Le Prof perçoit 100 % de son tarif affiché.</strong>
            </p>
            <p>
              {COMPANY_INFO.nom} applique <strong>9 % de frais de service</strong> au Client, calculés sur le tarif du Prof.
              Le montant total débité au Client est donc : <code>tarif prof + 9 % frais de service</code>.
            </p>
            <p>
              Les fonds sont conservés en séquestre sur le compte plateforme Stripe. Le versement au Prof
              intervient automatiquement à la fin du cours, dans un délai de 60 secondes après passage de
              la réservation au statut « terminée ».
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">6. Annulation et remboursement</h2>
            <p>
              <strong>Annulation par le Client :</strong>
            </p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Plus de 48 heures avant le début du cours : remboursement intégral (tarif + frais de service).</li>
              <li>Moins de 48 heures avant le début du cours : 50 % du tarif du prof est versé au Prof à titre d&apos;indemnisation,
              les frais de service sont remboursés au Client.</li>
            </ul>
            <p>
              <strong>Annulation par le Prof :</strong> en cas d&apos;annulation tardive par le Prof sans motif légitime,
              le Client est intégralement remboursé et {COMPANY_INFO.nom} se réserve le droit de suspendre le compte du Prof.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">7. Droit de rétractation</h2>
            <p>
              Conformément à l&apos;article L221-28 3° du Code de la consommation, le Client renonce expressément à son
              droit de rétractation de 14 jours en validant sa réservation et son paiement. Cette renonciation est
              implicite et ne nécessite aucune case à cocher.
            </p>
            <p>
              La prestation de cours étant à exécution immédiate ou à date déterminée, le délai de rétractation
              légal ne peut s&apos;appliquer.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">8. Protection des données personnelles</h2>
            <p>
              Conformément au RGPD, les données collectées sont traitées par {COMPANY_INFO.nom} dans le cadre
              de la fourniture du service. L&apos;utilisateur dispose d&apos;un droit d&apos;accès, de rectification et de
              suppression de ses données, exerçable depuis la page « Ma mémoire » du compte ou par email à
              {' '}<a href="mailto:hello@purama.dev" className="text-primary-on-dark underline">hello@purama.dev</a>.
            </p>
            <p>
              Consultez notre <a href="/politique-confidentialite" className="text-primary-on-dark underline">Politique de confidentialité</a> pour
              plus de détails.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">9. Responsabilité de la plateforme</h2>
            <p>
              {COMPANY_INFO.nom} met en œuvre les moyens techniques nécessaires au bon fonctionnement de la plateforme,
              mais ne peut garantir une disponibilité absolue. {COMPANY_INFO.nom} n&apos;est pas partie au contrat de cours
              entre le Client et le Prof et n&apos;intervient qu&apos;en qualité d&apos;intermédiaire.
            </p>
            <p>
              En cas de litige entre un Client et un Prof, {COMPANY_INFO.nom} se réserve le droit de proposer
              une médiation amiable, mais ne saurait être tenue responsable des dommages directs ou indirects liés
              à la prestation de cours elle-même.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">10. Modification des CGU</h2>
            <p>
              {COMPANY_INFO.nom} se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs
              seront informés par email ou notification dans l&apos;application. L&apos;utilisation continue de la plateforme
              après modification vaut acceptation des nouvelles CGU.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">11. Droit applicable et litiges</h2>
            <p>
              Les présentes CGU sont soumises au droit français. En cas de litige, une solution amiable sera
              recherchée en priorité. À défaut, les tribunaux compétents de Besançon (25) seront seuls compétents.
            </p>
          </section>

          <section className="mt-12 pt-8 border-t border-border">
            <h3 className="text-lg font-semibold mb-2">Éditeur du service</h3>
            <p>
              {COMPANY_INFO.nom} ({COMPANY_INFO.forme_juridique})<br />
              {COMPANY_INFO.adresse}, {COMPANY_INFO.code_postal} {COMPANY_INFO.commune}, {COMPANY_INFO.pays}<br />
              {COMPANY_INFO.siret ? `SIRET : ${COMPANY_INFO.siret}` : 'SIRET en cours d\'attribution'}<br />
              {COMPANY_INFO.mention_tva}<br />
              Site web : <a href={`https://${APP_DOMAIN}`} className="text-primary-on-dark underline">{APP_DOMAIN}</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
