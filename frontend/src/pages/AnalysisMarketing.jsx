import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import MarketingTransactionDetailTrigger from '@/components/marketing/MarketingTransactionDetailTrigger.jsx'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://reportsapi.optiklivina.com'

export default function AnalysisMarketing() {
  const [marketing, setMarketing] = useState('')
  const [marketingOpts, setMarketingOpts] = useState([])
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState(null)
  const [items, setItems] = useState([])
  const [prodItems, setProdItems] = useState([])
  const [completenessData, setCompletenessData] = useState({ percent: 0, missing: { no_hp: 0, alamat_lengkap: 0, file_ktp_url: 0, file_kk_url: 0 } })
  const [dist, setDist] = useState({ qty_kacamata: 0, qty_ganti_lensa: 0, qty_ganti_frame: 0, qty_softlens: 0 })
  const [monthlyTrans, setMonthlyTrans] = useState([])
  const [allTrans, setAllTrans] = useState([])
  const [reportId, setReportId] = useState('')
  const [printMode, setPrintMode] = useState(false)

  useEffect(() => { initOptions() }, [])

  async function initOptions() {
    const mRes = await fetch(`${API_BASE}/api/options/marketing`)
    const mJson = await mRes.json()
    setMarketingOpts(mJson.data || [])
  }



  const qs = useMemo(() => {
    const p = new URLSearchParams()
    if (marketing) p.set('marketing', marketing)
    return p.toString()
  }, [marketing])

  async function fetchData() {
    if (!marketing) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/reports/analysis-marketing/es?marketingId=${marketing}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      
      const result = json.result || {}
      setSummary(result.summary?.data?.[0] || null)
      setItems((result.transactions && Array.isArray(result.transactions.data)) ? result.transactions.data : (result.transactions || []))
      setDist(result.distribution || { qty_kacamata: 0, qty_ganti_lensa: 0, qty_ganti_frame: 0, qty_softlens: 0, qty_lensa: 0 })
      setCompletenessData(result.completeness || { percent: 0, missing: { no_hp: 0, alamat_lengkap: 0, file_ktp_url: 0, file_kk_url: 0 } })
      setProdItems(result.items || [])
      setMonthlyTrans(result.monthly || [])
      setAllTrans(result.allTransactions || [])
    } catch (e) {
      console.error(e)
      alert('Gagal memuat laporan')
    } finally {
      setLoading(false)
    }
  }

  async function fetchSavedReport(id) {
    if (!id) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/reports/generated/${id}`)
      const json = await res.json()
      const result = json.result || {}
      const mkId = json.payload?.marketingId ? String(json.payload.marketingId) : ''
      if (mkId) { setMarketing(mkId) }
      setSummary(result.summary?.data?.[0] || null)
      setItems((result.transactions && Array.isArray(result.transactions.data)) ? result.transactions.data : (result.transactions || []))
      setDist(result.distribution || { qty_kacamata: 0, qty_ganti_lensa: 0, qty_ganti_frame: 0, qty_softlens: 0, qty_lensa: 0 })
      setCompletenessData(result.completeness || { percent: 0, missing: { no_hp: 0, alamat_lengkap: 0, file_ktp_url: 0, file_kk_url: 0 } })
      setProdItems(result.items || [])
      setMonthlyTrans(result.monthly || [])
      setAllTrans(result.allTransactions || [])
      alert('Laporan tersimpan berhasil dimuat')
    } catch (e) { console.error(e); alert('Gagal memuat laporan tersimpan') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    function syncFromLocation() {
      const hash = window.location.hash
      const query = hash.includes('?') ? hash.split('?')[1] : ''
      const params = new URLSearchParams(query)
      const rid = params.get('report') || ''
      setReportId(rid)
      if (rid) { fetchSavedReport(rid) }
    }
    syncFromLocation()
    const onHash = () => syncFromLocation()
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => { if (!reportId) fetchData() }, [marketing, reportId])

  const overdueTotal = useMemo(() => {
    if (!summary) return 0
    const a = Number(summary?.tagihan_1_bulan || 0)
    const b = Number(summary?.tagihan_3_bulan || 0)
    const c = Number(summary?.tagihan_6_bulan || 0)
    const d = Number(summary?.tagihan_1_tahun || 0)
    const e = Number(summary?.tagihan_gt_1_tahun || 0)
    return a + b + c + d + e
  }, [summary])

  const monthDist = useMemo(() => {
    const by = {}
    for (const it of items) {
      const m = (String(it.tanggal_order || '').slice(0, 7)) || ''
      by[m] = (by[m] || 0) + Number(it.sisa_bayar || 0)
    }
    const arr = Object.entries(by).map(([k, v]) => ({ month: k, amount: v }))
    arr.sort((a, b) => a.month.localeCompare(b.month))
    return arr
  }, [items])

  const monthCountDist = useMemo(() => {
    const by = {}
    for (const it of items) {
      const m = (String(it.tanggal_order || '').slice(0, 7)) || ''
      by[m] = (by[m] || 0) + 1
    }
    const arr = Object.entries(by).map(([k, v]) => ({ month: k, count: v }))
    arr.sort((a, b) => a.month.localeCompare(b.month))
    return arr
  }, [items])

  const monthsUnion = useMemo(() => {
    const map = new Map()
    for (const m of monthDist) { map.set(m.month, { month: m.month, amount: m.amount, count: 0 }) }
    for (const c of monthCountDist) { const prev = map.get(c.month) || { month: c.month, amount: 0, count: 0 }; prev.count = c.count; map.set(c.month, prev) }
    const arr = Array.from(map.values())
    arr.sort((a, b) => a.month.localeCompare(b.month))
    return arr
  }, [monthDist, monthCountDist])

  const topMonth = useMemo(() => {
    if (monthDist.length === 0) return ''
    return monthDist.reduce((max, cur) => cur.amount > max.amount ? cur : max, monthDist[0]).month
  }, [monthDist])

  const weekdayDist = useMemo(() => {
    const names = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
    const by = Array(7).fill(0)
    for (const it of items) {
      const d = new Date(it.tanggal_order); if (isNaN(d)) continue
      by[d.getDay()] += 1
    }
    return names.map((name, idx) => ({ name, count: by[idx] }))
  }, [items])

  const topWeekday = useMemo(() => {
    if (weekdayDist.length === 0) return ''
    return weekdayDist.reduce((max, cur) => cur.count > max.count ? cur : max, weekdayDist[0]).name
  }, [weekdayDist])

  const productDist = useMemo(() => ([
    { name: 'Kacamata', count: Number(dist.qty_kacamata || 0) },
    { name: 'Ganti Lensa', count: Number(dist.qty_ganti_lensa || 0) },
    { name: 'Frame', count: Number(dist.qty_frame || 0) },
    { name: 'Lensa', count: Number(dist.qty_lensa || 0) },
  ]), [dist])
  const topProduct = useMemo(() => {
    if (productDist.length === 0) return ''
    return productDist.reduce((max, cur) => cur.count > max.count ? cur : max, productDist[0]).name
  }, [productDist])

  const itemsByProduct = useMemo(() => {
    const isNullOrEmpty = (s) => (!s || String(s).trim() === '')
    return {
      kacamata: prodItems.filter(it => String(it.jenis_sub_trx || '') === 'kacamata'),
      ganti_lensa: prodItems.filter(it => String(it.jenis_sub_trx || '') === 'ganti_lensa'),
      frame: prodItems.filter(it => String(it.jenis_produk || '') === 'frame' && (isNullOrEmpty(it.jenis_sub_trx) || String(it.jenis_sub_trx) === 'frame')),
      lensa: prodItems.filter(it => String(it.jenis_produk || '') === 'lensa' && isNullOrEmpty(it.jenis_sub_trx)),
    }
  }, [prodItems])

  const transMonthCount = useMemo(() => {
    const arr = monthlyTrans.map(r => ({ month: r.bulan, count: Number(r.total_transaksi || 0) }))
    arr.sort((a, b) => a.month.localeCompare(b.month))
    return arr
  }, [monthlyTrans])

  const MACET_THRESHOLD_DAYS = 90
  const daysSince = (dateStr) => {
    const d = new Date(dateStr)
    if (isNaN(d)) return Infinity
    return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
  }
  const blacklistItems = useMemo(() => items.filter(it => String(it.status_user || '').toLowerCase() === 'blacklist' && Number(it.sisa_bayar || 0) > 0), [items])
  const macetItems = useMemo(() => items.filter(it => String(it.status_user || '').toLowerCase() !== 'blacklist' && Number(it.sisa_bayar || 0) > 0 && daysSince(it.last_bayar) > MACET_THRESHOLD_DAYS), [items])
  const berjalanItems = useMemo(() => items.filter(it => String(it.status_user || '').toLowerCase() !== 'blacklist' && Number(it.sisa_bayar || 0) > 0 && daysSince(it.last_bayar) <= MACET_THRESHOLD_DAYS), [items])

  const transMonthNominal = useMemo(() => {
    const arr = monthlyTrans.map(r => ({ month: r.bulan, amount: Number(r.total_fix || 0) }))
    arr.sort((a, b) => a.month.localeCompare(b.month))
    return arr
  }, [monthlyTrans])

  const labaSummary = useMemo(() => {
    const byKode = new Map()
    for (const it of prodItems) {
      const k = it.kode_transaksi
      const prev = byKode.get(k) || 0
      byKode.set(k, prev + Number(it.laba_item || 0))
    }
    const paidSet = new Set(allTrans.filter(r => Number(r.sisa_bayar || 0) <= 0).map(r => r.kode_transaksi))
    const unpaidSet = new Set(allTrans.filter(r => Number(r.sisa_bayar || 0) > 0).map(r => r.kode_transaksi))
    let est = 0, actual = 0, pending = 0
    for (const [kode, laba] of byKode.entries()) {
      est += laba
      if (paidSet.has(kode)) actual += laba
      if (unpaidSet.has(kode)) pending += laba
    }
    return { est, actual, pending }
  }, [prodItems, allTrans])

  const lastPayment = useMemo(() => {
    const dates = items.map(it => it.last_bayar).filter(Boolean)
    if (dates.length === 0) return ''
    return formatDate(dates.sort().slice(-1)[0])
  }, [items])
  const completeness = completenessData

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-3">
        <a href="#/" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 bg-slate-900 text-white hover:bg-slate-700 h-9 px-4 py-2">Kembali</a>
        <div className="flex items-center gap-2">
          <label className="text-sm">Marketing:</label>
          <select className="border rounded px-2 py-1 text-sm" value={marketing} onChange={e => setMarketing(e.target.value)}>
            <option value="">Pilih marketing</option>
            {marketingOpts.map(m => (<option key={m.value} value={m.value}>{m.label}</option>))}
          </select>
        </div>

        <Button onClick={fetchData} disabled={loading || !marketing}>{loading ? 'Memuat...' : 'Filter'}</Button>
      </div>
      {loading && (<div className="mb-2 text-sm text-slate-600">Sedang memproses laporan via antrean...</div>)}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 12mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .page { page-break-after: always; }
          .page:last-child { page-break-after: auto; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #cbd5e1; padding: 6px; }
        }
      `}</style>
      <h1 className="text-2xl font-semibold mb-1">Analisis Marketing</h1>
      <div className="mb-2 no-print">
        <Button onClick={() => { setPrintMode(true); setTimeout(() => { window.print(); setPrintMode(false) }, 100) }}>Cetak PDF</Button>
      </div>
      {marketing && (
        <p className="mb-3 text-sm text-slate-600">Per marketing: {marketingOpts.find(m => String(m.value) === String(marketing))?.label || marketing}</p>
      )}

      <div className={`grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 ${printMode ? 'no-print' : ''}`}>
        <div className="p-3 border rounded bg-slate-50">
          <div className="font-semibold mb-2">Presentasi Tagihan Macet</div>
          <div className="text-sm mb-2">Total: <b>{fmtCurrency(overdueTotal)}</b></div>
          <Bar label="≤ 1 bulan" value={Number(summary?.tagihan_1_bulan || 0)} max={overdueTotal || 1} />
          <Bar label="≤ 6 bulan" value={Number(summary?.tagihan_3_bulan || 0) + Number(summary?.tagihan_6_bulan || 0)} max={overdueTotal || 1} />
          <Bar label="> 6 bulan" value={Number(summary?.tagihan_1_tahun || 0) + Number(summary?.tagihan_gt_1_tahun || 0)} max={overdueTotal || 1} />
        </div>
        <div className="p-3 border rounded bg-slate-50">
          <div className="font-semibold mb-2">Sering Macet Bulan</div>
          <div className="text-sm">Bulan terbanyak: <b>{topMonth || '-'}</b></div>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">{monthsUnion.map(m => (<Bar key={`amt-${m.month}`} label={m.month} value={m.amount} max={Math.max(...monthsUnion.map(x => x.amount), 1)} />))}</div>
            <div className="space-y-1">{monthsUnion.map(m => (<Bar key={`cnt-${m.month}`} label="" value={m.count} max={Math.max(...monthsUnion.map(x => x.count), 1)} />))}</div>
          </div>
        </div>
        <div className="p-3 border rounded bg-slate-50">
          <div className="font-semibold mb-2">Transaksi Paling Banyak (Hari)</div>
          <div className="text-sm">Paling banyak: <b>{topWeekday || '-'}</b></div>
          <div className="mt-2 space-y-1">{weekdayDist.map(w => (<Bar key={w.name} label={w.name} value={w.count} max={Math.max(...weekdayDist.map(x => x.count), 1)} />))}</div>
        </div>
        <div className="p-3 border rounded bg-slate-50 md:col-span-1">
          <div className="font-semibold mb-2">Terjual Berdasarkan Jenis Produk</div>
          <div className="text-sm">Paling banyak: <b>{topProduct || '-'}</b></div>
          <div className="mt-2 space-y-1">{productDist.map(p => (<Bar key={p.name} label={p.name} value={p.count} max={Math.max(...productDist.map(x => x.count), 1)} />))}</div>
        </div>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-4 gap-3 mb-4 ${printMode ? 'no-print' : ''}`}>
        <div className="p-3 border rounded bg-slate-50">
          <div className="font-semibold mb-2">Total Macet Transaksi</div>
          <div className="text-2xl font-bold">{fmtCurrency(items.length)}</div>
        </div>
        <div className="p-3 border rounded bg-slate-50">
          <div className="font-semibold mb-2">Kelengkapan Data Customer</div>
          <div className="text-sm">Lengkap: <b>{fmtPercent(completeness.percent)}</b></div>
          <div className="text-sm mt-2">Kurang: No HP {completeness.missing.no_hp}, Alamat {completeness.missing.alamat_lengkap}, KTP {completeness.missing.file_ktp_url}, KK {completeness.missing.file_kk_url}</div>
        </div>
        <div className="p-3 border rounded bg-slate-50">
          <div className="font-semibold mb-2">Pembayaran Terakhir</div>
          <div className="text-lg font-bold">{lastPayment || '-'}</div>
        </div>
        <div className="p-3 border rounded bg-slate-50">
          <div className="font-semibold mb-2">Total Tagihan Macet</div>
          <div className="text-2xl font-bold">{fmtCurrency(overdueTotal)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="p-3 border rounded bg-slate-50">
          <div className="font-semibold mb-2">Laba Estimasi (Jika Lunas)</div>
          <div className="text-2xl font-bold">{fmtCurrency(labaSummary.est)}</div>
        </div>
        <div className="p-3 border rounded bg-slate-50">
          <div className="font-semibold mb-2">Laba Aktual (Sudah Lunas)</div>
          <div className="text-2xl font-bold">{fmtCurrency(labaSummary.actual)}</div>
        </div>
        <div className="p-3 border rounded bg-slate-50">
          <div className="font-semibold mb-2">Laba Pending (Belum Lunas)</div>
          <div className="text-2xl font-bold">{fmtCurrency(labaSummary.pending)}</div>
        </div>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 ${printMode ? 'no-print' : ''}`}>
        <div className="p-3 border rounded bg-slate-50">
          <div className="font-semibold mb-2">Tagihan Macet (Ringkasan)</div>
          <div className="space-y-1 text-sm">
            <div>Bulan ini: <b>{fmtCurrency(Number(summary?.tagihan_1_bulan || 0))}</b></div>
            <div>{'> '}3 bulan: <b>{fmtCurrency(Number(summary?.tagihan_6_bulan || 0))}</b></div>
            <div>{'> '}6 bulan: <b>{fmtCurrency(Number(summary?.tagihan_1_tahun || 0))}</b></div>
            <div>{'> '}1 tahun: <b>{fmtCurrency(Number(summary?.tagihan_gt_1_tahun || 0))}</b></div>
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 ${printMode ? 'no-print' : ''}`}>
        <div className="p-3 border rounded bg-slate-50">
          <div className="font-semibold mb-2">Grafik Transaksi Berdasarkan Bulan</div>
          <div className="mt-2 space-y-1">{transMonthCount.map(m => (<Bar key={m.month} label={m.month} value={m.count} max={Math.max(...transMonthCount.map(x => x.count), 1)} />))}</div>
        </div>
        <div className="p-3 border rounded bg-slate-50">
          <div className="font-semibold mb-2">Grafik Nominal per Bulan (Fix Harga)</div>
          <div className="mt-2 space-y-1">{transMonthNominal.map(m => (<Bar key={m.month} label={m.month} value={m.amount} max={Math.max(...transMonthNominal.map(x => x.amount), 1)} />))}</div>
        </div>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 ${printMode ? 'no-print' : ''}`}>
        <div className="p-3 border rounded bg-slate-50 overflow-auto">
          <div className="font-semibold mb-2">Transaksi Kacamata</div>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 uppercase text-[10px] font-bold text-slate-600 tracking-wider">
              <tr>
                <th className="p-2 text-left w-8">No</th>
                <th className="p-2 text-left w-24">Kode</th>
                <th className="p-2 text-left">Customer</th>
                <th className="p-2 text-left">Produk</th>
                <th className="p-2 text-right">Qty</th>
                <th className="p-2 text-right">Harga Jual</th>
                <th className="p-2 text-right">Laba Item</th>
                <th className="p-2 text-left">Tanggal</th>
              </tr>
            </thead>
            <tbody>
              {itemsByProduct.kacamata.map((it, idx) => (
                <tr key={idx} className="border-t hover:bg-white transition-colors">
                  <td className="p-2 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                  <td className="p-2 font-mono text-xs"><MarketingTransactionDetailTrigger kodeTransaksi={it.kode_transaksi}><span className="text-primary hover:underline cursor-pointer">{it.kode_transaksi}</span></MarketingTransactionDetailTrigger></td>
                  <td className="p-2 font-medium">{it.nama_customer}</td>
                  <td className="p-2">{it.nama_produk || `${it.jenis_produk} #${it.id_produk}`}</td>
                  <td className="p-2 text-right tabular-nums">{it.jumlah}</td>
                  <td className="p-2 text-right tabular-nums">{fmtCurrency(it.jumlah_harga)}</td>
                  <td className="p-2 text-right tabular-nums font-semibold text-green-700">{fmtCurrency(it.laba_item)}</td>
                  <td className="p-2 text-[10px] uppercase text-slate-500">{formatDate(it.tanggal_log)}</td>
                </tr>
              ))}
              {itemsByProduct.kacamata.length === 0 && (
                <tr><td className="p-3 text-center text-slate-400" colSpan={8}>Tidak ada data</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-3 border rounded bg-slate-50 overflow-auto">
          <div className="font-semibold mb-2">Transaksi Ganti Lensa</div>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 uppercase text-[10px] font-bold text-slate-600 tracking-wider">
              <tr>
                <th className="p-2 text-left w-8">No</th>
                <th className="p-2 text-left w-24">Kode</th>
                <th className="p-2 text-left">Customer</th>
                <th className="p-2 text-left">Produk</th>
                <th className="p-2 text-right">Qty</th>
                <th className="p-2 text-right">Harga Jual</th>
                <th className="p-2 text-right">Laba Item</th>
                <th className="p-2 text-left">Tanggal</th>
              </tr>
            </thead>
            <tbody>
              {itemsByProduct.ganti_lensa.map((it, idx) => (
                <tr key={idx} className="border-t hover:bg-white transition-colors">
                  <td className="p-2 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                  <td className="p-2 font-mono text-xs"><MarketingTransactionDetailTrigger kodeTransaksi={it.kode_transaksi}><span className="text-primary hover:underline cursor-pointer">{it.kode_transaksi}</span></MarketingTransactionDetailTrigger></td>
                  <td className="p-2 font-medium">{it.nama_customer}</td>
                  <td className="p-2">{it.nama_produk || `${it.jenis_produk} #${it.id_produk}`}</td>
                  <td className="p-2 text-right tabular-nums">{it.jumlah}</td>
                  <td className="p-2 text-right tabular-nums">{fmtCurrency(it.jumlah_harga)}</td>
                  <td className="p-2 text-right tabular-nums font-semibold text-green-700">{fmtCurrency(it.laba_item)}</td>
                  <td className="p-2 text-[10px] uppercase text-slate-500">{formatDate(it.tanggal_log)}</td>
                </tr>
              ))}
              {itemsByProduct.ganti_lensa.length === 0 && (
                <tr><td className="p-3 text-center text-slate-400" colSpan={8}>Tidak ada data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 ${printMode ? 'no-print' : ''}`}>
        <div className="p-3 border rounded bg-slate-50 overflow-auto">
          <div className="font-semibold mb-2">Transaksi Frame</div>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-2 text-left">Kode</th>
                <th className="p-2 text-left">Customer</th>
                <th className="p-2 text-left">Produk</th>
                <th className="p-2 text-right">Qty</th>
                <th className="p-2 text-right">Harga Jual</th>
                <th className="p-2 text-right">Laba Item</th>
                <th className="p-2 text-left">Tanggal</th>
              </tr>
            </thead>
            <tbody>
              {itemsByProduct.frame.map((it, idx) => (
                <tr key={idx} className="border-t">
                  <td className="p-2">{it.kode_transaksi}</td>
                  <td className="p-2">{it.nama_customer}</td>
                  <td className="p-2">{it.nama_produk || `${it.jenis_produk} #${it.id_produk}`}</td>
                  <td className="p-2 text-right">{it.jumlah}</td>
                  <td className="p-2 text-right">{fmtCurrency(it.jumlah_harga)}</td>
                  <td className="p-2 text-right">{fmtCurrency(it.laba_item)}</td>
                  <td className="p-2">{formatDate(it.tanggal_log)}</td>
                </tr>
              ))}
              {itemsByProduct.frame.length === 0 && (
                <tr><td className="p-3" colSpan={7}>Tidak ada data</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-3 border rounded bg-slate-50 overflow-auto">
          <div className="font-semibold mb-2">Transaksi Lensa</div>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-2 text-left">Kode</th>
                <th className="p-2 text-left">Customer</th>
                <th className="p-2 text-left">Produk</th>
                <th className="p-2 text-right">Qty</th>
                <th className="p-2 text-right">Harga Jual</th>
                <th className="p-2 text-right">Laba Item</th>
                <th className="p-2 text-left">Tanggal</th>
              </tr>
            </thead>
            <tbody>
              {itemsByProduct.lensa.map((it, idx) => (
                <tr key={idx} className="border-t">
                  <td className="p-2">{it.kode_transaksi}</td>
                  <td className="p-2">{it.nama_customer}</td>
                  <td className="p-2">{it.nama_produk || `${it.jenis_produk} #${it.id_produk}`}</td>
                  <td className="p-2 text-right">{it.jumlah}</td>
                  <td className="p-2 text-right">{fmtCurrency(it.jumlah_harga)}</td>
                  <td className="p-2 text-right">{fmtCurrency(it.laba_item)}</td>
                  <td className="p-2">{formatDate(it.tanggal_log)}</td>
                </tr>
              ))}
              {itemsByProduct.lensa.length === 0 && (
                <tr><td className="p-3" colSpan={7}>Tidak ada data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {printMode && (
        <div className="print-only">
          <div className="page">
            <div className="text-xl font-semibold mb-2">Transaksi Tagihan Berjalan</div>
            <div className="text-sm mb-2">Marketing: {marketingOpts.find(m => String(m.value) === String(marketing))?.label || marketing}</div>
            <table>
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Customer</th>
                  <th>Fix Harga</th>
                  <th>Bayar</th>
                  <th>Sisa</th>
                  <th>Terakhir Bayar</th>
                  <th>Ket</th>
                </tr>
              </thead>
              <tbody>
                {berjalanItems.map((it, idx) => (
                  <tr key={idx}>
                    <td>{it.kode_transaksi}</td>
                    <td>{it.nama_customer}</td>
                    <td className="text-right">{fmtCurrency(it.fix_harga)}</td>
                    <td className="text-right">{fmtCurrency(it.jml_bayar)}</td>
                    <td className="text-right">{fmtCurrency(it.sisa_bayar)}</td>
                    <td>{formatDate(it.last_bayar)}</td>
                    <td>{it.last_jenis_transaksi || ''}</td>
                  </tr>
                ))}
                {berjalanItems.length === 0 && (
                  <tr><td colSpan={7}>Tidak ada data</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="page">
            <div className="text-xl font-semibold mb-2">Transaksi Tagihan Macet</div>
            <div className="text-sm mb-2">Marketing: {marketingOpts.find(m => String(m.value) === String(marketing))?.label || marketing}</div>
            <table>
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Customer</th>
                  <th>Fix Harga</th>
                  <th>Bayar</th>
                  <th>Sisa</th>
                  <th>Terakhir Bayar</th>
                  <th>Ket</th>
                </tr>
              </thead>
              <tbody>
                {macetItems.map((it, idx) => (
                  <tr key={idx}>
                    <td>{it.kode_transaksi}</td>
                    <td>{it.nama_customer}</td>
                    <td className="text-right">{fmtCurrency(it.fix_harga)}</td>
                    <td className="text-right">{fmtCurrency(it.jml_bayar)}</td>
                    <td className="text-right">{fmtCurrency(it.sisa_bayar)}</td>
                    <td>{formatDate(it.last_bayar)}</td>
                    <td>{it.last_jenis_transaksi || ''}</td>
                  </tr>
                ))}
                {macetItems.length === 0 && (
                  <tr><td colSpan={7}>Tidak ada data</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="page">
            <div className="text-xl font-semibold mb-2">Transaksi Tagihan Blacklist</div>
            <div className="text-sm mb-2">Marketing: {marketingOpts.find(m => String(m.value) === String(marketing))?.label || marketing}</div>
            <table>
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Customer</th>
                  <th>Fix Harga</th>
                  <th>Bayar</th>
                  <th>Sisa</th>
                  <th>Terakhir Bayar</th>
                  <th>Ket</th>
                </tr>
              </thead>
              <tbody>
                {blacklistItems.map((it, idx) => (
                  <tr key={idx}>
                    <td>{it.kode_transaksi}</td>
                    <td>{it.nama_customer}</td>
                    <td className="text-right">{fmtCurrency(it.fix_harga)}</td>
                    <td className="text-right">{fmtCurrency(it.jml_bayar)}</td>
                    <td className="text-right">{fmtCurrency(it.sisa_bayar)}</td>
                    <td>{formatDate(it.last_bayar)}</td>
                    <td>{it.last_jenis_transaksi || ''}</td>
                  </tr>
                ))}
                {blacklistItems.length === 0 && (
                  <tr><td colSpan={7}>Tidak ada data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="overflow-auto border rounded shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 uppercase text-[10px] font-bold text-slate-600 tracking-wider">
            <tr>
              <th className="p-2 text-left w-12">No</th>
              <th className="p-2 text-left w-24">Kode</th>
              <th className="p-2 text-left">Customer</th>
              <th className="p-2 text-right">Fix Harga</th>
              <th className="p-2 text-right">Bayar</th>
              <th className="p-2 text-right">Sisa</th>
              <th className="p-2 text-left">Terakhir Bayar</th>
              <th className="p-2 text-left">Ket</th>
            </tr>
          </thead>
          <tbody>
            {(loading || items.length === 0) ? (
              loading ? (
                <tr><td className="p-3 text-center" colSpan={8}>Memuat...</td></tr>
              ) : (
                <tr><td className="p-3 text-center text-slate-400" colSpan={8}>Tidak ada data</td></tr>
              )
            ) : items.map((it, idx) => (
              <tr key={idx} className={`border-t hover:bg-slate-50 transition-colors ${String(it.status_user || '').toLowerCase() === 'blacklist' ? 'bg-red-50 hover:bg-red-100/50' : ''}`}>
                <td className="p-2 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                <td className="p-2 font-mono text-xs">{it.kode_transaksi}</td>
                <td className="p-2 font-medium">{it.nama_customer}</td>
                <td className="p-2 text-right tabular-nums">{fmtCurrency(it.fix_harga)}</td>
                <td className="p-2 text-right tabular-nums text-green-700">{fmtCurrency(it.jml_bayar)}</td>
                <td className="p-2 text-right tabular-nums font-bold text-red-600">{fmtCurrency(it.sisa_bayar)}</td>
                <td className="p-2 text-[10px] uppercase text-slate-500">{formatDate(it.last_bayar)}</td>
                <td className="p-2 text-[10px] font-bold uppercase">{it.last_jenis_transaksi || '-'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50">
            <tr className="border-t font-bold text-slate-700">
              <td className="p-2" colSpan={3}>TOTAL KESELURUHAN</td>
              <td className="p-2 text-right tabular-nums underline">{fmtCurrency(items.reduce((a, b) => a + Number(b.fix_harga || 0), 0))}</td>
              <td className="p-2 text-right tabular-nums underline text-green-700">{fmtCurrency(items.reduce((a, b) => a + Number(b.jml_bayar || 0), 0))}</td>
              <td className="p-2 text-right tabular-nums underline text-red-600">{fmtCurrency(items.reduce((a, b) => a + Number(b.sisa_bayar || 0), 0))}</td>
              <td className="p-2" colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function Bar({ label, value, max }) {
  const pct = max > 0 ? (Number(value || 0) / Number(max)) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <div className="w-40 text-xs truncate">{label}</div>
      <div className="flex-1 h-4 bg-slate-200 rounded">
        <div className="h-4 bg-slate-600 rounded" style={{ width: `${Math.max(4, pct)}%` }}></div>
      </div>
      <div className="w-24 text-right text-xs">{fmtCurrency(value)}</div>
    </div>
  )
}

function fmtCurrency(n) { return Number(n || 0).toLocaleString('id-ID') }
function fmtPercent(n) { return `${(Number(n || 0)).toFixed(2)}%` }
function formatDate(s) { if (!s) return ''; if (typeof s === 'string') return s.slice(0, 10); try { return new Date(s).toLocaleDateString('id-ID') } catch { return String(s) } }
