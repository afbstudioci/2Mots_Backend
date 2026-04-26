//src/middlewares/uploadMiddleware.js
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: '2mots_avatars',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 500, height: 500, crop: 'limit' }]
    }
});

// Configuration de multer avec le stockage Cloudinary et une limite de 5MB
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

module.exports = upload;