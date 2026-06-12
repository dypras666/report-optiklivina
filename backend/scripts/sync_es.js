import dotenv from 'dotenv'
dotenv.config()
import { pool } from '../src/db.js'
import { esClient, checkESConnection } from '../src/elasticsearch.js'

const INDEX_NAME = 'optik_customers'

async function setupIndex() {
  const exists = await esClient.indices.exists({ index: INDEX_NAME })
  if (!exists) {
    console.log(`[ES Sync] Creating index ${INDEX_NAME}...`)
    await esClient.indices.create({
      index: INDEX_NAME,
      body: {
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
    console.log(`[ES Sync] Index ${INDEX_NAME} created.`)
  } else {
    console.log(`[ES Sync] Index ${INDEX_NAME} already exists.`)
  }
}

async function syncData() {
  console.log('[ES Sync] Fetching customers from MySQL...')
  const sql = `
    SELECT 
      c.id_customer, c.kode_customer, c.nama_customer, c.no_hp, c.no_ktp, c.status_user, c.blacklist_reason, c.alamat_lengkap,
      c.file_ktp, c.file_kk, c.cabang, c.id_marketing, c.tanggal_daftar as created_at,
      cabang_toko.nama_cabang, admin.nama_lengkap AS nama_marketing,
      (c.file_ktp IS NOT NULL AND c.file_ktp <> '' AND c.file_kk IS NOT NULL AND c.file_kk <> '') as dokumen_lengkap,
      1000000 as total_belanja,
      500000 as total_bayar,
      500000 as sisa_hutang,
      2 as aging_months
    FROM customer c
    LEFT JOIN cabang_toko ON cabang_toko.id_cabang = c.cabang
    LEFT JOIN admin ON admin.id = c.id_marketing
    ORDER BY c.id_customer DESC
    LIMIT 1000
  `
  const [rows] = await pool.query(sql)
  console.log(`[ES Sync] Found ${rows.length} customers to sync.`)

  if (rows.length === 0) return

  const operations = rows.flatMap(doc => [
    { index: { _index: INDEX_NAME, _id: doc.kode_customer } },
    {
      id_customer: doc.id_customer,
      kode_customer: doc.kode_customer,
      nama_customer: doc.nama_customer,
      no_hp: doc.no_hp,
      no_ktp: doc.no_ktp,
      status_user: doc.status_user,
      blacklist_reason: doc.blacklist_reason,
      alamat_lengkap: doc.alamat_lengkap,
      file_ktp: doc.file_ktp,
      file_kk: doc.file_kk,
      cabang: doc.cabang,
      nama_cabang: doc.nama_cabang,
      id_marketing: doc.id_marketing,
      nama_marketing: doc.nama_marketing,
      dokumen_lengkap: doc.dokumen_lengkap === 1,
      aging_months: doc.aging_months || 0,
      total_belanja: doc.total_belanja,
      total_bayar: doc.total_bayar,
      sisa_hutang: doc.sisa_hutang,
      status_pembayaran: doc.sisa_hutang <= 0 ? 'lunas' : 'belum_lunas',
      created_at: doc.created_at ? doc.created_at.replace(' ', 'T') + 'Z' : null
    }
  ])

  console.log('[ES Sync] Pushing to Elasticsearch in chunks...')
  const CHUNK_SIZE = 1000 // 500 documents per chunk (2 ops per doc)
  let hasErrors = false

  for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
    const chunk = operations.slice(i, i + CHUNK_SIZE)
    const bulkResponse = await esClient.bulk({ refresh: true, body: chunk })
    if (bulkResponse.errors) {
      hasErrors = true
      const erroredDocuments = []
      bulkResponse.items.forEach((action, i) => {
        const operation = Object.keys(action)[0]
        if (action[operation].error) {
          erroredDocuments.push({
            status: action[operation].status,
            error: action[operation].error,
            operation: chunk[i * 2],
            document: chunk[i * 2 + 1]
          })
        }
      })
      console.error(JSON.stringify(erroredDocuments[0], null, 2))
    }
    console.log(`[ES Sync] Pushed chunk ${Math.floor(i/CHUNK_SIZE) + 1} / ${Math.ceil(operations.length/CHUNK_SIZE)}`)
  }

  if (hasErrors) {
    console.error('[ES Sync] Bulk insert had some errors.')
  } else {
    console.log(`[ES Sync] Successfully synced ${rows.length} customers.`)
  }
}

async function run() {
  const isConnected = await checkESConnection()
  if (!isConnected) process.exit(1)
  
  await setupIndex()
  await syncData()
  process.exit(0)
}

run()
