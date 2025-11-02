const { sql, connectDb } = require('../config/db');
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
    const pool = await connectDb();

    // Check if email already exists
    const checkEmail = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT id FROM organizations WHERE email = @email');
    if (checkEmail.recordset.length > 0) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    // Check if same org_name and password combo exists
    const hashed = await bcrypt.hash(password, 10);
    const checkCombo = await pool.request()
      .input('org_name', sql.NVarChar, org_name)
      .input('password', sql.NVarChar, hashed)
      .query('SELECT id FROM organizations WHERE org_name = @org_name AND password = @password');
    if (checkCombo.recordset.length > 0) {
      return res.status(409).json({ error: 'Same organization name and password combination is not allowed' });
    }

    const otp = generateOTP();
    const hashedOtp = hashOtp(otp);
    const expiry = new Date(Date.now() + OTP_EXPIRY_MIN * 60 * 1000);

    // Insert organization and get inserted id
    const orgResult = await pool.request()
      .input('org_name', sql.NVarChar, org_name)
      .input('email', sql.NVarChar, email)
      .input('password', sql.NVarChar, hashed)
      .input('otp_code', sql.NVarChar, otp)
      .input('otp_expires_at', sql.DateTime, expiry)
      .query('INSERT INTO organizations (org_name, email, password, otp_code, otp_expires_at) OUTPUT INSERTED.id VALUES (@org_name, @email, @password, @otp_code, @otp_expires_at)');
    const orgId = orgResult.recordset[0].id;

    // create admin employee linked to org (auto-verified)
    await pool.request()
      .input('org_id', sql.Int, orgId)
      .input('name', sql.NVarChar, org_name)
      .input('email', sql.NVarChar, email)
      .input('password', sql.NVarChar, hashed)
      .input('role', sql.NVarChar, 'admin')
      .input('is_verified', sql.Bit, 1)
      .query('INSERT INTO employees (org_id, name, email, password, role, is_verified) VALUES (@org_id, @name, @email, @password, @role, @is_verified)');

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
    const pool = await connectDb();
    const orgResult = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT * FROM organizations WHERE email = @email');
    const rows = orgResult.recordset;
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const org = rows[0];
    if (org.is_verified) return res.json({ message: 'Already verified' });
    if (!org.otp_code) return res.status(400).json({ error: 'No OTP found. Request again.' });
    const hashedOtp = hashOtp(otp);
    //if (hashedOtp !== org.otp_code) return res.status(400).json({ error: 'Invalid OTP' });
    if (otp !== org.otp_code) return res.status(400).json({ error: 'Invalid OTP' });
    if (new Date() > new Date(org.otp_expires_at)) return res.status(400).json({ error: 'OTP expired' });
    await pool.request()
      .input('id', sql.Int, org.id)
      .query('UPDATE organizations SET is_verified=1, otp_code=NULL, otp_expires_at=NULL WHERE id = @id');
    res.json({ success: true, message: 'Account verified' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Verification failed' });
  }
};

exports.loginOrg = async (req, res) => {
  try {
    const { email, password } = req.body;
    const pool = await connectDb();
    const orgResult = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT * FROM organizations WHERE email = @email');
    const rows = orgResult.recordset;
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
    const pool = await connectDb();
    const orgResult = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT * FROM organizations WHERE email = @email');
    const rows = orgResult.recordset;
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const org = rows[0];
    const otp = generateOTP();
    const hashedOtp = hashOtp(otp);
    const expiry = new Date(Date.now() + OTP_EXPIRY_MIN * 60 * 1000);
    await pool.request()
      .input('otp_code', sql.NVarChar, hashedOtp)
      .input('otp_expires_at', sql.DateTime, expiry)
      .input('id', sql.Int, org.id)
      .query('UPDATE organizations SET otp_code = @otp_code, otp_expires_at = @otp_expires_at WHERE id = @id');
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
    const pool = await connectDb();
    const orgResult = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT * FROM organizations WHERE email = @email');
    const rows = orgResult.recordset;
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const org = rows[0];
    if (!org.otp_code) return res.status(400).json({ error: 'No OTP set' });
    const hashedOtp = hashOtp(otp);
    if (hashedOtp !== org.otp_code) return res.status(400).json({ error: 'Invalid OTP' });
    if (new Date() > new Date(org.otp_expires_at)) return res.status(400).json({ error: 'OTP expired' });
    const hashed = await bcrypt.hash(new_password, 10);
    await pool.request()
      .input('password', sql.NVarChar, hashed)
      .input('id', sql.Int, org.id)
      .query('UPDATE organizations SET password = @password, otp_code = NULL, otp_expires_at = NULL WHERE id = @id');
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Reset failed' });
  }
};