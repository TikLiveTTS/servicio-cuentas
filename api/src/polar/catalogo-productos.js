'use strict';

const config = require('../config');

const INTERVALOS = ['month', 'year'];

// Unica tabla producto de Polar -> (plan local, intervalo). Los productos sin
// env configurada se omiten para que un product_id vacio nunca matchee.
function catalogoProductos() {
  return [
    { id: config.polarProductIdProAnual, plan: 'pro', intervalo: 'year' },
    { id: config.polarProductIdProMensual, plan: 'pro', intervalo: 'month' },
    { id: config.polarProductIdSinPromos, plan: 'sin-promos', intervalo: 'year' },
    { id: config.polarProductIdSinPromosMensual, plan: 'sin-promos', intervalo: 'month' },
  ].filter((p) => p.id);
}

module.exports = { catalogoProductos, INTERVALOS };
