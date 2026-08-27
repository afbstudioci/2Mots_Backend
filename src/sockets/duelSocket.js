//src/sockets/duelSocket.js
const duelService = require('../services/duelService');
const DuelSession = require('../models/DuelSession');

module.exports = (io, socket) => {
    socket.on('duel_join', async ({ duelId, userId }) => {
        try {
            const roomName = `duel_${duelId}`;
            socket.join(roomName);
            const duel = await DuelSession.findById(duelId)
                .populate('challenger opponent winner', 'login avatar level')
                .lean();

            if (duel) {
                io.to(roomName).emit('duel_player_ready', { duelId, userId, duel });
            }
        } catch (error) {
            console.error('[SOCKET_DUEL] Erreur join duel:', error.message);
            socket.emit('duel_error', { message: error.message });
        }
    });

    socket.on('duel_send_invite', ({ opponentId, challengerName, betAmount, duelId }) => {
        io.to(opponentId).emit('duel_invite_received', {
            duelId,
            challengerName,
            betAmount
        });
    });

    socket.on('duel_respond_invite', ({ challengerId, opponentName, accept, duelId }) => {
        io.to(challengerId).emit('duel_invite_response', {
            duelId,
            opponentName,
            accept
        });
    });

    socket.on('duel_cancel_invite', ({ opponentId, duelId }) => {
        io.to(opponentId).emit('duel_invite_cancelled', { duelId });
    });

    socket.on('duel_buzz', async ({ duelId, userId }) => {
        try {
            const duel = await duelService.handleBuzzer(duelId, userId);
            if (duel && duel.activeBuzzer?.userId) {
                io.to(`duel_${duelId}`).emit('duel_buzzer_locked', {
                    userId: String(duel.activeBuzzer.userId),
                    lockedAt: duel.activeBuzzer.lockedAt,
                    expiresAt: duel.activeBuzzer.expiresAt
                });
            } else {
                socket.emit('duel_buzz_rejected', { message: 'Buzzer déjà activé ou expiré.' });
            }
        } catch (error) {
            console.error('[SOCKET_DUEL] Erreur buzz:', error.message);
            socket.emit('duel_error', { message: error.message });
        }
    });

    socket.on('duel_submit_answer', async ({ duelId, userId, answer }) => {
        try {
            const result = await duelService.submitAnswer(duelId, userId, answer);
            io.to(`duel_${duelId}`).emit('duel_answer_result', {
                userId,
                isCorrect: result.isCorrect,
                scores: result.scores,
                currentEnigmaIndex: result.currentEnigmaIndex,
                nextEnigma: result.nextEnigma,
                isLastEnigma: result.isLastEnigma
            });

            if (result.isLastEnigma) {
                const finalSummary = await duelService.finishDuel(duelId);
                io.to(`duel_${duelId}`).emit('duel_game_over', {
                    duel: finalSummary,
                    reason: 'all_enigmas_completed'
                });
            }
        } catch (error) {
            console.error('[SOCKET_DUEL] Erreur submit answer:', error.message);
            socket.emit('duel_error', { message: error.message });
        }
    });

    socket.on('duel_skip_enigma', async ({ duelId }) => {
        try {
            const result = await duelService.skipEnigma(duelId);
            if (result) {
                io.to(`duel_${duelId}`).emit('duel_enigma_skipped', {
                    scores: result.scores,
                    currentEnigmaIndex: result.currentEnigmaIndex,
                    nextEnigma: result.nextEnigma,
                    isLastEnigma: result.isLastEnigma
                });

                if (result.isLastEnigma) {
                    const finalSummary = await duelService.finishDuel(duelId);
                    io.to(`duel_${duelId}`).emit('duel_game_over', {
                        duel: finalSummary,
                        reason: 'all_enigmas_completed'
                    });
                }
            }
        } catch (error) {
            console.error('[SOCKET_DUEL] Erreur skip enigma:', error.message);
        }
    });

    socket.on('duel_finish', async ({ duelId }) => {
        try {
            const finalSummary = await duelService.finishDuel(duelId);
            io.to(`duel_${duelId}`).emit('duel_game_over', {
                duel: finalSummary,
                reason: 'time_expired'
            });
        } catch (error) {
            console.error('[SOCKET_DUEL] Erreur finish duel:', error.message);
        }
    });

    socket.on('duel_forfeit', async ({ duelId, userId }) => {
        try {
            const duel = await DuelSession.findById(duelId);
            if (duel && duel.status === 'in_progress') {
                const finalSummary = await duelService.finishDuel(duelId);
                io.to(`duel_${duelId}`).emit('duel_game_over', {
                    duel: finalSummary,
                    forfeitBy: userId,
                    reason: 'forfeit'
                });
            }
        } catch (error) {
            console.error('[SOCKET_DUEL] Erreur forfeit:', error.message);
        }
    });
};
