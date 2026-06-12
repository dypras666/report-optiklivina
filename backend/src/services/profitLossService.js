import { pool } from '../db.js'
import { getActivePembukuan, getPreviousPembukuan } from './pembukuanService.js'
import { esClient } from '../elasticsearch.js'
import supabase from '../config/supabase.js'

export async function fetchProfitLossReport({ pembukuanId, cabangId, marketingId }) {
  const active = await getActivePembukuan(pembukuanId)
  if (!active) return { omset_toko: 0, omset_marketing: 0, modal: 0, ongkir: 0, pengeluaran: 0, laba: 0, rugi: 0, laba_bersih: 0 }

  const pbId = active.id_toko_tutup

  // 1. Marketing ES Aggregation
  const mustMk = [{ term: { id_pembukuan: pbId } }]
  if (cabangId) mustMk.push({ term: { id_cabang: String(cabangId) } })
  if (marketingId) mustMk.push({ term: { id_marketing: String(marketingId) } })

  const mkRes = await esClient.search({
    index: 'optik_marketing_reports',
    size: 0,
    body: {
      query: { bool: { must: mustMk } },
      aggs: {
        omset_marketing: { sum: { field: 'jml_bayar' } },
        fix_harga: { sum: { field: 'fix_harga' } },
        ongkir_marketing: { sum: { field: 'ongkir_items' } },
        laba_items: { sum: { field: 'laba_items' } }
      }
    }
  })
  const mkAggs = mkRes.aggregations
  const omset_marketing = mkAggs.omset_marketing.value || 0
  const mk_fix = mkAggs.fix_harga.value || 0
  const mk_ongkir = mkAggs.ongkir_marketing.value || 0
  const mk_laba_items = mkAggs.laba_items.value || 0
  const mk_modal = Math.max(0, mk_fix - mk_laba_items - mk_ongkir)

  // 2. Toko ES Aggregation (Toko doesn't have marketingId)
  let omset_toko = 0, toko_modal = 0, toko_ongkir = 0
  if (!marketingId) {
    const mustTk = [{ term: { id_pembukuan: pbId } }]
    if (cabangId) mustTk.push({ term: { id_cabang: String(cabangId) } })

    const tkRes = await esClient.search({
      index: 'optik_toko_reports',
      size: 0,
      body: {
        query: { bool: { must: mustTk } },
        aggs: {
          omset_toko: { sum: { field: 'jml_bayar' } },
          modal_toko: { sum: { field: 'modal_toko' } },
          ongkir_toko: { sum: { field: 'ongkir_toko' } }
        }
      }
    })
    const tkAggs = tkRes.aggregations
    omset_toko = tkAggs.omset_toko.value || 0
    toko_modal = tkAggs.modal_toko.value || 0
    toko_ongkir = tkAggs.ongkir_toko.value || 0
  }

  // 3. Pengeluaran (MySQL `modal` table)
  const paramsPeriod = [active.tanggal_buka_buku, active.tanggal_tutup_buku]
  const [pengeluaranRows] = await pool.query(
    `SELECT SUM(IFNULL(total_modal,0)) AS total_pengeluaran
     FROM modal
     WHERE tanggal_modal BETWEEN ? AND ?${cabangId ? ' AND id_cabang = ?' : ''}`,
    cabangId ? [...paramsPeriod, cabangId] : paramsPeriod
  )
  const pengeluaran = Number(pengeluaranRows?.[0]?.total_pengeluaran || 0)

  // 4. Calculate Final
  const modal = mk_modal + toko_modal
  const ongkir = mk_ongkir + toko_ongkir
  const gross = omset_toko + omset_marketing
  const operational = modal + ongkir + pengeluaran
  const net = gross - operational
  const laba = net > 0 ? net : 0
  const rugi = net < 0 ? -net : 0
  const laba_bersih = net

  return { omset_toko, omset_marketing, modal, ongkir, pengeluaran, laba, rugi, laba_bersih }
}

