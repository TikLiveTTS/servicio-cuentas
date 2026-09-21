-- 006_product_ids_produccion.sql — apunta los planes a los productos de Polar
-- REAL (organizacion tiklivetts). Reemplaza el id de sandbox de 005 y completa
-- el de 'pro' (NULL desde 002). El codigo resuelve por env
-- (POLAR_PRODUCT_ID_*), esta columna es documental.

UPDATE plans SET polar_product_id = '11e9dfe6-6b0a-4682-b4de-b2606d66fef0' WHERE id = 'pro';
UPDATE plans SET polar_product_id = 'e1d5cdce-7f7e-4681-b161-3f409807d85c' WHERE id = 'sin-promos';
