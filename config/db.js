const sql = require('mssql');
require('dotenv').config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_HOST,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT, 10) || 1433,
  options: {
    encrypt: true,
    trustServerCertificate: true,
    instanceName: process.env.DB_INSTANCE
  }
};

let pool;

const connectDb = async () => {
  if (pool) return pool;
  try {
    pool = await sql.connect(config);
    console.log('✅ Connected to MSSQL Server');
    return pool;
  } catch (err) {
    console.error('❌ DB connection failed:', err.message);
    throw err;
  }
};

module.exports = {
  sql,
  connectDb
};