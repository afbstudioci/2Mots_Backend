const { z } = require('zod');

const registerSchema = z.object({
    login: z.string()
        .min(3, 'Le pseudo doit faire au moins 3 caracteres')
        .max(20, 'Le pseudo ne doit pas depasser 20 caracteres')
        .trim(),
    email: z.string()
        .email('Veuillez fournir un email valide')
        .trim(),
    password: z.string()
        .min(8, 'Le mot de passe doit faire au moins 8 caracteres')
        .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule')
        .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre')
});

const loginSchema = z.object({
    login: z.string().trim(),
    password: z.string()
});

const submitAnswerSchema = z.object({
    wordPairId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID de paire de mots invalide'),
    userAnswer: z.string().trim().min(1, 'La reponse ne peut pas etre vide'),
    timeRemaining: z.number().min(0).max(30, 'Le temps restant est invalide')
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
    validateLogin: validate(loginSchema),
    validateSubmitAnswer: validate(submitAnswerSchema)
};