-- 003_precio_pro.sql — completa el precio real del plan Pro (US$85/año,
-- 8500 centavos). 002_seed_planes.sql lo dejó en 0 como placeholder.

UPDATE plans SET precio_anual_centavos = 8500 WHERE id = 'pro';
