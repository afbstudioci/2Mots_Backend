//src/middlewares/validators.js
const { z } = require('zod');

const registerSchema = z.object({
    login: z.string()
        .trim()
        .min(3, 'Le pseudo doit faire au moins 3 caractères.')
        .max(20, 'Le pseudo ne doit pas dépasser 20 caractères.'),
    email: z.string()
        .trim()
        .email('Veuillez fournir un e-mail valide.'),
    password: z.string()
        .min(8, 'Le mot de passe doit faire au moins 8 caractères.')
        .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule.')
        .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre.')
});

const loginSchema = z.object({
    login: z.string().trim(),
    password: z.string()
});

module.exports = {
    registerSchema,
    loginSchema
};