import { pool } from '../db.js'
import { getActivePembukuan, getPreviousPembukuan } from './pembukuanService.js'
import { fetchMarketingReports } from './reportsService.js'
import supabase from '../config/supabase.js'

export async function fetchProfitLossReport({ pembukuanId, cabangId, marketingId }){
  const active = await getActivePembukuan(pembukuanId)
  if(!active) return { omset_toko: 0, omset_marketing: 0, modal: 0, ongkir: 0, pengeluaran: 0, laba: 0, rugi: 0, laba_bersih: 0 }

  const paramsPeriod = [active.tanggal_buka_buku, active.tanggal_tutup_buku]
  const paramsCabang = []
  if (cabangId) paramsCabang.push(cabangId)

  const [omsetTokoRows] = await pool.query(
    `SELECT SUM(IFNULL(gp.jumlah_bayar,0)) AS total_omset
     FROM grosir_pembayaran gp
       JOIN grosir g ON g.kode_grosir = gp.kode_grosir AND g.id_cabang = gp.id_cabang
     WHERE gp.tanggal_bayar BETWEEN ? AND ?${cabangId ? ' AND gp.id_cabang = ?' : ''}`,
    [...paramsPeriod, ...paramsCabang]
  )

  const paramsMk = [active.tanggal_buka_buku, active.tanggal_tutup_buku]
  if (cabangId) paramsMk.push(cabangId)
  if (marketingId) paramsMk.push(marketingId)
  const whereCabang = cabangId ? ' AND t.id_cabang = ?' : ''
  const whereMarketing = marketingId ? ' AND t.id_marketing = ?' : ''
  const [mkOmsetRows] = await pool.query(
    `SELECT SUM(IFNULL(p.jumlah_bayar,0)) AS total_mk_bayar
     FROM transaksi_pembayaran p
       LEFT JOIN transaksi t ON t.kode_transaksi = p.kode_transaksi
     WHERE p.tanggal_bayar BETWEEN ? AND ?${whereCabang}${whereMarketing}`,
    paramsMk
  )

  const [modalOngkirTokoRows] = await pool.query(
    `SELECT 
        SUM(
          CASE grosir_log.jenis_produk
            WHEN 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = grosir_log.id_produk) * grosir_log.jumlah
            WHEN 'lensa'    THEN (SELECT harga_modal FROM lensa    WHERE lensa.id_lensa = grosir_log.id_produk) * grosir_log.jumlah
            WHEN 'frame'    THEN (SELECT harga_modal FROM frame    WHERE frame.id_frame = grosir_log.id_produk) * grosir_log.jumlah
            WHEN 'katalog'  THEN (SELECT harga_modal FROM produk   WHERE produk.id_produk = grosir_log.id_produk) * grosir_log.jumlah
            ELSE 0 END
        ) AS sum_modal,
        SUM(
          CASE grosir_log.jenis_produk
            WHEN 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = grosir_log.id_produk) * grosir_log.jumlah
            WHEN 'lensa'    THEN (SELECT harga_ongkir FROM lensa    WHERE lensa.id_lensa = grosir_log.id_produk) * grosir_log.jumlah
            WHEN 'frame'    THEN (SELECT harga_ongkir FROM frame    WHERE frame.id_frame = grosir_log.id_produk) * grosir_log.jumlah
            WHEN 'katalog'  THEN (SELECT harga_ongkir FROM produk   WHERE produk.id_produk = grosir_log.id_produk) * grosir_log.jumlah
            ELSE 0 END
        ) AS sum_ongkir
     FROM grosir_log
     WHERE grosir_log.tanggal_log BETWEEN ? AND ?${cabangId ? ' AND grosir_log.id_cabang = ?' : ''}`,
    [...paramsPeriod, ...paramsCabang]
  )

  const [pengeluaranRows] = await pool.query(
    `SELECT SUM(IFNULL(total_modal,0)) AS total_pengeluaran
     FROM modal
     WHERE tanggal_modal BETWEEN ? AND ?${cabangId ? ' AND id_cabang = ?' : ''}`,
    [...paramsPeriod, ...paramsCabang]
  )

  const omset_toko = Number(omsetTokoRows?.[0]?.total_omset || 0)
  const omset_marketing = Number(mkOmsetRows?.[0]?.total_mk_bayar || 0)

  const paramsMkItems = [active.tanggal_buka_buku, active.tanggal_tutup_buku, active.tanggal_buka_buku, active.tanggal_tutup_buku]
  const whereCabangMk = cabangId ? ' AND transaksi.id_cabang = ?' : ''
  const whereMarketingMk = marketingId ? ' AND transaksi.id_marketing = ?' : ''
  if (cabangId) paramsMkItems.push(cabangId)
  if (marketingId) paramsMkItems.push(marketingId)
  const [mkItemsAggRows] = await pool.query(
    `SELECT 
        SUM((CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END)) AS sum_fix_harga,
        SUM(IFNULL(it.sum_ongkir,0)) AS sum_ongkir_items,
        SUM(COALESCE((CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) - (IFNULL(it.sum_modal,0) + IFNULL(it.sum_ongkir,0)), 0)) AS sum_laba_items
     FROM transaksi
       LEFT JOIN (
         SELECT id_grosir,
                SUM(
                  CASE jenis_produk
                    WHEN 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = transaksi_log.id_produk) * jumlah
                    WHEN 'lensa'    THEN (SELECT harga_modal FROM lensa    WHERE lensa.id_lensa = transaksi_log.id_produk) * jumlah
                    WHEN 'frame'    THEN (SELECT harga_modal FROM frame    WHERE frame.id_frame = transaksi_log.id_produk) * jumlah
                    WHEN 'katalog'  THEN (SELECT harga_modal FROM produk   WHERE produk.id_produk = transaksi_log.id_produk) * jumlah
                    ELSE 0
                  END
                ) AS sum_modal,
                SUM(
                  CASE jenis_produk
                    WHEN 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = transaksi_log.id_produk) * jumlah
                    WHEN 'lensa'    THEN (SELECT harga_ongkir FROM lensa    WHERE lensa.id_lensa = transaksi_log.id_produk) * jumlah
                    WHEN 'frame'    THEN (SELECT harga_ongkir FROM frame    WHERE frame.id_frame = transaksi_log.id_produk) * jumlah
                    WHEN 'katalog'  THEN (SELECT harga_ongkir FROM produk   WHERE produk.id_produk = transaksi_log.id_produk) * jumlah
                    ELSE 0
                  END
                ) AS sum_ongkir
         FROM transaksi_log
         WHERE transaksi_log.tanggal_log BETWEEN ? AND ?
         GROUP BY id_grosir
       ) it ON it.id_grosir = transaksi.kode_transaksi OR it.id_grosir = transaksi.id_transaksi
     WHERE transaksi.tanggal_order BETWEEN ? AND ?${whereCabangMk}${whereMarketingMk}`,
    paramsMkItems
  )
  const mk_fix = Number(mkItemsAggRows?.[0]?.sum_fix_harga || 0)
  const mk_laba_items = Number(mkItemsAggRows?.[0]?.sum_laba_items || 0)
  const mk_ongkir = Number(mkItemsAggRows?.[0]?.sum_ongkir_items || 0)
  const mk_modal = Math.max(0, mk_fix - mk_laba_items - mk_ongkir)
  const toko_modal = Number(modalOngkirTokoRows?.[0]?.sum_modal || 0)
  const toko_ongkir = Number(modalOngkirTokoRows?.[0]?.sum_ongkir || 0)
  const modal = mk_modal + toko_modal
  const ongkir = mk_ongkir + toko_ongkir
  const pengeluaran = Number(pengeluaranRows?.[0]?.total_pengeluaran || 0)
  const gross = omset_toko + omset_marketing
  const operational = modal + ongkir + pengeluaran
  const net = gross - operational
  const laba = net > 0 ? net : 0
  const rugi = net < 0 ? -net : 0
  const laba_bersih = net
  return { omset_toko, omset_marketing, modal, ongkir, pengeluaran, laba, rugi, laba_bersih }
}

