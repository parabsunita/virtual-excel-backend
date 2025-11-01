const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { otpLimiter } = require('../middleware/rateLimiter');

router.post('/register', otpLimiter, authController.registerOrg);
router.post('/verify-otp', authController.verifyOtp);
router.post('/login', authController.loginOrg);
router.post('/forgot-password', otpLimiter, authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

module.exports = router;
