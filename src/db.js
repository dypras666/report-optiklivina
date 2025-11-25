import mysql from 'mysql2/promise'

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'optiklivina_dbs',
  dateStrings: true,
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0
})