export async function upsertProfitLossToSupabase({ pembukuanId, cabangId, marketingId }){
  const current = await fetchProfitLossReport({ pembukuanId, cabangId, marketingId })
  const payload = {
    pembukuan_id: Number(pembukuanId||0),
    cabang_id: cabangId ? Number(cabangId) : null,
    marketing_id: marketingId ? Number(marketingId) : null,
    laba_bersih: Number(current?.laba_bersih||0),
    created_at: new Date().toISOString()
  }
  const { data, error } = await supabase
    .from('profit_loss_summaries')
    .upsert(payload, { onConflict: 'pembukuan_id,cabang_id,marketing_id' })
    .select()
  if (error) throw new Error(error.message || 'supabase error')
  return { data: Array.isArray(data) ? data[0] : data }
}

export async function fetchProfitLossFromSupabase({ pembukuanId, cabangId, marketingId }){
  const query = supabase
    .from('profit_loss_summaries')
    .select('*')
    .eq('pembukuan_id', Number(pembukuanId||0))
  if (cabangId) query.eq('cabang_id', Number(cabangId))
  else query.is('cabang_id', null)
  if (marketingId) query.eq('marketing_id', Number(marketingId))
  else query.is('marketing_id', null)
  const { data, error } = await query.limit(1)
  if (error) throw new Error(error.message || 'supabase error')
  return { data: Array.isArray(data) ? (data[0] || null) : null }
}

