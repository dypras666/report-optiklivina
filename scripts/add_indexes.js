import dotenv from 'dotenv'
import mysql from 'mysql2/promise'

dotenv.config()

function log(msg){ console.log(msg) }

async function main(){
  const host = process.env.DB_HOST || 'localhost'
  const user = process.env.DB_USER || 'root'
  const password = process.env.DB_PASS || ''
  const database = process.env.DB_NAME || 'optiklivina_dbs'
  log(`[Indexes] Connecting host=${host} user=${user} db=${database}`)
  const conn = await mysql.createConnection({ host, user, password })
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``)
  await conn.query(`USE \`${database}\``)

  const statements = [
    // transaksi_log
    `ALTER TABLE transaksi_log ADD INDEX idx_tl_prod_cabang_tanggal (jenis_produk, id_produk, id_cabang, tanggal_log)`,
    `ALTER TABLE transaksi_log ADD INDEX idx_tl_grosir (id_grosir)`,
    // grosir_log
    `ALTER TABLE grosir_log ADD INDEX idx_gl_prod_grosir_tanggal (jenis_produk, id_produk, id_grosir, tanggal_log)`,
    `ALTER TABLE grosir_log ADD INDEX idx_gl_prod_cabang_tanggal (jenis_produk, id_produk, id_cabang, tanggal_log)`,
    // transaksi
    `ALTER TABLE transaksi ADD INDEX idx_transaksi_id (id_transaksi)`,
    `ALTER TABLE transaksi ADD INDEX idx_transaksi_kode (kode_transaksi)`,
    `ALTER TABLE transaksi ADD INDEX idx_transaksi_cabang (id_cabang)`,
    // grosir
    `ALTER TABLE grosir ADD INDEX idx_grosir_kode (kode_grosir)`,
    `ALTER TABLE grosir ADD INDEX idx_grosir_cabang (id_cabang)`,
    // stok cabang
    `ALTER TABLE produk_stok_cabang ADD INDEX idx_psc_produk_cabang (id_produk, id_cabang)`,
    `ALTER TABLE softlens_stok_cabang ADD INDEX idx_ssc_softlens_cabang (id_softlens, id_cabang)`,
    `ALTER TABLE frame_stok_cabang ADD INDEX idx_fsc_frame_cabang (id_frame, id_cabang)`,
    `ALTER TABLE lensa_stok_cabang ADD INDEX idx_lsc_lensa_cabang (id_lensa, id_cabang)`
    ,
    // transaksi item tables
    `ALTER TABLE transaksi_barang ADD INDEX idx_tb_produk_kode (id_produk, kode_transaksi)`,
    `ALTER TABLE transaksi_frame ADD INDEX idx_tf_frame_kode (id_frame, kode_transaksi)`,
    `ALTER TABLE transaksi_lensa ADD INDEX idx_tlensa_lensa_kode (id_lensa, kode_transaksi)`,
    // asset_status
    `ALTER TABLE asset_status ADD UNIQUE INDEX idx_asset_status (jenis, product_id)`,
    // master tables
    `ALTER TABLE produk ADD INDEX idx_produk_sku (sku_katalog)`,
    `ALTER TABLE produk ADD INDEX idx_produk_nama (nama_produk)`,
    `ALTER TABLE softlens ADD INDEX idx_softlens_sku (sku_softlens)`,
    `ALTER TABLE softlens ADD INDEX idx_softlens_nama (nama_softlens)`,
    `ALTER TABLE frame ADD INDEX idx_frame_sku (sku_frame)`,
    `ALTER TABLE frame ADD INDEX idx_frame_kat (id_kat_frame)`,
    `ALTER TABLE lensa ADD INDEX idx_lensa_sku (sku_lensa)`,
    `ALTER TABLE lensa ADD INDEX idx_lensa_kat (id_lensa_kat)`,
    `ALTER TABLE lensa ADD INDEX idx_lensa_size (size)`
    ,
    // pembayaran & marketing
    `ALTER TABLE transaksi_pembayaran ADD INDEX idx_tp_id_marketing_tanggal (id_marketing, tanggal_bayar)`,
    `ALTER TABLE transaksi_pembayaran ADD INDEX idx_tp_jenis_transaksi (jenis_transaksi)`,
    `ALTER TABLE transaksi_pembayaran ADD INDEX idx_tp_tipe_bayar (tipe_bayar)`,
    `ALTER TABLE transaksi_pembayaran ADD INDEX idx_tp_kode_transaksi (kode_transaksi)`,
    // transaksi tambahan
    `ALTER TABLE transaksi ADD INDEX idx_transaksi_marketing_tanggal (id_marketing, tanggal_order)`,
    `ALTER TABLE transaksi ADD INDEX idx_transaksi_jenis_beli (jenis_beli)`,
    // garansi
    `ALTER TABLE grosir_garansi_log ADD INDEX idx_ggl_tanggal_log (tanggal_log)`,
    `ALTER TABLE grosir_garansi_log ADD INDEX idx_ggl_jenis_produk (jenis_produk)`,
    `ALTER TABLE grosir_garansi_log ADD INDEX idx_ggl_id_grosir (id_grosir)`,
    // grosir tambahan
    `ALTER TABLE grosir ADD INDEX idx_grosir_tipe_transaksi (tipe_transaksi)`,
    // grosir pembayaran
    `ALTER TABLE grosir_pembayaran ADD INDEX idx_gp_kode_grosir (kode_grosir)`,
    `ALTER TABLE grosir_pembayaran ADD INDEX idx_gp_id_cabang_tanggal (id_cabang, tanggal_bayar)`
  ]

  for(const sql of statements){
    try{
      await conn.query(sql)
      log(`[Indexes] OK: ${sql}`)
    }catch(e){
      const code = e?.code || ''
      const msg = e?.sqlMessage || e?.message || String(e)
      if (code === 'ER_DUP_KEYNAME' || /Duplicate key name/i.test(msg) || /already exists/i.test(msg)){
        log(`[Indexes] SKIP (exists): ${sql}`)
      }else{
        log(`[Indexes] ERROR: ${msg}`)
      }
    }
  }

  await conn.end()
  log('[Indexes] Done')
}

main().catch(e => { console.error(e); process.exit(1) })
