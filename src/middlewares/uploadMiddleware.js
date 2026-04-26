//src/middlewares/uploadMiddleware.js
const multer = require('multer');

// L'image est stockée temporairement dans la RAM du serveur (Buffer) au lieu du disque dur
const storage = multer.memoryStorage();

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // Limite à 5MB
    }
});

module.exports = upload;