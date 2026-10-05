'use strict';

const { suscripcionesPolarVigentes } = require('../queries/suscripciones-polar-vigentes');
const { revocarSuscripcion } = require('../polar/revocar-suscripcion');
const { cancelarSuscripcion } = require('../polar/cancelar-suscripcion');
const { eliminarCliente } = require('../polar/eliminar-cliente');
const { eliminarUsuario } = require('../queries/eliminar-usuario');

// Orden (decidido para no dejar la cuenta a medias):
//  1. Revocar en Polar cada suscripcion vigente. OBLIGATORIO: si falla, lanza y
//     NO se borra nada (el usuario reintenta; si borraramos igual, Polar seguiria
//     cobrando a alguien sin cuenta).
//     Caso 409 SubscriptionLocked (cambio pendiente, ej. anual -> mensual de
//     change-interval): Polar no deja revocar. NO se aborta: se cae a cancelar al
//     final del periodo (PATCH cancel_at_period_end=true), que evita renovacion y
//     cobro; se loguea. Si ese PATCH tambien falla, ahi si se aborta.
//  2. Borrar el customer en Polar (datos personales). Best-effort: con las
//     suscripciones ya revocadas (o canceladas al fin del periodo, sin
//     renovacion) no hay cobro pendiente, asi que un fallo solo se
//     loguea y no bloquea el derecho a borrar la cuenta.
//  3. Borrar el usuario local (cascade) — lo unico irreversible va al final.
async function eliminarCuenta(userId) {
  for (const polarSubscriptionId of await suscripcionesPolarVigentes(userId)) {
    await revocarOFallar(polarSubscriptionId);
  }
  await borrarClienteEnPolarSinBloquear(userId);
  await eliminarUsuario(userId);
}

// Marca el fallo de Polar con code 'polar_no_disponible' para que la ruta lo
// distinga de un error de base de datos. 'polar_no_configurado' pasa tal cual.
async function revocarOFallar(polarSubscriptionId) {
  try {
    await revocarOCancelarAlFinDelPeriodo(polarSubscriptionId);
  } catch (err) {
    if (!err.code) err.code = 'polar_no_disponible';
    throw err;
  }
}

async function revocarOCancelarAlFinDelPeriodo(polarSubscriptionId) {
  try {
    await revocarSuscripcion(polarSubscriptionId);
  } catch (err) {
    if (err.status !== 409) throw err;
    console.warn(`[account] suscripcion ${polarSubscriptionId} bloqueada por cambio pendiente (409); se cancela al fin del periodo`);
    await cancelarAlFinDelPeriodo(polarSubscriptionId);
  }
}

// 403 = ya estaba cancelada/revocada: el objetivo (que no renueve) ya se cumple.
async function cancelarAlFinDelPeriodo(polarSubscriptionId) {
  try {
    await cancelarSuscripcion(polarSubscriptionId);
  } catch (err) {
    if (err.status !== 403) throw err;
  }
}

async function borrarClienteEnPolarSinBloquear(userId) {
  try {
    await eliminarCliente(userId);
  } catch (err) {
    console.error(`[account] no se pudo borrar el customer de Polar (user ${userId}): ${err.status || err.code || err.name}`);
  }
}

module.exports = { eliminarCuenta };
