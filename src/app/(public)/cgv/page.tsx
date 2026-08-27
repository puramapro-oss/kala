/**
 * CGV — Conditions Générales de Vente KALA
 * EX-106 : contenu réel adapté marketplace de cours de musique et de loisirs à domicile.
 *
 * NIYAMA (2026-08-23) : contenu spécifique conservé tel quel — clauses de tarification/
 * annulation propres au modèle KALA, non couvertes par le socle générique `@purama/legal`
 * (qui ne peut pas les inventer, cf `buildCGV`). Aucun fait cité ici (hébergeur, adresse) ne
 * nécessitait de correction.
 */

import { COMPANY_INFO, APP_NAME, PCT_FRAIS_SERVICE, PCT_COMMISSION_PROF } from '@/lib/constants';

export const metadata = {
  title: `CGV · ${APP_NAME}`,
  description: 'Conditions générales de vente de KALA, marketplace de cours de musique et de loisirs à domicile.',
};

export default function CgvPage() {
  return (
    <div className="min-h-screen bg-background py-12">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-8">
          {/* inline-flex min-h-11 (B28-4, passage 29) : même correctif que cgu/page.tsx. */}
          <a href="/" className="inline-flex min-h-11 items-center text-sm text-primary-on-dark hover:underline">
            ← Retour à l'accueil
          </a>
        </div>

        <h1 className="text-4xl font-bold mb-4">Conditions Générales de Vente</h1>
        <p className="text-muted-foreground mb-8">Dernière mise à jour : 7 août 2026</p>

        <div className="max-w-[65ch] space-y-6 text-foreground">
          {/* space-y-3 (B28-8, passage 28) : même correctif que cgu/page.tsx — les <p> consécutifs
              d'une même section n'avaient aucun espacement propre. */}
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">1. Objet</h2>
            <p>
              Les présentes Conditions Générales de Vente (CGV) régissent les transactions financières effectuées
              via la plateforme {APP_NAME}, éditée par {COMPANY_INFO.nom} ({COMPANY_INFO.forme_juridique}).
            </p>
            <p>
              {COMPANY_INFO.nom} met en relation des Clients (élèves, ou leurs parents pour les mineurs) et des Profs
              (profs indépendants proposant des cours de musique et de loisirs). {COMPANY_INFO.nom} agit en qualité
              d&apos;intermédiaire de paiement et de séquestre, mais n&apos;est pas partie au contrat de cours.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">2. Prix et tarification</h2>
            <p>
              <strong>Le Prof fixe librement son tarif horaire ou journalier, affiché sur son profil.</strong>
            </p>
            <p>
              <strong>Le Prof perçoit 100 % de son tarif affiché.</strong> Si un Prof affiche 25 €, il reçoit 25 €.
            </p>
            <p>
              {COMPANY_INFO.nom} applique <strong>{PCT_FRAIS_SERVICE} % de frais de service</strong> au Client,
              calculés sur le tarif du Prof et arrondis au centime le plus proche (arrondi standard).
            </p>
            <p>
              <strong>Exemple :</strong> Pour un cours affiché à 100 €, le Client paie 100 € + 9 € de frais de service = 109 €.
              Le Prof reçoit 100 € (soit {100 - PCT_COMMISSION_PROF} % de son tarif).
            </p>
            <p>
              Tous les prix sont exprimés en euros (EUR), toutes taxes comprises (TTC). Conformément à l'article 293 B
              du Code général des impôts, {COMPANY_INFO.nom} bénéficie de la franchise en base de TVA et ne facture
              donc pas de TVA.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">3. Modalités de paiement</h2>
            <p>
              Le paiement est effectué intégralement par le Client au moment de la réservation, via carte bancaire
              (Stripe). Aucun paiement en espèces ou par virement direct au Prof n'est autorisé dans le cadre de
              la plateforme.
            </p>
            <p>
              Les fonds sont conservés en séquestre sur le compte plateforme Stripe jusqu'à la fin du cours.
              Le versement au Prof intervient automatiquement dans un délai de 60 secondes après passage de la
              réservation au statut « terminée ».
            </p>
            <p>
              Le Client reçoit un reçu de paiement par email à l'issue de la transaction, comportant les coordonnées
              de {COMPANY_INFO.nom} et la mention de franchise de TVA.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">4. Droit de rétractation</h2>
            <p>
              Conformément à l'article L221-28 3° du Code de la consommation, le Client renonce expressément à son
              droit de rétractation de 14 jours en validant sa réservation et son paiement.
            </p>
            <p>
              <strong>Cette renonciation est implicite et ne nécessite aucune case à cocher.</strong> La prestation
              de cours étant à exécution immédiate ou à date déterminée, le délai de rétractation légal ne peut s'appliquer.
            </p>
            <p>
              En cliquant sur le bouton « Payer », le Client accepte que la prestation commence avant la fin du délai
              de rétractation et renonce ainsi à ce droit.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">5. Annulation et remboursement</h2>
            <p>
              <strong>Annulation par le Client :</strong>
            </p>
            <ul className="list-disc ml-6 space-y-1">
              <li>
                <strong>Plus de 48 heures avant le début du cours :</strong> remboursement intégral (tarif prof + frais de service).
              </li>
              <li>
                <strong>Moins de 48 heures avant le début du cours :</strong> 50 % du tarif du prof est versé au Prof
                à titre d'indemnisation pour la réservation tardive manquée. Les frais de service sont intégralement remboursés au Client.
              </li>
            </ul>
            <p>
              <strong>Annulation par le Prof :</strong> en cas d'annulation tardive par le Prof sans motif légitime
              (maladie, force majeure), le Client est intégralement remboursé (tarif + frais de service) et {COMPANY_INFO.nom}
              se réserve le droit de suspendre le compte du Prof.
            </p>
            <p>
              Les remboursements sont effectués sous 5 à 10 jours ouvrés sur le moyen de paiement utilisé lors de la réservation.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">6. Facturation et TVA</h2>
            <p>
              {COMPANY_INFO.nom} ({COMPANY_INFO.forme_juridique}) bénéficie de la franchise en base de TVA prévue à
              l'article 293 B du Code général des impôts. Aucune TVA n'est facturée sur les frais de service.
            </p>
            <p>
              Un reçu de paiement est automatiquement généré et envoyé au Client par email après chaque transaction.
              Ce reçu comporte la mention : <strong>« {COMPANY_INFO.mention_tva} »</strong>.
            </p>
            <p>
              Le Prof, exerçant à titre indépendant, établit ses propres factures dans le cadre légal qui lui
              est applicable. Le versement effectué par {COMPANY_INFO.nom} au Prof constitue un transfert de fonds
              au titre de la prestation de cours réalisée.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">7. Responsabilité</h2>
            <p>
              {COMPANY_INFO.nom} n'est pas partie au contrat de cours entre le Client et le Prof. La responsabilité
              de {COMPANY_INFO.nom} se limite à la fourniture de la plateforme technique et à l'intermédiation financière.
            </p>
            <p>
              En cas de litige entre un Client et un Prof concernant la qualité de la prestation ou un dommage
              causé à l&apos;élève ou à des tiers, {COMPANY_INFO.nom} pourra proposer une médiation amiable, mais ne saurait
              être tenue responsable des conséquences directes ou indirectes du cours.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">8. Modification des CGV</h2>
            <p>
              {COMPANY_INFO.nom} se réserve le droit de modifier les présentes CGV à tout moment. Les utilisateurs
              seront informés par email ou notification dans l'application. L'utilisation continue de la plateforme
              après modification vaut acceptation des nouvelles CGV.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">9. Droit applicable et litiges</h2>
            <p>
              Les présentes CGV sont soumises au droit français. En cas de litige, une solution amiable sera
              recherchée en priorité. À défaut, les tribunaux compétents de Besançon (25) seront seuls compétents.
            </p>
          </section>

          <section className="mt-12 pt-8 border-t border-border">
            <h3 className="text-lg font-semibold mb-2">Éditeur du service</h3>
            <p>
              {COMPANY_INFO.nom} ({COMPANY_INFO.forme_juridique})<br />
              {COMPANY_INFO.adresse}, {COMPANY_INFO.code_postal} {COMPANY_INFO.commune}, {COMPANY_INFO.pays}<br />
              {COMPANY_INFO.siret ? `SIRET : ${COMPANY_INFO.siret}` : 'SIRET en cours d\'attribution'}<br />
              {COMPANY_INFO.mention_tva}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
