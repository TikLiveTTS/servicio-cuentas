'use strict';

const { catalogoProductos } = require('./catalogo-productos');

// '' si el producto de ese plan+intervalo no esta configurado.
function resolverProductoId(plan, intervalo) {
  const producto = catalogoProductos().find((p) => p.plan === plan && p.intervalo === intervalo);
  return producto ? producto.id : '';
}

module.exports = { resolverProductoId };
