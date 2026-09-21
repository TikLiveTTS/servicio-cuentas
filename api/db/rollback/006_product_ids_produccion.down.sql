-- Revierte 006 (deja 'pro' sin id y 'sin-promos' con el de 005).
UPDATE plans SET polar_product_id = NULL WHERE id = 'pro';
UPDATE plans SET polar_product_id = '2c9408fe-1199-40d0-9beb-79382b3aab20' WHERE id = 'sin-promos';
