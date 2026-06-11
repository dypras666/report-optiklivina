import { pool } from './db.js'

async function main() {
    const [rows] = await pool.query("SHOW COLUMNS FROM sponsor_voucher_use")
    console.log(JSON.stringify(rows, null, 2))
    process.exit(0)
}

main()
