'use strict';

// Canal en tiempo real propio entre este backend y la app de Electron. La
// app se conecta con su token de sesion; cuando llega un webhook de
// Twitch/Kick (ver routes/webhook-twitch.js, webhook-kick.js) se reenvia
// solo a la conexion del usuario dueno de ese canal. No se guarda nada de
// esto en la base de datos -- es pasamanos en vivo, se pierde si el proceso
// se reinicia (la app reconecta sola).

const { WebSocketServer } = require('ws');
const { validarSesion } = require('../queries/validar-sesion');

const conexionesPorUsuario = new Map(); // userId -> Set<ws>

function agregarConexion(userId, ws) {
  if (!conexionesPorUsuario.has(userId)) conexionesPorUsuario.set(userId, new Set());
  conexionesPorUsuario.get(userId).add(ws);
}

function quitarConexion(userId, ws) {
  const set = conexionesPorUsuario.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) conexionesPorUsuario.delete(userId);
}

// Si el usuario no tiene la app abierta en este momento, no pasa nada --
// el evento simplemente no se reenvia a ningun lado (no se guarda para despues).
function enviarEventoAUsuario(userId, evento) {
  const set = conexionesPorUsuario.get(userId);
  if (!set) return;
  const mensaje = JSON.stringify(evento);
  for (const ws of set) {
    if (ws.readyState === ws.OPEN) ws.send(mensaje);
  }
}

// token por query string (?token=...), no por header: es lo que soporta
// cualquier cliente WebSocket sin vueltas, incluido el que use Electron.
function iniciarServidorRealtime(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token') || '';
    const sesion = token ? await validarSesion(token) : null;
    if (!sesion) {
      ws.close(4001, 'sesion invalida');
      return;
    }

    agregarConexion(sesion.user_id, ws);
    ws.on('close', () => quitarConexion(sesion.user_id, ws));
    ws.on('error', () => quitarConexion(sesion.user_id, ws));
  });

  return wss;
}

module.exports = { iniciarServidorRealtime, enviarEventoAUsuario };
