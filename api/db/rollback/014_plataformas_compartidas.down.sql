-- Revierte 014_plataformas_compartidas.sql.
-- OJO: si ya hay un mismo canal vinculado a mas de un user_id, el ADD
-- CONSTRAINT falla; hay que desvincular los duplicados a mano antes.

DROP INDEX IF EXISTS plataformas_vinculadas_canal_idx;

ALTER TABLE plataformas_vinculadas
  ADD CONSTRAINT plataformas_vinculadas_plataforma_plataforma_user_id_key
  UNIQUE (plataforma, plataforma_user_id);
