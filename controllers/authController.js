const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const transporter = require('../config/mailer');
const { verifyEmailTemplate, resetPasswordTemplate } = require('../utils/emailTemplates');
const crypto = require('crypto');
require('dotenv').config();

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();
const OTP_EXPIRY_MIN = 10;

const hashOtp = (otp) => crypto.createHash('sha256').update(otp).digest('hex');

const sendEmail = async (to, subject, html) => {
  await transporter.sendMail({ from: process.env.EMAIL_USER, to, subject, html });
};

exports.registerOrg = async (req, res) => {
  try {
    const { org_name, email, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const hashedOtp = hashOtp(otp);
    const expiry = new Date(Date.now() + OTP_EXPIRY_MIN * 60 * 1000);
    const [r] = await pool.execute('INSERT INTO organizations (org_name, email, password, otp_code, otp_expires_at) VALUES (?, ?, ?, ?, ?)', [org_name, email, hashed, hashedOtp, expiry]);
    // create admin employee linked to org (auto-verified)
    await pool.execute('INSERT INTO employees (org_id, name, email, password, role, is_verified) VALUES (?, ?, ?, ?, ?, ?)', [r.insertId, org_name, email, hashed, 'admin', 1]);
    // send OTP email
    await sendEmail(email, 'Verify your account', verifyEmailTemplate(org_name, otp));
    res.json({ success: true, message: 'Registered. Check email for OTP.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const [rows] = await pool.execute('SELECT * FROM organizations WHERE email = ?', [email]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const org = rows[0];
    if (org.is_verified) return res.json({ message: 'Already verified' });
    if (!org.otp_code) return res.status(400).json({ error: 'No OTP found. Request again.' });
    const hashedOtp = hashOtp(otp);
    if (hashedOtp !== org.otp_code) return res.status(400).json({ error: 'Invalid OTP' });
    if (new Date() > new Date(org.otp_expires_at)) return res.status(400).json({ error: 'OTP expired' });
    await pool.execute('UPDATE organizations SET is_verified=1, otp_code=NULL, otp_expires_at=NULL WHERE id = ?', [org.id]);
    res.json({ success: true, message: 'Account verified' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Verification failed' });
  }
};

exports.loginOrg = async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.execute('SELECT * FROM organizations WHERE email = ?', [email]);
    if (!rows.length) return res.status(400).json({ error: 'Invalid credentials' });
    const org = rows[0];
    if (!org.is_verified) return res.status(403).json({ error: 'Please verify your email first' });
    const match = await bcrypt.compare(password, org.password || '');
    if (!match) return res.status(400).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: org.id, role: 'admin', type: 'org' }, process.env.JWT_SECRET || 'secret', { expiresIn: '8h' });
    res.json({ success: true, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const [rows] = await pool.execute('SELECT * FROM organizations WHERE email = ?', [email]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const org = rows[0];
    const otp = generateOTP();
    const hashedOtp = hashOtp(otp);
    const expiry = new Date(Date.now() + OTP_EXPIRY_MIN * 60 * 1000);
    await pool.execute('UPDATE organizations SET otp_code = ?, otp_expires_at = ? WHERE id = ?', [hashedOtp, expiry, org.id]);
    await sendEmail(email, 'Password reset OTP', resetPasswordTemplate(org.org_name || 'User', otp));
    res.json({ success: true, message: 'OTP sent to email' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Forgot password failed' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, new_password } = req.body;
    const [rows] = await pool.execute('SELECT * FROM organizations WHERE email = ?', [email]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const org = rows[0];
    if (!org.otp_code) return res.status(400).json({ error: 'No OTP set' });
    const hashedOtp = hashOtp(otp);
    if (hashedOtp !== org.otp_code) return res.status(400).json({ error: 'Invalid OTP' });
    if (new Date() > new Date(org.otp_expires_at)) return res.status(400).json({ error: 'OTP expired' });
    const hashed = await bcrypt.hash(new_password, 10);
    await pool.execute('UPDATE organizations SET password = ?, otp_code = NULL, otp_expires_at = NULL WHERE id = ?', [hashed, org.id]);
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Reset failed' });
  }
};
