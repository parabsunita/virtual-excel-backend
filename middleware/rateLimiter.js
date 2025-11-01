const rateLimit = require('express-rate-limit');

exports.otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { message: 'Too many OTP requests, please try again later.' }
});
