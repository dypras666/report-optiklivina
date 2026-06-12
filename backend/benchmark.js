import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    port: 3316,
    user: 'optikdb',
    password: 'masuk123',
    database: 'optikdatabase',
  });

  const sql1 = `
    SELECT c.kode_customer, c.nama_customer, c.no_hp, c.no_ktp, c.status_user, c.blacklist_reason, c.alamat_lengkap,
           cabang_toko.nama_cabang, admin.nama_lengkap AS nama_marketing,
           c.file_ktp, c.file_kk,
           IFNULL(t_agg.sum_harga, 0) - IFNULL(tp_agg.sum_bayar, 0) - IFNULL(svu_agg.sum_voucher, 0) AS sisa_total,
           t_agg.aging_months,
           t_agg.last_activity,
           t_agg.tanggal_register,
           (SELECT jenis_transaksi 
            FROM transaksi_pembayaran tpx 
            INNER JOIN transaksi tx ON tx.kode_transaksi = tpx.kode_transaksi
            WHERE tx.kode_customer = c.kode_customer
            ORDER BY tpx.tanggal_bayar DESC, tpx.id_pembayaran DESC 
            LIMIT 1) AS last_payment_type
    FROM customer c
    LEFT JOIN cabang_toko ON cabang_toko.id_cabang = c.cabang
    LEFT JOIN admin ON admin.id = c.id_marketing
    LEFT JOIN (
        SELECT t.kode_customer,
               MAX(CASE WHEN ( (CASE WHEN t.harga_nego > 0 THEN t.harga_nego ELSE t.total_harga END) - IFNULL(tp.jml_bayar,0) - IFNULL(svu.total_voucher,0) ) > 0
                        THEN TIMESTAMPDIFF(MONTH, COALESCE(tp.max_tanggal_bayar, t.tanggal_order), CURRENT_DATE())
                        ELSE 0 END) AS aging_months,
               MIN(t.tanggal_order) AS tanggal_register,
               MAX(COALESCE(tp.max_tanggal_bayar, t.tanggal_order)) AS last_activity,
               SUM(CASE WHEN t.harga_nego > 0 THEN t.harga_nego ELSE t.total_harga END) AS sum_harga
        FROM transaksi t
        LEFT JOIN (
            SELECT kode_transaksi, SUM(jumlah_bayar + IFNULL(bayar_lain,0) + IFNULL(potong_marketing,0)) AS jml_bayar, MAX(tanggal_bayar) AS max_tanggal_bayar
            FROM transaksi_pembayaran
            GROUP BY kode_transaksi
        ) tp ON tp.kode_transaksi = t.kode_transaksi
        LEFT JOIN (
            SELECT kode_transaksi, SUM(voucher_use) AS total_voucher
            FROM sponsor_voucher_use
            GROUP BY kode_transaksi
        ) svu ON svu.kode_transaksi = t.kode_transaksi
        GROUP BY t.kode_customer
    ) t_agg ON t_agg.kode_customer = c.kode_customer
    LEFT JOIN (
        SELECT t.kode_customer, SUM(jumlah_bayar + IFNULL(bayar_lain,0) + IFNULL(potong_marketing,0)) AS sum_bayar
        FROM transaksi t
        INNER JOIN transaksi_pembayaran tp ON tp.kode_transaksi = t.kode_transaksi
        GROUP BY t.kode_customer
    ) tp_agg ON tp_agg.kode_customer = c.kode_customer
    LEFT JOIN (
        SELECT t.kode_customer, SUM(voucher_use) AS sum_voucher
        FROM transaksi t
        INNER JOIN sponsor_voucher_use svu ON svu.kode_transaksi = t.kode_transaksi
        GROUP BY t.kode_customer
    ) svu_agg ON svu_agg.kode_customer = c.kode_customer
    WHERE c.kode_customer IS NOT NULL
    ORDER BY t_agg.tanggal_register DESC, t_agg.last_activity DESC
    LIMIT 20 OFFSET 0
  `;

  console.time('Original full aggregation');
  try {
    await pool.query(sql1);
  } catch(e) { console.error(e.message) }
  console.timeEnd('Original full aggregation');

  const sql2 = `
    SELECT c.kode_customer,
           (
             SELECT IFNULL(SUM((CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) -
              IFNULL((SELECT SUM(jumlah_bayar + IFNULL(bayar_lain,0) + IFNULL(potong_marketing,0)) FROM transaksi_pembayaran WHERE kode_transaksi = t.kode_transaksi), 0) -
              IFNULL((SELECT SUM(voucher_use) FROM sponsor_voucher_use WHERE kode_transaksi = t.kode_transaksi), 0)), 0)
             FROM transaksi t WHERE t.kode_customer = c.kode_customer
           ) AS sisa_total
    FROM (
        SELECT c_inner.kode_customer,
               sort_agg.tanggal_register,
               sort_agg.last_activity
        FROM customer c_inner
        LEFT JOIN (
            SELECT t.kode_customer, MIN(t.tanggal_order) as tanggal_register, MAX(t.tanggal_order) as last_activity
            FROM transaksi t
            GROUP BY t.kode_customer
        ) sort_agg ON sort_agg.kode_customer = c_inner.kode_customer
        WHERE c_inner.kode_customer IS NOT NULL
        ORDER BY sort_agg.tanggal_register DESC, sort_agg.last_activity DESC
        LIMIT 20
    ) c
  `;

  console.time('Patch 4 logic (derived table sort, correlated aggregate)');
  try {
    await pool.query(sql2);
  } catch(e) { console.error(e.message) }
  console.timeEnd('Patch 4 logic (derived table sort, correlated aggregate)');

  const sql3 = `
    SELECT c.kode_customer,
           (
             SELECT IFNULL(SUM((CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) -
              IFNULL((SELECT SUM(jumlah_bayar + IFNULL(bayar_lain,0) + IFNULL(potong_marketing,0)) FROM transaksi_pembayaran WHERE kode_transaksi = t.kode_transaksi), 0) -
              IFNULL((SELECT SUM(voucher_use) FROM sponsor_voucher_use WHERE kode_transaksi = t.kode_transaksi), 0)), 0)
             FROM transaksi t WHERE t.kode_customer = c.kode_customer
           ) AS sisa_total
    FROM customer c
    WHERE c.kode_customer IS NOT NULL
    ORDER BY c.id_customer DESC
    LIMIT 20
  `;

  console.time('Fast logic using ORDER BY id_customer DESC');
  try {
    await pool.query(sql3);
  } catch(e) { console.error(e.message) }
  console.timeEnd('Fast logic using ORDER BY id_customer DESC');

  process.exit(0);
}
run();
