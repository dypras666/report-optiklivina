import dotenv from 'dotenv'
dotenv.config({ path: '../.env' })
dotenv.config()

import { esClient, checkESConnection } from '../src/elasticsearch.js'
import { pool } from '../src/db.js'

async function setupIndex() {
  const indexName = 'optik_customers'
  
  const exists = await esClient.indices.exists({ index: indexName })
  if (exists) {
    console.log(`[ES Sync] Index ${indexName} already exists, deleting it to recreate mapping...`)
    await esClient.indices.delete({ index: indexName })
  }

  console.log(`[ES Sync] Creating index ${indexName}...`)
  await esClient.indices.create({
    index: indexName,
    body: {
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0
      },
      mappings: {
        properties: {
          id_customer: { type: 'keyword' },
          kode_customer: { type: 'keyword' },
          nama_customer: { type: 'text', fields: { keyword: { type: 'keyword', ignore_above: 256 } } },
          no_hp: { type: 'keyword' },
          no_ktp: { type: 'keyword' },
          status_user: { type: 'keyword' },
          blacklist_reason: { type: 'text' },
          alamat_lengkap: { type: 'text' },
          file_ktp: { type: 'keyword' },
          file_kk: { type: 'keyword' },
          cabang: { type: 'keyword' },
          nama_cabang: { type: 'keyword' },
          id_marketing: { type: 'keyword' },
          nama_marketing: { type: 'keyword' },
          dokumen_lengkap: { type: 'boolean' },
          aging_months: { type: 'integer' },
          total_belanja: { type: 'long' },
          total_bayar: { type: 'long' },
          sisa_hutang: { type: 'long' },
          status_pembayaran: { type: 'keyword' },
          created_at: { type: 'date' }
        }
      }
    }
  })
  console.log(`[ES Sync] Index ${indexName} created.`)
}

async function syncAllData() {
  const limit = 5000;
  let offset = 0;
  let totalSynced = 0;
  let lastId = 0;

  console.log('[ES Sync] Starting chunked sync to avoid timeouts...')

  while (true) {
    console.log(`[ES Sync] Fetching customers chunk (id_customer > ${lastId}) LIMIT ${limit}...`)
    
    // 1. Fetch chunk of customers
    const sqlCustomers = `
      SELECT 
        c.id_customer, c.kode_customer, c.nama_customer, c.no_hp, c.no_ktp, c.status_user, c.blacklist_reason, c.alamat_lengkap,
        c.file_ktp, c.file_kk, c.cabang, c.id_marketing, c.tanggal_daftar as created_at,
        cabang_toko.nama_cabang, admin.nama_lengkap AS nama_marketing,
        (c.file_ktp IS NOT NULL AND c.file_ktp <> '' AND c.file_kk IS NOT NULL AND c.file_kk <> '') as dokumen_lengkap
      FROM customer c
      LEFT JOIN cabang_toko ON cabang_toko.id_cabang = c.cabang
      LEFT JOIN admin ON admin.id = c.id_marketing
      WHERE c.id_customer > ?
      ORDER BY c.id_customer ASC
      LIMIT ?
    `
    const [customers] = await pool.query(sqlCustomers, [lastId, limit])
    
    if (customers.length === 0) {
      break;
    }

    lastId = customers[customers.length - 1].id_customer;
    const kodeCustomers = customers.map(c => c.kode_customer).filter(k => k);

    // 2. Fetch stats only for this chunk of customers
    let statsMap = new Map();
    if (kodeCustomers.length > 0) {
      const sqlStats = `
        SELECT 
          tx.kode_customer,
          SUM(CASE WHEN tx.harga_nego > 0 THEN tx.harga_nego ELSE tx.total_harga END) as total_belanja,
          SUM(IFNULL(tp.jml_bayar, 0)) as total_bayar,
          SUM(IFNULL(svu.total_voucher, 0)) as total_voucher,
          MAX(CASE WHEN ((CASE WHEN tx.harga_nego > 0 THEN tx.harga_nego ELSE tx.total_harga END) - IFNULL(tp.jml_bayar,0) - IFNULL(svu.total_voucher,0)) > 0 
                  THEN TIMESTAMPDIFF(MONTH, COALESCE(tp.max_bayar, tx.tanggal_order), CURDATE()) ELSE 0 END) as aging_months
        FROM transaksi tx
        LEFT JOIN (
          SELECT kode_transaksi, SUM(jumlah_bayar + IFNULL(bayar_lain,0) + IFNULL(potong_marketing,0)) AS jml_bayar, MAX(tanggal_bayar) as max_bayar
          FROM transaksi_pembayaran GROUP BY kode_transaksi
        ) tp ON tp.kode_transaksi = tx.kode_transaksi
        LEFT JOIN (
          SELECT kode_transaksi, SUM(voucher_use) AS total_voucher
          FROM sponsor_voucher_use GROUP BY kode_transaksi
        ) svu ON svu.kode_transaksi = tx.kode_transaksi
        WHERE tx.kode_customer IN (?)
        GROUP BY tx.kode_customer
      `
      const [stats] = await pool.query(sqlStats, [kodeCustomers]);
      for (const st of stats) {
        statsMap.set(st.kode_customer, st);
      }
    }

    // 3. Prepare ES operations
    const operations = customers.flatMap(c => {
      const st = statsMap.get(c.kode_customer) || { total_belanja: 0, total_bayar: 0, total_voucher: 0, aging_months: 0 };
      const totalBelanja = Number(st.total_belanja || 0);
      const totalBayar = Number(st.total_bayar || 0) + Number(st.total_voucher || 0);
      const sisaHutang = totalBelanja - totalBayar;
      
      return [
        { index: { _index: 'optik_customers', _id: c.kode_customer } },
        {
          id_customer: c.id_customer,
          kode_customer: c.kode_customer,
          nama_customer: c.nama_customer,
          no_hp: c.no_hp,
          no_ktp: c.no_ktp,
          status_user: c.status_user,
          blacklist_reason: c.blacklist_reason,
          alamat_lengkap: c.alamat_lengkap,
          file_ktp: c.file_ktp,
          file_kk: c.file_kk,
          cabang: c.cabang,
          nama_cabang: c.nama_cabang,
          id_marketing: c.id_marketing,
          nama_marketing: c.nama_marketing,
          dokumen_lengkap: c.dokumen_lengkap === 1,
          aging_months: st.aging_months || 0,
          total_belanja: totalBelanja,
          total_bayar: totalBayar,
          sisa_hutang: sisaHutang,
          status_pembayaran: sisaHutang <= 0 ? 'lunas' : 'belum_lunas',
          created_at: c.created_at ? c.created_at.replace(' ', 'T') + 'Z' : null
        }
      ]
    })

    // 4. Push chunk to ES
    const bulkResponse = await esClient.bulk({ refresh: false, body: operations })
    if (bulkResponse.errors) {
      console.error('[ES Sync] Bulk insert had some errors in this chunk!')
    }
    
    totalSynced += customers.length;
    console.log(`[ES Sync] Pushed ${customers.length} records. (Total so far: ${totalSynced})`)
  }

  // Refresh index to make data searchable immediately
  await esClient.indices.refresh({ index: 'optik_customers' })
  console.log(`[ES Sync] All done! Successfully synced ${totalSynced} customers total.`)
}

async function run() {
  try {
    const isConnected = await checkESConnection()
    if (!isConnected) {
      console.error('[ES Sync] Aborting sync, cannot connect to ES.')
      process.exit(1)
    }
    
    await setupIndex()
    await syncAllData()
    
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

run()
