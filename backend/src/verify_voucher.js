
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'devps',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function findVoucherTransaction() {
    try {
        const [rows] = await pool.query(`
      SELECT svu.kode_transaksi, svu.voucher_use, t.total_harga, t.harga_nego
      FROM sponsor_voucher_use svu
      JOIN transaksi t ON t.kode_transaksi = svu.kode_transaksi
      LIMIT 1
    `);

        if (rows.length === 0) {
            console.log("No transactions with vouchers found.");
            return;
        }

        const { kode_transaksi, voucher_use, total_harga, harga_nego } = rows[0];
        const fix_harga = harga_nego > 0 ? harga_nego : total_harga;

        console.log(`Testing Transaction: ${kode_transaksi}`);
        console.log(`Fix Harga: ${fix_harga}`);
        console.log(`Voucher Used: ${voucher_use}`);

        // Test specific reports
        const [payments] = await pool.query(`
      SELECT SUM(jumlah_bayar) as total_bayar 
      FROM transaksi_pembayaran 
      WHERE kode_transaksi = ? AND jenis_transaksi NOT IN ('piutang')
    `, [kode_transaksi]);

        const total_bayar = payments[0].total_bayar || 0;
        const sisa_bayar = fix_harga - total_bayar - voucher_use;

        console.log(`Total Paid: ${total_bayar}`);
        console.log(`Expected Sisa Bayar: ${sisa_bayar}`);

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await pool.end();
    }
}

findVoucherTransaction();
