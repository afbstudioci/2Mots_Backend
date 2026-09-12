// src/sockets/duelState.js
// GESTIONNAIRE D'ETAT EN MEMOIRE DES DUELS 1V1
// Standard : Bank Grade (Strict <= 270 lignes, Sans Emojis)

const roomPresences = new Map(); // duelId -> Set of userIds
const buzzerTimeouts = new Map(); // duelId -> Timeout
const disconnectTimers = new Map(); // `${duelId}_${userId}` -> Timeout
const lobbyTimers = new Map(); // duelId -> { timer, expiresAt }
const socketDuelMap = new Map(); // socket.id -> { duelId, userId }

module.exports = {
  roomPresences,
  buzzerTimeouts,
  disconnectTimers,
  lobbyTimers,
  socketDuelMap,
};
