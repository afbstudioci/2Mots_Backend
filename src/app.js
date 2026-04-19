//src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const gameRoutes = require('./routes/gameRoutes');

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
            callback(new Error('Non autorise par les regles CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json({ limit: '10kb' }));

const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 150,
    message: { status: 'error', message: 'Trop de requetes depuis cette IP, veuillez reessayer plus tard.' }
});
app.use('/api', globalLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);

app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'success', message: 'Le serveur 2Mots est operationnel et securise' });
});

// Middleware global de gestion des erreurs (Securise pour la production)
app.use((err, req, res, next) => {
    console.error(`[Erreur Systeme] ${err.message}`);
    
    // Interception des doublons MongoDB (Code 11000)
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        const fieldName = field === 'login' ? 'pseudo' : field;
        return res.status(400).json({ 
            status: 'error', 
            message: `Ce ${fieldName} est deja utilise.` 
        });
    }

    if (err.message === 'Non autorise par les regles CORS') {
        return res.status(403).json({ status: 'error', message: 'Origine non autorisee' });
    }

    res.status(err.statusCode || 500).json({
        status: 'error',
        message: process.env.NODE_ENV === 'production' ? 'Une erreur interne est survenue' : err.message
    });
});

app.use((req, res) => {
    res.status(404).json({ status: 'fail', message: 'Route non trouvee sur ce serveur' });
});

module.exports = app;