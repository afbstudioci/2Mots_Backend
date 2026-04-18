const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const gameRoutes = require('./routes/gameRoutes');

const app = express();

// Securite des headers HTTP
app.use(helmet());

// Configuration CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Anti-Brute Force
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use(limiter);

// Parsing JSON
app.use(express.json({ limit: '10kb' }));

// --- ROUTES ---
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);

// Route de test (sera accessible sur Render pour vérifier que le serveur est up)
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'success', message: 'Le serveur 2Mots est operationnel' });
});

// --- GESTION DES ERREURS GLOBALE (Sécurité) ---
app.use((err, req, res, next) => {
    // En production, on ne renvoie jamais les détails de l'erreur au client
    res.status(err.statusCode || 500).json({
        status: 'error',
        message: process.env.NODE_ENV === 'production' ? 'Une erreur interne est survenue' : err.message
    });
});

// Gestion des routes non trouvées (404)
app.use((req, res) => {
    res.status(404).json({ status: 'fail', message: 'Route non trouvee' });
});

module.exports = app;