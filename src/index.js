const app = require('./app');
const connectDB = require('./config/db');
const { port } = require('./config/env');

// Connexion a la base de donnees puis demarrage du serveur
connectDB().then(() => {
    app.listen(port, () => {
        console.log(`Serveur demarre sur le port ${port} en mode ${process.env.NODE_ENV || 'development'}`);
    });
});