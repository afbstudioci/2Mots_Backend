// src/workers/happyHourWorker.js
// WORKER CRON DE L'HEURE MAGIQUE (SAMEDI ET DIMANCHE A 19H00 UTC)
// Standard : Bank Grade (Strict <= 270 lignes, Sans Emojis)

const cron = require('node-cron');
const happyHourService = require('../services/happyHourService');

/**
 * Initialise les declencheurs automatiques de l'Heure Magique
 */
const initHappyHourWorker = () => {
  console.log('[WORKER_HAPPY_HOUR] Planificateur initialise (Samedi et Dimanche a 19h00 UTC)');

  // Samedi a 19h00 UTC
  cron.schedule('0 19 * * 6', async () => {
    try {
      console.log('[WORKER_HAPPY_HOUR] Lancement automatique Heure Magique (Samedi)...');
      await happyHourService.startHappyHour(120);
    } catch (error) {
      console.error('[WORKER_HAPPY_HOUR] Erreur execution Samedi:', error.message);
    }
  });

  // Dimanche a 19h00 UTC
  cron.schedule('0 19 * * 0', async () => {
    try {
      console.log('[WORKER_HAPPY_HOUR] Lancement automatique Heure Magique (Dimanche)...');
      await happyHourService.startHappyHour(120);
    } catch (error) {
      console.error('[WORKER_HAPPY_HOUR] Erreur execution Dimanche:', error.message);
    }
  });
};

module.exports = initHappyHourWorker;
