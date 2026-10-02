'use strict';

const { catalogoProductos } = require('./catalogo-productos');

// product_id de Polar -> 'month' | 'year' | null (producto desconocido o ausente).
function resolverIntervalo(productId) {
  const producto = catalogoProductos().find((p) => p.id === productId);
  return producto ? producto.intervalo : null;
}

module.exports = { resolverIntervalo };
