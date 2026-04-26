//src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const gameRoutes = require('./routes/gameRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');
const configRoutes = require('./routes/configRoutes'); // Ajout

const app = express();

app.use(helmet());

const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:8081', 'http://localhost:3000'];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Non autorisé par les règles CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json({ limit: '10kb' }));

// Limiteur global
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 3000,
    message: { status: 'error', message: 'Trafic réseau inhabituel détecté. Veuillez patienter.' }
});
app.use('/api', globalLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/config', configRoutes); // Enregistrement de la nouvelle route

app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'success', message: 'Le serveur 2Mots est opérationnel et sécurisé' });
});

app.use((err, req, res, next) => {
    console.error(`[Erreur Système] ${err.message}`);
    
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        const fieldName = field === 'login' ? 'pseudo' : field;
        return res.status(400).json({ 
            status: 'error', 
            message: `Ce ${fieldName} est déjà utilisé.` 
        });
    }

    if (err.message === 'Non autorisé par les règles CORS') {
        return res.status(403).json({ status: 'error', message: 'Origine non autorisée' });
    }

    const statusCode = err.statusCode || 500;
    const isClientError = statusCode >= 400 && statusCode < 500;

    res.status(statusCode).json({
        status: isClientError ? 'fail' : 'error',
        message: (isClientError || process.env.NODE_ENV !== 'production') 
            ? err.message 
            : 'Une erreur interne est survenue'
    });
});

app.use((req, res) => {
    res.status(404).json({ status: 'fail', message: 'Route non trouvée sur ce serveur' });
});

module.exports = app;