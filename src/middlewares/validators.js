//src/middlewares/validators.js
const { z } = require('zod');

const registerSchema = z.object({
    login: z.string()
        .min(3, 'Le pseudo doit faire au moins 3 caractères')
        .max(20, 'Le pseudo ne doit pas dépasser 20 caractères')
        .trim(),
    email: z.string()
        .email('Veuillez fournir un email valide')
        .trim(),
    password: z.string()
        .min(8, 'Le mot de passe doit faire au moins 8 caractères')
        .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule')
        .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre')
});

const loginSchema = z.object({
    login: z.string().trim(),
    password: z.string()
});

const validate = (schema) => (req, res, next) => {
    try {
        schema.parse(req.body);
        next();
    } catch (error) {
        const errors = error.errors.map(e => e.message);
        return res.status(400).json({ status: 'fail', message: errors[0] });
    }
};

module.exports = {
    validateRegister: validate(registerSchema),
    validateLogin: validate(loginSchema)
};