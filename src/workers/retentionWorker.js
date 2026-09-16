// src/workers/retentionWorker.js
// WORKER CRON DE RETENTION ET CYCLE VIP AUTOMATIQUE - 2MOTS
// Standard : Bank Grade (Strict <= 270 lignes, Sans Emojis)

const cron = require('node-cron');
const retentionService = require('../services/retentionService');
const vipService = require('../services/vipService');

/**
 * Initialise le planificateur automatique des rappels d'inactivite et cycle VIP
 * Execution quotidienne a 18h00 UTC
 */
const initRetentionWorker = () => {
  const timezone = process.env.APP_TIMEZONE || 'UTC';
  console.log(`[WORKER_RETENTION] Planificateur de retention et VIP initialise (Tous les jours a 18h00 [${timezone}])`);

  // '0 18 * * *' = tous les jours a 18h00
  cron.schedule(
    '0 18 * * *',
    async () => {
      // 1. Rappel quotidien pour les joueurs n'ayant pas ouvert l'application aujourd'hui
      try {
        console.log('[WORKER_RETENTION] Demarrage du rappel quotidien d\'engagement (18h00)...');
        await retentionService.processDailyEngagementReminders();
      } catch (error) {
        console.error('[WORKER_RETENTION] Erreur durant le rappel quotidien:', error.message);
      }

      // 2. Rappel progressif des inactifs longue duree (J+3, J+7, J+14)
      try {
        console.log('[WORKER_RETENTION] Demarrage du scan automatique de retention (J+3, J+7, J+14)...');
        await retentionService.processInactivityReminders();
      } catch (error) {
        console.error('[WORKER_RETENTION] Erreur durant le scan de retention:', error.message);
      }

      // 3. Cycle de vie des abonnements VIP
      try {
        console.log('[WORKER_RETENTION] Demarrage du scan automatique VIP...');
        await vipService.processVipLifecycle();
      } catch (error) {
        console.error('[WORKER_RETENTION] Erreur durant le scan VIP:', error.message);
      }
    },
    {
      scheduled: true,
      timezone,
    }
  );
};

module.exports = initRetentionWorker;

