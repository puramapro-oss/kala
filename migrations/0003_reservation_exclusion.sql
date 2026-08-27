-- 0003_reservation_exclusion.sql — PASHU EX-045 anti-chevauchement DB
-- Appliquée par: docker exec -i supabase-db psql -U supabase_admin -d postgres
-- JAMAIS psql -h localhost -p 5432 (pooler Supavisor — PIEGES §2)

-- btree_gist requis pour contrainte exclusion (btree + GiST timestamp range).
-- Extension installée dans schéma extensions (pas public), cf PIEGES §2.
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

-- Contrainte EXCLUDE garantit zéro chevauchement pour un prestataire_id donné,
-- sur réservations confirmées/en_cours (draft/annulées exclues du scope).
-- SPEC.md §4.3 interdit explicitement le SELECT applicatif seul (race condition).
-- PASHU = moule d'or → cette contrainte sera héritée par 12 marketplace (ANNA→KALA).
ALTER TABLE purama_marketplace.reservations
  ADD CONSTRAINT reservations_prestataire_no_overlap
  EXCLUDE USING gist (
    prestataire_id WITH =,
    tstzrange(debut_le, fin_le) WITH &&
  )
  WHERE (statut IN ('confirmee', 'en_cours'));