export async function compareWithPrevious({ pembukuanId, cabangId, marketingId }){
  const current = await fetchProfitLossReport({ pembukuanId, cabangId, marketingId })
  const prev = await getPreviousPembukuan(pembukuanId)
  let prevNet = null
  if (prev && prev.id_toko_tutup){
    try{
      const got = await fetchProfitLossFromSupabase({ pembukuanId: prev.id_toko_tutup, cabangId, marketingId })
      if (got?.data && Number.isFinite(Number(got.data.laba_bersih))){
        prevNet = { pembukuan_id: prev.id_toko_tutup, laba_bersih: Number(got.data.laba_bersih||0) }
      }else{
        const prevCalc = await fetchProfitLossReport({ pembukuanId: prev.id_toko_tutup, cabangId, marketingId })
        prevNet = { pembukuan_id: prev.id_toko_tutup, laba_bersih: Number(prevCalc?.laba_bersih||0) }
      }
    }catch{
      const prevCalc = await fetchProfitLossReport({ pembukuanId: prev.id_toko_tutup, cabangId, marketingId })
      prevNet = { pembukuan_id: prev.id_toko_tutup, laba_bersih: Number(prevCalc?.laba_bersih||0) }
    }
  }
  return { current, previous: prevNet }
}

export async function fetchProfitLossByCabang({ pembukuanId }){
  const active = await getActivePembukuan(pembukuanId)
  if(!active) return []
  const paramsPeriod = [active.tanggal_buka_buku, active.tanggal_tutup_buku]

  const [cabangRows] = await pool.query(`SELECT id_cabang, nama_cabang FROM cabang_toko`)
  const cabangNameMap = new Map(cabangRows.map(r => [Number(r.id_cabang), r.nama_cabang]))

  const [omsetToko] = await pool.query(
    `SELECT gp.id_cabang, SUM(IFNULL(gp.jumlah_bayar,0)) AS omset_toko
     FROM grosir_pembayaran gp
     WHERE gp.tanggal_bayar BETWEEN ? AND ?
     GROUP BY gp.id_cabang`, paramsPeriod)

  const [mkOmset] = await pool.query(
    `SELECT transaksi.id_cabang, SUM(IFNULL(tp.jumlah_bayar,0)) AS omset_marketing,
            SUM((CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END)) AS fix_harga,
            SUM(COALESCE((CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) - IFNULL(it.sum_modal,0), 0)) AS laba_items
     FROM transaksi
       LEFT JOIN (
         SELECT kode_transaksi, SUM(jumlah_bayar) AS jumlah_bayar
         FROM transaksi_pembayaran
         WHERE tanggal_bayar BETWEEN ? AND ?
         GROUP BY kode_transaksi
       ) tp ON tp.kode_transaksi = transaksi.kode_transaksi
       LEFT JOIN (
         SELECT id_grosir,
                SUM(
                  CASE jenis_produk
                    WHEN 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = transaksi_log.id_produk) * jumlah
                    WHEN 'lensa'    THEN (SELECT harga_modal FROM lensa    WHERE lensa.id_lensa = transaksi_log.id_produk) * jumlah
                    WHEN 'frame'    THEN (SELECT harga_modal FROM frame    WHERE frame.id_frame = transaksi_log.id_produk) * jumlah
                    WHEN 'katalog'  THEN (SELECT harga_modal FROM produk   WHERE produk.id_produk = transaksi_log.id_produk) * jumlah
                    ELSE 0
                  END
                ) AS sum_modal
         FROM transaksi_log
         WHERE transaksi_log.tanggal_log BETWEEN ? AND ?
         GROUP BY id_grosir
       ) it ON it.id_grosir = transaksi.kode_transaksi OR it.id_grosir = transaksi.id_transaksi
     WHERE transaksi.tanggal_order BETWEEN ? AND ?
      GROUP BY transaksi.id_cabang`, [...paramsPeriod, ...paramsPeriod, ...paramsPeriod])

  const [mkPayCabang] = await pool.query(
    `SELECT t.id_cabang, SUM(IFNULL(p.jumlah_bayar,0)) AS omset_marketing
     FROM transaksi_pembayaran p
       LEFT JOIN transaksi t ON t.kode_transaksi = p.kode_transaksi
     WHERE p.tanggal_bayar BETWEEN ? AND ?
     GROUP BY t.id_cabang`, paramsPeriod)

  const [mkLabaStatus] = await pool.query(
    `SELECT transaksi.id_cabang,
            SUM(CASE WHEN ((CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) - IFNULL(tp.jumlah_bayar,0)) <= 0 
                     THEN COALESCE((CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) - (IFNULL(it.sum_modal,0) + IFNULL(it.sum_ongkir,0)), 0) ELSE 0 END) AS laba_aktual,
            SUM(CASE WHEN ( (CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) - IFNULL(tp.jumlah_bayar,0) ) > 0
                     THEN ((IFNULL(tp.jumlah_bayar,0) + 0.0) / (CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END))
                          * COALESCE((CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) - (IFNULL(it.sum_modal,0) + IFNULL(it.sum_ongkir,0)), 0)
                     ELSE 0 END) AS laba_estimasi,
            SUM(COALESCE((CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) - (IFNULL(it.sum_modal,0) + IFNULL(it.sum_ongkir,0)), 0)) AS laba_akumulasi
     FROM transaksi
       LEFT JOIN (
         SELECT kode_transaksi, SUM(jumlah_bayar) AS jumlah_bayar
         FROM transaksi_pembayaran
         WHERE tanggal_bayar BETWEEN ? AND ?
         GROUP BY kode_transaksi
       ) tp ON tp.kode_transaksi = transaksi.kode_transaksi
       LEFT JOIN (
         SELECT id_grosir,
                SUM(
                  CASE jenis_produk
                    WHEN 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = transaksi_log.id_produk) * jumlah
                    WHEN 'lensa'    THEN (SELECT harga_modal FROM lensa    WHERE lensa.id_lensa = transaksi_log.id_produk) * jumlah
                    WHEN 'frame'    THEN (SELECT harga_modal FROM frame    WHERE frame.id_frame = transaksi_log.id_produk) * jumlah
                    WHEN 'katalog'  THEN (SELECT harga_modal FROM produk   WHERE produk.id_produk = transaksi_log.id_produk) * jumlah
                    ELSE 0
                  END
                ) AS sum_modal,
                SUM(
                  CASE jenis_produk
                    WHEN 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = transaksi_log.id_produk) * jumlah
                    WHEN 'lensa'    THEN (SELECT harga_ongkir FROM lensa    WHERE lensa.id_lensa = transaksi_log.id_produk) * jumlah
                    WHEN 'frame'    THEN (SELECT harga_ongkir FROM frame    WHERE frame.id_frame = transaksi_log.id_produk) * jumlah
                    WHEN 'katalog'  THEN (SELECT harga_ongkir FROM produk   WHERE produk.id_produk = transaksi_log.id_produk) * jumlah
                    ELSE 0
                  END
                ) AS sum_ongkir
         FROM transaksi_log
         WHERE transaksi_log.tanggal_log BETWEEN ? AND ?
         GROUP BY id_grosir
       ) it ON it.id_grosir = transaksi.kode_transaksi OR it.id_grosir = transaksi.id_transaksi
     WHERE transaksi.tanggal_order BETWEEN ? AND ?
      GROUP BY transaksi.id_cabang`, [...paramsPeriod, ...paramsPeriod, ...paramsPeriod])

  const [mkOngkir] = await pool.query(
    `SELECT transaksi.id_cabang,
            SUM(CASE 
              WHEN transaksi_log.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = transaksi_log.id_produk) * transaksi_log.jumlah
              WHEN transaksi_log.jenis_produk = 'lensa'    THEN (SELECT harga_ongkir FROM lensa    WHERE lensa.id_lensa = transaksi_log.id_produk) * transaksi_log.jumlah
              WHEN transaksi_log.jenis_produk = 'frame'    THEN (SELECT harga_ongkir FROM frame    WHERE frame.id_frame = transaksi_log.id_produk) * transaksi_log.jumlah
              WHEN transaksi_log.jenis_produk = 'katalog'  THEN (SELECT harga_ongkir FROM produk   WHERE produk.id_produk = transaksi_log.id_produk) * transaksi_log.jumlah
              ELSE 0 END) AS ongkir_marketing
     FROM transaksi_log 
       LEFT JOIN transaksi ON transaksi.id_transaksi = transaksi_log.id_grosir OR transaksi.kode_transaksi = transaksi_log.id_grosir
     WHERE transaksi_log.tanggal_log BETWEEN ? AND ?
     GROUP BY transaksi.id_cabang`, paramsPeriod)

  const [tokoModalOngkir] = await pool.query(
    `SELECT grosir_log.id_cabang,
            SUM(CASE 
              WHEN grosir_log.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = grosir_log.id_produk) * grosir_log.jumlah
              WHEN grosir_log.jenis_produk = 'lensa'    THEN (SELECT harga_modal FROM lensa    WHERE lensa.id_lensa = grosir_log.id_produk) * grosir_log.jumlah
              WHEN grosir_log.jenis_produk = 'frame'    THEN (SELECT harga_modal FROM frame    WHERE frame.id_frame = grosir_log.id_produk) * grosir_log.jumlah
              WHEN grosir_log.jenis_produk = 'katalog'  THEN (SELECT harga_modal FROM produk   WHERE produk.id_produk = grosir_log.id_produk) * grosir_log.jumlah
              ELSE 0 END) AS modal_toko,
            SUM(CASE 
              WHEN grosir_log.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = grosir_log.id_produk) * grosir_log.jumlah
              WHEN grosir_log.jenis_produk = 'lensa'    THEN (SELECT harga_ongkir FROM lensa    WHERE lensa.id_lensa = grosir_log.id_produk) * grosir_log.jumlah
              WHEN grosir_log.jenis_produk = 'frame'    THEN (SELECT harga_ongkir FROM frame    WHERE frame.id_frame = grosir_log.id_produk) * grosir_log.jumlah
              WHEN grosir_log.jenis_produk = 'katalog'  THEN (SELECT harga_ongkir FROM produk   WHERE produk.id_produk = grosir_log.id_produk) * grosir_log.jumlah
              ELSE 0 END) AS ongkir_toko
     FROM grosir_log
     WHERE grosir_log.tanggal_log BETWEEN ? AND ?
     GROUP BY grosir_log.id_cabang`, paramsPeriod)

  const [pengeluaran] = await pool.query(
    `SELECT id_cabang, SUM(IFNULL(total_modal,0)) AS pengeluaran
     FROM modal
     WHERE tanggal_modal BETWEEN ? AND ?
     GROUP BY id_cabang`, paramsPeriod)

  const tMap = new Map(omsetToko.map(r=>[Number(r.id_cabang), r]))
  const mkMap = new Map(mkOmset.map(r=>[Number(r.id_cabang), r]))
  const mkPayMap = new Map(mkPayCabang.map(r=>[Number(r.id_cabang), r]))
  const mkOMap = new Map(mkOngkir.map(r=>[Number(r.id_cabang), r]))
  const mkLSMap = new Map(mkLabaStatus.map(r=>[Number(r.id_cabang), r]))
  const toMap = new Map(tokoModalOngkir.map(r=>[Number(r.id_cabang), r]))
  const pMap = new Map(pengeluaran.map(r=>[Number(r.id_cabang), r]))
  const ids = new Set([...tMap.keys(), ...mkMap.keys(), ...mkOMap.keys(), ...toMap.keys(), ...pMap.keys()])
  const out = []
  for(const id of ids){
    const nama = cabangNameMap.get(id) || String(id)
    const omset_toko = Number(tMap.get(id)?.omset_toko || 0)
    const omset_marketing = Number(mkPayMap.get(id)?.omset_marketing || 0)
    const fix = Number(mkMap.get(id)?.fix_harga || 0)
    const laba_items = Number(mkMap.get(id)?.laba_items || 0)
    const ongkir_marketing = Number(mkOMap.get(id)?.ongkir_marketing || 0)
    const modal_marketing = Math.max(0, fix - laba_items - ongkir_marketing)
    const modal_toko = Number(toMap.get(id)?.modal_toko || 0)
    const ongkir_toko = Number(toMap.get(id)?.ongkir_toko || 0)
    const peng = Number(pMap.get(id)?.pengeluaran || 0)
    const modal = modal_marketing + modal_toko
    const ongkir = ongkir_marketing + ongkir_toko
    const total_omset = omset_toko + omset_marketing
    const omset_bersih = total_omset - peng
    const total_laba = omset_bersih - modal - ongkir
    const laba_aktual = Number(mkLSMap.get(id)?.laba_aktual || 0)
    const laba_estimasi = Number(mkLSMap.get(id)?.laba_estimasi || 0)
    const laba_akumulasi = Number(mkLSMap.get(id)?.laba_akumulasi || 0)
    out.push({ id_cabang: id, nama_cabang: nama, omset_toko, omset_marketing, total_omset, modal, ongkir, pengeluaran: peng, omset_bersih, total_laba, laba_aktual, laba_estimasi, laba_akumulasi })
  }
  out.sort((a,b)=>(b.total_omset)-(a.total_omset))
  return out
}