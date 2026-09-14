// src/workers/retentionWorker.js
// WORKER CRON DE RETENTION AUTOMATIQUE - 2MOTS
// Standard : Bank Grade (Strict <= 270 lignes, Sans Emojis)

const cron = require('node-cron');
const retentionService = require('../services/retentionService');

/**
 * Initialise le planificateur automatique des rappels d'inactivite
 * Execution quotidienne a 18h00 UTC
 */
const initRetentionWorker = () => {
  console.log('[WORKER_RETENTION] Planificateur de retention initialise (Tous les jours a 18h00 UTC)');

  // '0 18 * * *' = tous les jours a 18h00 UTC
  cron.schedule('0 18 * * *', async () => {
    try {
      console.log('[WORKER_RETENTION] Demarrage du scan automatique de retention...');
      await retentionService.processInactivityReminders();
    } catch (error) {
      console.error('[WORKER_RETENTION] Erreur durant le scan de retention:', error.message);
    }
  });
};

module.exports = initRetentionWorker;
