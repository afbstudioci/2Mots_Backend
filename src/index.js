//src/index.js
const app = require('./app');
const connectDB = require('./config/db');
const { port } = require('./config/env');
const initAiWorker = require('./workers/aiWordGenerator');

connectDB().then(() => {
    app.listen(port, () => {
        console.log(`[SERVEUR] Démarré sur le port ${port} en mode ${process.env.NODE_ENV || 'development'}`);
        
        // Initialisation du Générateur IA Autonome une fois la DB prête
        initAiWorker();
    });
}).catch(err => {
    console.error('[SERVEUR] Échec critique au démarrage (Base de données inatteignable) :', err);
    process.exit(1);
});