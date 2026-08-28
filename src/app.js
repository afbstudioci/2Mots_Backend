//src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('./config/firebase');

const authRoutes = require('./routes/authRoutes');
const gameRoutes = require('./routes/gameRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');
const configRoutes = require('./routes/configRoutes');
const missionRoutes = require('./routes/missionRoutes');
const friendRoutes = require('./routes/friendRoutes');
const chatRoutes = require('./routes/chatRoutes');
const shopRoutes = require('./routes/shopRoutes');
const duelRoutes = require('./routes/duelRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();

app.set('trust proxy', 1);

app.use(helmet());

const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : [];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin) || allowedOrigins.length === 0) {
            callback(null, true);
        } else {
            callback(new Error('Non autorisé par les règles CORS.'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json({ limit: '10kb' }));

const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 3000,
    message: { status: 'error', message: 'Trafic réseau inhabituel détecté. Veuillez patienter.' }
});
app.use('/api', globalLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/config', configRoutes);
app.use('/api/missions', missionRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/duel', duelRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'success', message: 'Le serveur 2Mots est opérationnel et sécurisé.' });
});

app.use((err, req, res, next) => {
    console.error(`[Erreur Système] ${err.message}`);

    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0];
        const fieldName = field === 'login' ? 'pseudo' : (field === 'email' ? 'adresse email' : field);
        return res.status(400).json({
            status: 'fail',
            message: `Ce ${fieldName} est déjà utilisé.`
        });
    }

    if (err.name === 'ValidationError') {
        const firstError = Object.values(err.errors || {})[0];
        return res.status(400).json({
            status: 'fail',
            message: firstError ? firstError.message : 'Données invalides fournies.'
        });
    }

    if (err.name === 'CastError') {
        return res.status(400).json({
            status: 'fail',
            message: 'Identifiant ou ressource invalide.'
        });
    }

    if (err.message === 'Non autorisé par les règles CORS.') {
        return res.status(403).json({ status: 'fail', message: 'Origine non autorisée.' });
    }

    const statusCode = err.statusCode || (err.message ? 400 : 500);
    const isClientError = statusCode >= 400 && statusCode < 500;

    return res.status(statusCode).json({
        status: isClientError ? 'fail' : 'error',
        message: err.message || 'Une erreur est survenue.'
    });
});

app.use((req, res, next) => {
    return res.status(404).json({ status: 'fail', message: 'Route non trouvée sur ce serveur.' });
});

module.exports = app;