-- Revierte 007_intervalo_suscripcion.sql.
ALTER TABLE subscriptions DROP COLUMN siguiente_intervalo, DROP COLUMN intervalo;
