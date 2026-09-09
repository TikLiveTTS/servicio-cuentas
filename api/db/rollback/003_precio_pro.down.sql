-- Revierte 003_precio_pro.sql.
UPDATE plans SET precio_anual_centavos = 0 WHERE id = 'pro';
