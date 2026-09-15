// src/services/passwordResetService.js
// SERVICE METIER DE REINITIALISATION DE MOT DE PASSE (OTP BCRYPT + ANTI-HARVESTING)
// Standard : Bank Grade (Strict <= 270 lignes, Sans Emojis)

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { sendOtpEmail } = require('../utils/emailService');

const OTP_EXPIRATION_MS = 15 * 60 * 1000; // 15 minutes
const BCRYPT_ROUNDS = 12;

/**
 * Traite une demande de réinitialisation de mot de passe (Anti-énumération)
 * @param {string} email - Email de l'utilisateur
 */
exports.forgotPassword = async (email) => {
  if (!email || typeof email !== 'string') {
    throw new Error("L'adresse email est requise.");
  }

  const cleanEmail = email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    throw new Error('Format d\'adresse email invalide.');
  }

  const user = await User.findOne({ email: cleanEmail });

  // Protection Anti-énumération : Répond avec succès même si l'utilisateur n'existe pas ou est banni
  if (!user || user.isBanned) {
    return true;
  }

  // Génération d'un OTP cryptographiquement sécurisé à 6 chiffres
  const otp = crypto.randomInt(100000, 1000000).toString();

  // Hachage Bcrypt (12 rounds) de l'OTP avant stockage
  user.resetPasswordOtp = await bcrypt.hash(otp, BCRYPT_ROUNDS);
  user.resetPasswordExpires = new Date(Date.now() + OTP_EXPIRATION_MS);

  await user.save({ validateBeforeSave: false });

  try {
    await sendOtpEmail(user.email, otp);
  } catch (error) {
    // Rollback des champs en cas d'échec de l'envoi d'email
    user.resetPasswordOtp = undefined;
    user.resetPasswordExpires = undefined;
    await user.save({ validateBeforeSave: false });
    throw new Error("Impossible d'envoyer l'email de réinitialisation pour le moment.");
  }

  return true;
};

/**
 * Valide le code OTP et réinitialise le mot de passe de l'utilisateur
 * @param {string} email - Email de l'utilisateur
 * @param {string} otp - Code OTP saisi
 * @param {string} newPassword - Nouveau mot de passe
 */
exports.resetPasswordWithOtp = async (email, otp, newPassword) => {
  if (!email || !otp || !newPassword) {
    throw new Error('Tous les champs sont requis.');
  }

  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    throw new Error('Le mot de passe doit contenir au moins 8 caractères.');
  }

  const cleanEmail = email.toLowerCase().trim();
  const cleanOtp = String(otp).trim();

  if (cleanOtp.length !== 6) {
    throw new Error('Le code de sécurité doit comporter 6 chiffres.');
  }

  // Récupération explicite des champs masqués par défaut (select: false)
  const user = await User.findOne({ email: cleanEmail }).select(
    '+password +resetPasswordOtp +resetPasswordExpires'
  );

  // Vérification de la présence et de la validité temporelle (15 minutes)
  if (
    !user ||
    user.isBanned ||
    !user.resetPasswordOtp ||
    !user.resetPasswordExpires ||
    user.resetPasswordExpires.getTime() < Date.now()
  ) {
    throw new Error('Le code de sécurité est invalide ou a expiré.');
  }

  // Comparaison cryptographique sécurisée de l'OTP
  const isValidOtp = await bcrypt.compare(cleanOtp, user.resetPasswordOtp);
  if (!isValidOtp) {
    throw new Error('Le code de sécurité est invalide ou a expiré.');
  }

  // Mise à jour du mot de passe (haché par le pre-save hook de User)
  user.password = newPassword;

  // Révocation et purge définitive de l'OTP et de l'expiration
  user.resetPasswordOtp = undefined;
  user.resetPasswordExpires = undefined;

  // Invalidation des sessions existantes pour forcer une nouvelle connexion sécurisée
  user.refreshTokens = [];

  await user.save();

  return true;
};