export async function fetchProfitLossByCabang({ pembukuanId }) {
  const active = await getActivePembukuan(pembukuanId)
  if (!active) return []
  const pbId = active.id_toko_tutup
  const paramsPeriod = [active.tanggal_buka_buku, active.tanggal_tutup_buku]

  const [cabangRows] = await pool.query(`SELECT id_cabang, nama_cabang FROM cabang_toko`)
  const cabangNameMap = new Map(cabangRows.map(r => [String(r.id_cabang), r.nama_cabang]))
  
  // Initialize output map
  const cabangMap = new Map()
  for (const c of cabangRows) {
    cabangMap.set(String(c.id_cabang), {
      id_cabang: Number(c.id_cabang),
      nama_cabang: c.nama_cabang,
      omset_toko: 0, omset_marketing: 0, total_omset: 0,
      modal: 0, ongkir: 0, pengeluaran: 0, omset_bersih: 0, total_laba: 0,
      laba_aktual: 0, laba_estimasi: 0, laba_akumulasi: 0,
      _mk_fix: 0, _mk_laba_items: 0, _mk_ongkir: 0,
      _tk_modal: 0, _tk_ongkir: 0
    })
  }

  // Marketing ES Aggregation by id_cabang
  const mkRes = await esClient.search({
    index: 'optik_marketing_reports',
    size: 0,
    body: {
      query: { term: { id_pembukuan: pbId } },
      aggs: {
        by_cabang: {
          terms: { field: 'id_cabang', size: 1000 },
          aggs: {
            omset_marketing: { sum: { field: 'jml_bayar' } },
            fix_harga: { sum: { field: 'fix_harga' } },
            ongkir_marketing: { sum: { field: 'ongkir_items' } },
            laba_items: { sum: { field: 'laba_items' } },
            laba_aktual: { sum: { field: 'laba_paid' } }, // laba_paid represents aktual
            laba_estimasi: { sum: { field: 'laba_est' } },
            laba_akumulasi: { sum: { field: 'laba_items' } }
          }
        }
      }
    }
  })
  
  for (const b of mkRes.aggregations.by_cabang.buckets) {
    const id = b.key
    if (!cabangMap.has(id)) continue
    const c = cabangMap.get(id)
    c.omset_marketing = b.omset_marketing.value || 0
    c._mk_fix = b.fix_harga.value || 0
    c._mk_ongkir = b.ongkir_marketing.value || 0
    c._mk_laba_items = b.laba_items.value || 0
    c.laba_aktual = b.laba_aktual.value || 0
    c.laba_estimasi = b.laba_estimasi.value || 0
    c.laba_akumulasi = b.laba_akumulasi.value || 0
  }

  // Toko ES Aggregation by id_cabang
  const tkRes = await esClient.search({
    index: 'optik_toko_reports',
    size: 0,
    body: {
      query: { term: { id_pembukuan: pbId } },
      aggs: {
        by_cabang: {
          terms: { field: 'id_cabang', size: 1000 },
          aggs: {
            omset_toko: { sum: { field: 'jml_bayar' } },
            modal_toko: { sum: { field: 'modal_toko' } },
            ongkir_toko: { sum: { field: 'ongkir_toko' } }
          }
        }
      }
    }
  })

  for (const b of tkRes.aggregations.by_cabang.buckets) {
    const id = b.key
    if (!cabangMap.has(id)) continue
    const c = cabangMap.get(id)
    c.omset_toko = b.omset_toko.value || 0
    c._tk_modal = b.modal_toko.value || 0
    c._tk_ongkir = b.ongkir_toko.value || 0
  }

  // Pengeluaran (MySQL)
  const [pengeluaran] = await pool.query(
    `SELECT id_cabang, SUM(IFNULL(total_modal,0)) AS pengeluaran
     FROM modal
     WHERE tanggal_modal BETWEEN ? AND ?
     GROUP BY id_cabang`, paramsPeriod)

  for (const p of pengeluaran) {
    const id = String(p.id_cabang)
    if (cabangMap.has(id)) {
      cabangMap.get(id).pengeluaran = Number(p.pengeluaran || 0)
    }
  }

  // Final Calculations
  const out = []
  for (const c of cabangMap.values()) {
    c.total_omset = c.omset_toko + c.omset_marketing
    c.modal = Math.max(0, c._mk_fix - c._mk_laba_items - c._mk_ongkir) + c._tk_modal
    c.ongkir = c._mk_ongkir + c._tk_ongkir
    c.omset_bersih = c.total_omset - c.pengeluaran
    c.total_laba = c.omset_bersih - c.modal - c.ongkir
    
    // Cleanup temporary fields
    delete c._mk_fix
    delete c._mk_laba_items
    delete c._mk_ongkir
    delete c._tk_modal
    delete c._tk_ongkir

    out.push(c)
  }

  out.sort((a,b) => b.total_omset - a.total_omset)
  return out
}

export async function upsertProfitLossToSupabase({ pembukuanId, cabangId, marketingId }) {
  const current = await fetchProfitLossReport({ pembukuanId, cabangId, marketingId })
  const payload = {
    pembukuan_id: Number(pembukuanId||0),
    cabang_id: cabangId ? Number(cabangId) : 0,
    marketing_id: marketingId ? Number(marketingId) : 0,
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

export async function fetchProfitLossFromSupabase({ pembukuanId, cabangId, marketingId }) {
  const query = supabase
    .from('profit_loss_summaries')
    .select('*')
    .eq('pembukuan_id', Number(pembukuanId||0))
  query.eq('cabang_id', cabangId ? Number(cabangId) : 0)
  query.eq('marketing_id', marketingId ? Number(marketingId) : 0)
  const { data, error } = await query.limit(1)
  if (error) throw new Error(error.message || 'supabase error')
  return { data: Array.isArray(data) ? (data[0] || null) : null }
}

export async function compareWithPrevious({ pembukuanId, cabangId, marketingId }) {
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

export async function fetchProfitLossDetails({ pembukuanId, cabangId }) {
  // We can just reuse fetchProfitLossByCabang since it has all the details if cabangId is not passed,
  // or filter it if cabangId is passed.
  const data = await fetchProfitLossByCabang({ pembukuanId })
  if (cabangId) {
    return data.filter(d => d.id_cabang === Number(cabangId))
  }
  return data
}
