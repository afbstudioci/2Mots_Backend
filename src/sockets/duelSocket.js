//src/sockets/duelSocket.js
const duelService = require('../services/duelService');
const DuelSession = require('../models/DuelSession');

// Mémoire locale de présence, timers de buzzer et timers de déconnexion
const roomPresences = new Map(); // duelId -> Set of userIds
const buzzerTimeouts = new Map(); // duelId -> Timeout
const disconnectTimers = new Map(); // `${duelId}_${userId}` -> Timeout
const socketDuelMap = new Map(); // socket.id -> { duelId, userId }

module.exports = (io, socket) => {
    socket.on('duel_join', async ({ duelId, userId }) => {
        try {
            if (!duelId || !userId) return;
            const strDuelId = String(duelId);
            const strUserId = String(userId);
            const roomName = `duel_${strDuelId}`;

            socket.join(roomName);
            socketDuelMap.set(socket.id, { duelId: strDuelId, userId: strUserId });

            // Annulation du timer d'abandon si le joueur s'est reconnecté dans les 15 secondes
            const disconnectKey = `${strDuelId}_${strUserId}`;
            if (disconnectTimers.has(disconnectKey)) {
                clearTimeout(disconnectTimers.get(disconnectKey));
                disconnectTimers.delete(disconnectKey);
                io.to(roomName).emit('duel_player_reconnected', { userId: strUserId });
                console.log(`[SOCKET_DUEL] Joueur ${strUserId} reconnecté à temps au duel ${strDuelId}`);
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

            if (bothReady || duel.status === 'in_progress') {
                const updatedDuel = await duelService.startDuelGame(strDuelId);
                io.to(roomName).emit('duel_start', {
                    duelId: strDuelId,
                    duel: updatedDuel,
                    startedAt: updatedDuel.startedAt,
                    duration: updatedDuel.duration || 60
                });
            } else {
                io.to(roomName).emit('duel_waiting_opponent', {
                    duelId: strDuelId,
                    connectedCount: presenceSet.size,
                    duel
                });
            }
        } catch (error) {
            console.error('[SOCKET_DUEL] Erreur join duel:', error.message);
            socket.emit('duel_error', { message: error.message });
        }
    });

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
                    expiresAt: duel.activeBuzzer.expiresAt
                });

                const timeout = setTimeout(async () => {
                    await duelService.releaseBuzzer(strDuelId);
                    io.to(`duel_${strDuelId}`).emit('duel_buzzer_expired', {
                        duelId: strDuelId,
                        message: 'Parole libre'
                    });
                    buzzerTimeouts.delete(strDuelId);
                }, 3200);

                buzzerTimeouts.set(strDuelId, timeout);
            } else {
                socket.emit('duel_buzz_rejected', { message: 'Buzzer déjà activé ou indisponible.' });
            }
        } catch (error) {
            console.error('[SOCKET_DUEL] Erreur buzz:', error.message);
            socket.emit('duel_error', { message: error.message });
        }
    });

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
                    isLastEnigma: result.isLastEnigma
                });

                if (result.isLastEnigma) {
                    const finalSummary = await duelService.finishDuel(strDuelId);
                    io.to(`duel_${strDuelId}`).emit('duel_game_over', {
                        duel: finalSummary,
                        reason: 'all_enigmas_completed'
                    });
                    roomPresences.delete(strDuelId);
                }
            }
        } catch (error) {
            console.error('[SOCKET_DUEL] Erreur submit answer:', error.message);
            socket.emit('duel_error', { message: error.message });
        }
    });

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
                    isLastEnigma: result.isLastEnigma
                });

                if (result.isLastEnigma) {
                    const finalSummary = await duelService.finishDuel(strDuelId);
                    io.to(`duel_${strDuelId}`).emit('duel_game_over', {
                        duel: finalSummary,
                        reason: 'all_enigmas_completed'
                    });
                    roomPresences.delete(strDuelId);
                }
            }
        } catch (error) {
            console.error('[SOCKET_DUEL] Erreur skip enigma:', error.message);
        }
    });

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
                reason: 'time_expired'
            });
            roomPresences.delete(strDuelId);
        } catch (error) {
            console.error('[SOCKET_DUEL] Erreur finish duel:', error.message);
        }
    });

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
                    reason: 'voluntary_forfeit'
                });
                io.to(String(result.forfeiterId)).emit('duel_session_ended', { duelId: strDuelId });
                io.to(String(result.opponentId)).emit('duel_session_ended', { duelId: strDuelId });
                roomPresences.delete(strDuelId);
            }
        } catch (error) {
            console.error('[SOCKET_DUEL] Erreur forfeit:', error.message);
        }
    });

    // GESTION RÉSEAU : Déconnexion inopinée (Coupure réseau, batterie, fermeture forcée)
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
                        graceSeconds: 15
                    });
                    console.log(`[SOCKET_DUEL] Joueur ${userId} déconnecté du duel ${duelId}. Délai de grâce : 15s`);

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
                                    reason: 'disconnection_timeout'
                                });
                                io.to(String(result.opponentId)).emit('duel_session_ended', { duelId });
                                roomPresences.delete(duelId);
                                console.log(`[SOCKET_DUEL] Duel ${duelId} clôturé par forfait après 15s de déconnexion`);
                            }
                        } catch (timeoutErr) {
                            console.warn('[SOCKET_DUEL] Erreur clôture déconnexion:', timeoutErr.message);
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
