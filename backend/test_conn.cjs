const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  try {
    const pool = mysql.createPool({
      host: '127.0.0.1',
      port: parseInt(process.env.DB_PORT) || 3106,
      user: 'optikdb',
      password: 'masuk123',
      database: 'optikdatabase'
    });
    const [c] = await pool.query('SELECT VERSION() as v');
    console.log('MySQL Version:', c[0].v);
    
    const [counts] = await pool.query('SELECT COUNT(*) as cnt FROM customer');
    console.log('Customers count:', counts[0].cnt);
    process.exit(0);
  } catch (e) {
    console.error('DB Connection Error:', e);
    process.exit(1);
  }
}
run();
