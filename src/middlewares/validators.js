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

const validate = (schema) => {
    return async (req, res, next) => {
        try {
            if (typeof next !== 'function') {
                console.error('[Validator] CRITIQUE : next n\'est pas une fonction.');
                return res.status(500).json({ status: 'error', message: 'Erreur interne du serveur lors de la validation.' });
            }
            req.body = await schema.parseAsync(req.body);
            return next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                const errors = error.errors.map(e => e.message);
                return res.status(400).json({ status: 'fail', message: errors[0] });
            }
            return next(error);
        }
    };
};

module.exports = {
    validateRegister: validate(registerSchema),
    validateLogin: validate(loginSchema)
};