const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/authRoutes');
const gameRoutes = require('./routes/gameRoutes');

const app = express();

// 1. Sécurité des headers HTTP
app.use(helmet());

// 2. Configuration CORS stricte (Sécurité)
const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:8081', 'http://localhost:3000']; // Ports par défaut d'Expo Web

app.use(cors({
    origin: function (origin, callback) {
        // Autorise les requêtes sans origine (comme les apps mobiles React Native) ou les origines validées
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Non autorisé par les règles CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true // Indispensable pour accepter les cookies httpOnly venant du front web
}));

// 3. Parsing et Cookies
app.use(express.json({ limit: '10kb' })); // Limite la taille du body contre les attaques DoS
app.use(cookieParser()); // Permet de lire req.cookies

// 4. Protection contre l'injection NoSQL
app.use(mongoSanitize()); // Supprime les clés contenant des caractères interdits comme le $

// 5. Anti-Brute Force Global
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 150, // Limite un peu plus souple pour le gameplay global
    message: { status: 'error', message: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.' }
});
app.use('/api', globalLimiter);

// --- ROUTES ---
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);

// Route de santé pour Render
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'success', message: 'Le serveur 2Mots est opérationnel et sécurisé' });
});

// --- GESTION DES ERREURS GLOBALE ---
app.use((err, req, res, next) => {
    console.error(`[Erreur] ${err.message}`);
    
    // Si l'erreur vient du CORS
    if (err.message === 'Non autorisé par les règles CORS') {
        return res.status(403).json({ status: 'error', message: 'Origine non autorisée' });
    }

    res.status(err.statusCode || 500).json({
        status: 'error',
        message: process.env.NODE_ENV === 'production' ? 'Une erreur interne est survenue' : err.message
    });
});

// Gestion des routes non trouvées (404)
app.use('*', (req, res) => {
    res.status(404).json({ status: 'fail', message: 'Route non trouvée sur ce serveur' });
});

module.exports = app;