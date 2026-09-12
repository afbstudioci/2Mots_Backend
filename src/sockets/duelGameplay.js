// src/sockets/duelGameplay.js
// GESTIONNAIRE DES EVENEMENTS DE JEU ET BUZZER DES DUELS 1V1
// Standard : Bank Grade (Strict <= 270 lignes, Sans Emojis)

const duelService = require('../services/duelService');
const { roomPresences, buzzerTimeouts } = require('./duelState');

module.exports = (io, socket) => {
  // 1. Activation du Buzzer
  socket.on('duel_buzz', async ({ duelId, userId }) => {
    try {
      const strDuelId = String(duelId);
      const duel = await duelService.handleBuzzer(strDuelId, userId);

      if (duel && duel.activeBuzzer?.userId) {
        const activeUser = duel.activeBuzzer.userId;
        const activeUserName = activeUser?.login || (String(activeUser) === String(userId) ? 'Joueur' : 'Adversaire');

        if (buzzerTimeouts.has(strDuelId)) {
          clearTimeout(buzzerTimeouts.get(strDuelId));
        }

        io.to(`duel_${strDuelId}`).emit('duel_buzzer_locked', {
          userId: String(activeUser._id || activeUser),
          userName: activeUserName,
          lockedAt: duel.activeBuzzer.lockedAt,
          expiresAt: duel.activeBuzzer.expiresAt,
        });

        const timeout = setTimeout(async () => {
          await duelService.releaseBuzzer(strDuelId);
          io.to(`duel_${strDuelId}`).emit('duel_buzzer_expired', {
            duelId: strDuelId,
            message: 'Parole libre',
          });
          buzzerTimeouts.delete(strDuelId);
        }, 3200);

        buzzerTimeouts.set(strDuelId, timeout);
      } else {
        socket.emit('duel_buzz_rejected', { message: 'Buzzer deja active ou indisponible.' });
      }
    } catch (error) {
      console.error('[SOCKET_DUEL] Erreur buzz:', error.message);
      socket.emit('duel_error', { message: error.message });
    }
  });

  // 2. Soumission d'une reponse
  socket.on('duel_submit_answer', async ({ duelId, userId, answer }) => {
    try {
      const strDuelId = String(duelId);
      if (buzzerTimeouts.has(strDuelId)) {
        clearTimeout(buzzerTimeouts.get(strDuelId));
        buzzerTimeouts.delete(strDuelId);
      }

      const result = await duelService.submitAnswer(strDuelId, userId, answer);
      if (result) {
        io.to(`duel_${strDuelId}`).emit('duel_answer_result', {
          userId,
          answer,
          isCorrect: result.isCorrect,
          scores: result.scores,
          currentEnigmaIndex: result.currentEnigmaIndex,
          nextEnigma: result.nextEnigma,
          isLastEnigma: result.isLastEnigma,
        });

        if (result.isLastEnigma) {
          const finalSummary = await duelService.finishDuel(strDuelId);
          io.to(`duel_${strDuelId}`).emit('duel_game_over', {
            duel: finalSummary,
            reason: 'all_enigmas_completed',
          });
          roomPresences.delete(strDuelId);
        }
      }
    } catch (error) {
      console.error('[SOCKET_DUEL] Erreur submit answer:', error.message);
      socket.emit('duel_error', { message: error.message });
    }
  });

  // 3. Passer une enigme
  socket.on('duel_skip_enigma', async ({ duelId }) => {
    try {
      const strDuelId = String(duelId);
      if (buzzerTimeouts.has(strDuelId)) {
        clearTimeout(buzzerTimeouts.get(strDuelId));
        buzzerTimeouts.delete(strDuelId);
      }

      const result = await duelService.skipEnigma(strDuelId);
      if (result) {
        io.to(`duel_${strDuelId}`).emit('duel_enigma_skipped', {
          scores: result.scores,
          currentEnigmaIndex: result.currentEnigmaIndex,
          nextEnigma: result.nextEnigma,
          isLastEnigma: result.isLastEnigma,
        });

        if (result.isLastEnigma) {
          const finalSummary = await duelService.finishDuel(strDuelId);
          io.to(`duel_${strDuelId}`).emit('duel_game_over', {
            duel: finalSummary,
            reason: 'all_enigmas_completed',
          });
          roomPresences.delete(strDuelId);
        }
      }
    } catch (error) {
      console.error('[SOCKET_DUEL] Erreur skip enigma:', error.message);
    }
  });

  // 4. Fin de temps reglementaire
  socket.on('duel_finish', async ({ duelId }) => {
    try {
      const strDuelId = String(duelId);
      if (buzzerTimeouts.has(strDuelId)) {
        clearTimeout(buzzerTimeouts.get(strDuelId));
        buzzerTimeouts.delete(strDuelId);
      }

      const finalSummary = await duelService.finishDuel(strDuelId);
      io.to(`duel_${strDuelId}`).emit('duel_game_over', {
        duel: finalSummary,
        reason: 'time_expired',
      });
      roomPresences.delete(strDuelId);
    } catch (error) {
      console.error('[SOCKET_DUEL] Erreur finish duel:', error.message);
    }
  });

  // 5. Abandon / Forfait
  socket.on('duel_forfeit', async ({ duelId, userId }) => {
    try {
      const strDuelId = String(duelId);
      const result = await duelService.forfeitDuel(userId, strDuelId);
      if (result) {
        io.to(`duel_${strDuelId}`).emit('duel_forfeited', {
          duelId: strDuelId,
          forfeiterId: String(result.forfeiterId),
          opponentId: String(result.opponentId),
          penaltyKevs: result.penaltyKevs,
          winnerName: result.winnerName,
          reason: 'voluntary_forfeit',
        });
        io.to(String(result.forfeiterId)).emit('duel_session_ended', { duelId: strDuelId });
        io.to(String(result.opponentId)).emit('duel_session_ended', { duelId: strDuelId });
        roomPresences.delete(strDuelId);
      }
    } catch (error) {
      console.error('[SOCKET_DUEL] Erreur forfeit:', error.message);
    }
  });
};
