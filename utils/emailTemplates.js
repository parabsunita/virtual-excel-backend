exports.verifyEmailTemplate = (name, otp) => `
  <div style="font-family: Arial, sans-serif; padding: 20px;">
    <h2>Hello ${name},</h2>
    <p>Welcome to Virtual Excel System!</p>
    <p>Your One-Time Password (OTP) for account verification is:</p>
    <h1 style="color:#007BFF;">${otp}</h1>
    <p>This OTP will expire in <b>10 minutes</b>.</p>
    <p>Thank you,<br/>The Virtual Excel System Team</p>
  </div>
`;

exports.resetPasswordTemplate = (name, otp) => `
  <div style="font-family: Arial, sans-serif; padding: 20px;">
    <h2>Hi ${name},</h2>
    <p>We received a request to reset your password.</p>
    <p>Your password reset OTP is:</p>
    <h1 style="color:#FF5722;">${otp}</h1>
    <p>It will expire in <b>10 minutes</b>.</p>
    <p>If you didn’t request this, please ignore this message.</p>
    <p>Regards,<br/>Virtual Excel System</p>
  </div>
`;
