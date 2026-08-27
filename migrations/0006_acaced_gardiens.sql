-- 0006_acaced_gardiens.sql — ACACED des gardiens (NIYAMA-BRIEF.md §3, piège nommé PASHU)
-- Appliquée par: docker exec -i supabase-db psql -U supabase_admin -d postgres
--
-- L'Attestation de Connaissances relatives aux Animaux Domestiques (ACACED, arrêté du
-- 3 avril 2014, art. L214-6-1 Code rural) est une obligation légale française pour toute
-- personne qui garde des animaux domestiques à titre commercial — donc pour tout gardien
-- PASHU. CONFORMITE.md 2026-08-23 (gap #1, CRITIQUE) constate 0 occurrence dans le code :
-- ni collectée à la candidature, ni vérifiée par l'admin, ni affichée sur le profil public.
--
-- acaced_numero / acaced_date_delivrance : auto-déclarés par le candidat dans /devenir-gardien
-- (même statut que titre/presentation/commune — donnée saisie par l'utilisateur, pas encore
-- une preuve). acaced_verifie / acaced_verifie_le : écrits uniquement par la vérification admin
-- (/admin/verifications), même mécanique que identite_verifiee_le/entretien_video_le — c'est
-- CETTE paire qui constitue la preuve "vérifiée" exigée par le piège NIYAMA §3.

ALTER TABLE purama_marketplace.prestataires
  ADD COLUMN IF NOT EXISTS acaced_numero         text,
  ADD COLUMN IF NOT EXISTS acaced_date_delivrance date,
  ADD COLUMN IF NOT EXISTS acaced_verifie         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS acaced_verifie_le      timestamptz;

-- Le badge public "Vérifié PURAMA" (EX-015/EX-016) doit désormais couvrir l'ACACED en plus de
-- l'identité et de l'entretien vidéo — sinon le badge affiché mentirait par omission sur une
-- obligation légale réelle. CHECK ne peut pas être ALTERé en place : DROP puis ADD.
ALTER TABLE purama_marketplace.prestataires DROP CONSTRAINT IF EXISTS badge_coherent;
ALTER TABLE purama_marketplace.prestataires ADD CONSTRAINT badge_coherent CHECK (
  badge_verifie = false
  OR (statut_verification = 'verifie'
      AND identite_verifiee_le IS NOT NULL
      AND entretien_video_le  IS NOT NULL
      AND acaced_verifie = true)
);

-- Privilège colonne (cf 0002_marketplace_rls.sql L15-19, EX-020/EX-079) : acaced_numero et
-- acaced_date_delivrance sont saisis par le candidat lui-même, même catégorie que
-- titre/presentation/commune. acaced_verifie/acaced_verifie_le NE SONT PAS accordés ici —
-- même catégorie que badge_verifie/identite_verifiee_le/entretien_video_le (déjà exclus du
-- GRANT ci-dessous), écriture réservée à la vérification admin.
GRANT UPDATE (acaced_numero, acaced_date_delivrance)
  ON purama_marketplace.prestataires TO authenticated;
