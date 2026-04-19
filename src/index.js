//src/index.js
const app = require('./app');
const connectDB = require('./config/db');
const { port } = require('./config/env');
const initAiWorker = require('./workers/aiWordGenerator');

connectDB().then(() => {
    app.listen(port, () => {
        console.log(`[SERVEUR] Demarre sur le port ${port} en mode ${process.env.NODE_ENV || 'development'}`);
        
        // Initialisation du Generateur IA Autonome une fois la DB prete
        initAiWorker();
    });
}).catch(err => {
    console.error('[SERVEUR] Echec critique au demarrage (Base de donnees inatteignable):', err);
    process.exit(1);
});