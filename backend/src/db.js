import mysql from 'mysql2/promise'

console.log(`[DB] Connecting to database: ${process.env.DB_NAME || 'optiklivina_latest'} on ${process.env.DB_HOST || 'localhost'}`);

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'optiklivina_latest',
  dateStrings: true,
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0
})