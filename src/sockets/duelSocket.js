// src/sockets/duelSocket.js
// GESTIONNAIRE DES CONNEXIONS ET DU LOBBY TEMPS REEL - 2MOTS
// Standard : Clean Architecture / Bank Grade (Strict <= 270 lignes, Sans Emojis)

const duelService = require('../services/duelService');
const DuelSession = require('../models/DuelSession');
const notificationService = require('../services/notificationService');
const {
  roomPresences,
  disconnectTimers,
  lobbyTimers,
  socketDuelMap,
} = require('./duelState');
const registerGameplayHandlers = require('./duelGameplay');

module.exports = (io, socket) => {
  // Enregistrement des handlers de gameplay
  registerGameplayHandlers(io, socket);

  // 1. Connexion / Entree dans la salle du duel
  socket.on('duel_join', async ({ duelId, userId }) => {
    try {
      if (!duelId || !userId) return;
      const strDuelId = String(duelId);
      const strUserId = String(userId);
      const roomName = `duel_${strDuelId}`;

      socket.join(roomName);
      socketDuelMap.set(socket.id, { duelId: strDuelId, userId: strUserId });

      // Annulation du timer de deconnexion si le joueur revient a temps
      const disconnectKey = `${strDuelId}_${strUserId}`;
      if (disconnectTimers.has(disconnectKey)) {
        clearTimeout(disconnectTimers.get(disconnectKey));
        disconnectTimers.delete(disconnectKey);
        io.to(roomName).emit('duel_player_reconnected', { userId: strUserId });
        console.log(`[SOCKET_DUEL] Joueur ${strUserId} reconnecte a temps au duel ${strDuelId}`);
      }

      if (!roomPresences.has(strDuelId)) {
        roomPresences.set(strDuelId, new Set());
      }
      roomPresences.get(strDuelId).add(strUserId);

      const duel = await DuelSession.findById(strDuelId)
        .populate('challenger opponent winner', 'login avatar level')
        .lean();

      if (!duel) return;

      const challengerId = String(duel.challenger?._id || duel.challenger);
      const opponentId = String(duel.opponent?._id || duel.opponent);
      const presenceSet = roomPresences.get(strDuelId);

      const bothReady = presenceSet.has(challengerId) && presenceSet.has(opponentId);

      // Si les deux joueurs sont presents OU si la partie est deja en cours
      if (bothReady || duel.status === 'in_progress') {
        if (lobbyTimers.has(strDuelId)) {
          const lobbyEntry = lobbyTimers.get(strDuelId);
          if (lobbyEntry?.timer) clearTimeout(lobbyEntry.timer);
          lobbyTimers.delete(strDuelId);
        }

        const updatedDuel = duel.status === 'in_progress'
          ? duel
          : await duelService.startDuelGame(strDuelId);

        const payload = {
          duelId: strDuelId,
          duel: updatedDuel,
          startedAt: updatedDuel.startedAt,
          duration: updatedDuel.duration || 60,
        };

        io.to(roomName).emit('duel_start', payload);
        console.log(`[SOCKET_DUEL] Duel ${strDuelId} demarre avec succes.`);
      } else {
        // Un seul joueur present : initialisation du timer de lobby (60s)
        if (!lobbyTimers.has(strDuelId)) {
          const expiresAt = Date.now() + 60000;
          const timer = setTimeout(async () => {
            lobbyTimers.delete(strDuelId);
            try {
              await duelService.cancelInactiveDuel(strUserId, strDuelId);
            } catch (e) {}
            io.to(roomName).emit('duel_lobby_timeout', {
              duelId: strDuelId,
              message: "L'adversaire n'a pas rejoint la salle a temps. Le duel est annule et vos Kevs sont intacts.",
            });
            roomPresences.delete(strDuelId);
          }, 60000);
          lobbyTimers.set(strDuelId, { timer, expiresAt });
        }

        const currentLobby = lobbyTimers.get(strDuelId);
        const remainingMs = currentLobby ? Math.max(0, currentLobby.expiresAt - Date.now()) : 60000;
        const waitSeconds = Math.ceil(remainingMs / 1000);

        io.to(roomName).emit('duel_waiting_opponent', {
          duelId: strDuelId,
          connectedCount: presenceSet.size,
          expiresAt: currentLobby?.expiresAt || (Date.now() + 60000),
          waitSeconds,
          duel,
        });

        // Alerte Temps Reel + Push vers le challenger si l'adversaire vient de rejoindre la salle
        if (strUserId === opponentId && !presenceSet.has(challengerId)) {
          const opponentName = duel.opponent?.login || 'Votre adversaire';
          io.to(String(challengerId)).emit('duel_match_alert', {
            duelId: strDuelId,
            opponentId: strUserId,
            opponentName,
            opponentAvatar: duel.opponent?.avatar,
            opponentLevel: duel.opponent?.level,
            betAmount: duel.betAmount || 25,
            expiresAt: currentLobby?.expiresAt || (Date.now() + 60000),
          });
        }

        // Alerte bidirectionnelle : si le challenger entre et que l'adversaire n'est pas encore la
        if (strUserId === challengerId && !presenceSet.has(opponentId)) {
          const challengerName = duel.challenger?.login || 'Votre adversaire';
          io.to(String(opponentId)).emit('duel_match_alert', {
            duelId: strDuelId,
            opponentId: strUserId,
            opponentName: challengerName,
            opponentAvatar: duel.challenger?.avatar,
            opponentLevel: duel.challenger?.level,
            betAmount: duel.betAmount || 25,
            expiresAt: currentLobby?.expiresAt || (Date.now() + 60000),
          });

          notificationService.sendNotification(
            opponentId,
            'Adversaire dans l\'arene !',
            `${challengerName} vous attend dans l'arene de duel ! Rejoignez vite la partie !`,
            'duel_accepted',
            { duelId: strDuelId, challengerName }
          ).catch(() => {});
        }
      }
    } catch (error) {
      console.error('[SOCKET_DUEL] Erreur join duel:', error.message);
      socket.emit('duel_error', { message: error.message });
    }
  });

  // 2. Annulation manuelle de l'attente en lobby
  socket.on('duel_cancel_lobby', async ({ duelId, userId }) => {
    try {
      const strDuelId = String(duelId);
      const strUserId = String(userId);
      const roomName = `duel_${strDuelId}`;

      if (lobbyTimers.has(strDuelId)) {
        const lobbyEntry = lobbyTimers.get(strDuelId);
        if (lobbyEntry?.timer) clearTimeout(lobbyEntry.timer);
        lobbyTimers.delete(strDuelId);
      }
      try {
        await duelService.cancelInactiveDuel(strUserId, strDuelId);
      } catch (e) {}

      io.to(roomName).emit('duel_lobby_cancelled', {
        duelId: strDuelId,
        cancelledBy: strUserId,
        message: "Le duel a ete annule. Vos Kevs vous ont ete restitues.",
      });
      roomPresences.delete(strDuelId);
    } catch (err) {
      console.error('[SOCKET_DUEL] Erreur cancel lobby:', err.message);
    }
  });

  // 3. Reponse a la modale d'alerte en direct
  socket.on('duel_alert_response', async ({ duelId, userId, accept }) => {
    try {
      const strDuelId = String(duelId);
      const strUserId = String(userId);
      const roomName = `duel_${strDuelId}`;

      if (!accept) {
        if (lobbyTimers.has(strDuelId)) {
          clearTimeout(lobbyTimers.get(strDuelId));
          lobbyTimers.delete(strDuelId);
        }
        try {
          await duelService.cancelInactiveDuel(strUserId, strDuelId);
        } catch (e) {}

        io.to(roomName).emit('duel_lobby_cancelled', {
          duelId: strDuelId,
          cancelledBy: strUserId,
          message: "L'adversaire est indisponible. Vos Kevs vous ont ete restitues.",
        });
        roomPresences.delete(strDuelId);
      }
    } catch (err) {
      console.error('[SOCKET_DUEL] Erreur alert response:', err.message);
    }
  });

  // 4. Deconnexion inattendue
  socket.on('disconnect', async () => {
    if (socketDuelMap.has(socket.id)) {
      const { duelId, userId } = socketDuelMap.get(socket.id);
      socketDuelMap.delete(socket.id);

      try {
        const duel = await DuelSession.findById(duelId).lean();
        if (duel && (duel.status === 'in_progress' || duel.status === 'ready')) {
          const roomName = `duel_${duelId}`;
          io.to(roomName).emit('duel_player_disconnected', {
            userId,
            graceSeconds: 15,
          });

          const disconnectKey = `${duelId}_${userId}`;
          const timer = setTimeout(async () => {
            try {
              const result = await duelService.forfeitDuel(userId, duelId);
              if (result) {
                io.to(roomName).emit('duel_forfeited', {
                  duelId,
                  forfeiterId: String(result.forfeiterId),
                  opponentId: String(result.opponentId),
                  penaltyKevs: result.penaltyKevs,
                  winnerName: result.winnerName,
                  reason: 'disconnection_timeout',
                });
                io.to(String(result.opponentId)).emit('duel_session_ended', { duelId });
                roomPresences.delete(duelId);
              }
            } catch (timeoutErr) {
              console.warn('[SOCKET_DUEL] Erreur cloture deconnexion:', timeoutErr.message);
            } finally {
              disconnectTimers.delete(disconnectKey);
            }
          }, 15000);

          disconnectTimers.set(disconnectKey, timer);
        }
      } catch (discErr) {
        console.error('[SOCKET_DUEL] Erreur gestion disconnect:', discErr.message);
      }
    }
  });
};
