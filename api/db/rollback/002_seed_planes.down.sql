-- Revierte 002_seed_planes.sql.
DELETE FROM plans WHERE id IN ('free','pro');
