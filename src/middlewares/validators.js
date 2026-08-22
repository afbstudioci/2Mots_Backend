//src/middlewares/validators.js
const { z } = require('zod');

const registerSchema = z.object({
    login: z.string({ required_error: 'Le pseudo est obligatoire.' })
        .trim()
        .min(3, 'Le pseudo doit contenir au moins 3 caractères.')
        .max(20, 'Le pseudo ne peut pas dépasser 20 caractères.'),
    email: z.string({ required_error: "L'adresse email est obligatoire." })
        .trim()
        .email('Veuillez fournir une adresse email valide.'),
    password: z.string({ required_error: 'Le mot de passe est obligatoire.' })
        .min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
        .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule.')
        .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre.')
});

const loginSchema = z.object({
    login: z.string({ required_error: 'Le pseudo ou email est obligatoire.' }).trim().min(1, 'Veuillez saisir votre pseudo ou email.'),
    password: z.string({ required_error: 'Le mot de passe est obligatoire.' }).min(1, 'Veuillez saisir votre mot de passe.')
});

module.exports = {
    registerSchema,
    loginSchema
};