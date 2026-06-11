import { pool } from './db.js'

async function verify() {
    console.log("Verifying refined voucher approval logic (delayed balance reduction)...")

    // 1. Check if we have any pending payments with cash portion in DB
    const [pending] = await pool.query(
        "SELECT id_pembayaran, kode_transaksi, jumlah_bayar, voucher, status_bayar FROM transaksi_pembayaran WHERE status_bayar = 'pending' LIMIT 5"
    )

    if (pending.length > 0) {
        console.log("\nPending payments found:")
        console.table(pending)

        for (const p of pending) {
            const [trx] = await pool.query(
                "SELECT kode_transaksi, total_harga, harga_nego, jumlah_bayar FROM transaksi WHERE kode_transaksi = ?",
                [p.kode_transaksi]
            )
            console.log(`\nTransaction ${p.kode_transaksi} state:`)
            console.table(trx)
            console.log(`Note: Transaction's jumlah_bayar should NOT yet include this pending payment (${p.jumlah_bayar} cash + ${p.voucher} voucher).`)
        }
    } else {
        console.log("\nNo pending payments found in DB to analyze.")
    }

    // 2. Check a recently approved payment (status='ok' and voucher > 0)
    const [approved] = await pool.query(
        "SELECT id_pembayaran, kode_transaksi, jumlah_bayar, voucher, status_bayar FROM transaksi_pembayaran WHERE status_bayar = 'ok' AND voucher > 0 ORDER BY id_pembayaran DESC LIMIT 1"
    )

    if (approved.length > 0) {
        console.log("\nRecently approved voucher payment found:")
        console.table(approved)
    }

    process.exit(0)
}

verify()
