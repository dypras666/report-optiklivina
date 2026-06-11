import React, { useEffect, useMemo, useState } from 'react'
import CustomerDetailTrigger from '@/components/customer/CustomerDetailTrigger.jsx'
import MarketingTransactionDetailTrigger from '@/components/marketing/MarketingTransactionDetailTrigger.jsx'
import { Button } from '@/components/ui/button'
import Pagination from '@/components/ui/Pagination.jsx'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { TableBodySkeleton } from '@/components/ui/TableSkeleton.jsx'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://reportsapi.optiklivina.com'

export default function AnalysisCabang() {
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '')
  const cabang = params.get('cabang') || ''
  const [pembukuan, setPembukuan] = useState('')
  const [active, setActive] = useState(null)
  const [data, setData] = useState({ toko: {}, marketing: {}, biaya: 0, top_products: [], peak_hours: [] })
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [openProducts, setOpenProducts] = useState({})
  const [mkItems, setMkItems] = useState([])
  const [mkLoading, setMkLoading] = useState(false)
  const [openMkProducts, setOpenMkProducts] = useState({})
  const [mkTrans, setMkTrans] = useState([])
  const [mTransLoading, setMTransLoading] = useState(false)
  const [tTransLoading, setTTransLoading] = useState(false)
  const [tab, setTab] = useState('rekap')
  const [mQ, setMQ] = useState('')
  const [mStatus, setMStatus] = useState('')
  const [mPage, setMPage] = useState(1)
  const [mLimit, setMLimit] = useState(20)
  const [mRows, setMRows] = useState([])
  const [mMeta, setMMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [tQ, setTQ] = useState('')
  const [tStatus, setTStatus] = useState('')
  const [tPage, setTPage] = useState(1)
  const [tLimit, setTLimit] = useState(50)
  const [tRows, setTRows] = useState([])
  const [tMeta, setTMeta] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 })

  const [openCustomer, setOpenCustomer] = useState(false)
  const [customerProfile, setCustomerProfile] = useState(null)
  const [customerItems, setCustomerItems] = useState([])
  const [openKode, setOpenKode] = useState('')

  const [listPembukuan, setListPembukuan] = useState([])
  useEffect(() => {
    async function init() {
      const res = await fetch(`${API_BASE}/api/pembukuan/active`)
      const json = await res.json()
      setActive(json.data || null)
      const resList = await fetch(`${API_BASE}/api/pembukuan/list`)
      const jsonList = await resList.json()
      setListPembukuan(jsonList.data || [])
      const paramPembukuan = params.get('pembukuan_id')
      const id = paramPembukuan ? String(paramPembukuan) : (json?.data?.id_toko_tutup ? String(json.data.id_toko_tutup) : '')
      setPembukuan(id)
    }
    init()
  }, [])

  async function fetchData() {
    if (!cabang || !pembukuan) return
    setLoading(true)
    const url = `${API_BASE}/api/omset/analysis?pembukuan_id=${pembukuan}&cabang=${cabang}`
    const res = await fetch(url)
    const json = await res.json()
    const payload = json.data || { toko: {}, marketing: {}, biaya: 0, top_products: [], peak_hours: [] }
    setData(payload)
    window.__AN_DATA = payload
    setLoading(false)
  }
  async function fetchItems() {
    if (!cabang || !pembukuan) return
    setItemsLoading(true)
    const url = `${API_BASE}/api/omset/toko/items?cabang=${cabang}&pembukuan_id=${pembukuan}`
    const res = await fetch(url)
    const json = await res.json()
    const arr = json.data || []
    setItems(arr)
    window.__AN_ITEMS = arr
    setItemsLoading(false)
  }
  async function fetchMarketingItems() {
    if (!cabang || !pembukuan) return
    setMkLoading(true)
    const url = `${API_BASE}/api/reports/marketing/items?pembukuan_id=${pembukuan}&cabang=${cabang}`
    const res = await fetch(url)
    const json = await res.json()
    const arr = json.data || []
    setMkItems(arr)
    window.__AN_MK_ITEMS = arr
    setMkLoading(false)
  }
  async function fetchMarketingTrans() {
    if (!cabang || !pembukuan) return
    setMTransLoading(true)
    const params = new URLSearchParams({ pembukuan_id: String(pembukuan), cabang: String(cabang), page: String(mPage), limit: String(mLimit) })
    if (mQ) params.set('q', mQ)
    if (mStatus) params.set('status', mStatus)
    const url = `${API_BASE}/api/reports/marketing?${params.toString()}`
    const res = await fetch(url)
    const json = await res.json()
    setMkTrans(json.data || [])
    setMRows(json.data || [])
    setMMeta(json.meta || { page: mPage, limit: mLimit, total: 0, totalPages: 0 })
    setMTransLoading(false)
  }
  useEffect(() => { fetchData(); fetchItems(); fetchMarketingItems(); fetchMarketingTrans() }, [cabang, pembukuan])
  useEffect(() => { if (tab === 'marketing') { fetchMarketingTrans() } }, [tab, mPage, mLimit, mQ, mStatus])

  async function fetchTokoTrans() {
    if (!cabang || !pembukuan) return
    setTTransLoading(true)
    const params = new URLSearchParams({ pembukuan_id: String(pembukuan), cabang: String(cabang), page: String(tPage), limit: String(tLimit) })
    if (tQ) params.set('q', tQ)
    if (tStatus) params.set('status', tStatus)
    const url = `${API_BASE}/api/reports/toko/transaksi?${params.toString()}`
    const res = await fetch(url)
    const json = await res.json()
    setTRows(json.data || [])
    setTMeta(json.meta || { page: tPage, limit: tLimit, total: 0, totalPages: 0 })
    setTTransLoading(false)
  }

  async function openCustomerDetail(kode) {
    try {
      setOpenKode(kode)
      const [profRes, itemsRes] = await Promise.all([
        fetch(`${API_BASE}/api/reports/customer/profile/${kode}`),
        fetch(`${API_BASE}/api/reports/marketing/${kode}/items`)
      ])
      const profJson = await profRes.json()
      const itemsJson = await itemsRes.json()
      setCustomerProfile(profJson.data || null)
      setCustomerItems(itemsJson.data || [])
      setOpenCustomer(true)
    } catch (e) {
      setOpenCustomer(true)
    }
  }
  useEffect(() => { if (tab === 'toko') { fetchTokoTrans() } }, [tab, tPage, tLimit, tQ, tStatus])

  const topProfitProducts = useMemo(() => {
    const map = new Map()
    for (const it of items) {
      const key = `${it.jenis_produk}:${it.id_produk}`
      const prev = map.get(key) || { key, nama_produk: it.nama_produk || `${it.jenis_produk} #${it.id_produk}`, jenis_produk: it.jenis_produk, total_qty: 0, total_jual: 0, total_modal: 0, total_ongkir: 0, total_laba: 0, total_laba_final: 0 }
      prev.total_qty += Number(it.jumlah || 0)
      prev.total_jual += Number(it.jumlah_harga || 0)
      prev.total_modal += Number(it.jumlah_modal || 0)
      prev.total_ongkir += Number(it.jumlah_ongkir || 0)
      prev.total_laba += Number(it.laba_item || 0)
      prev.total_laba_final = Number(prev.total_jual || 0) - Number(prev.total_modal || 0) - Number(prev.total_ongkir || 0)
      map.set(key, prev)
    }
    return Array.from(map.values()).sort((a, b) => Number(b.total_laba) - Number(a.total_laba)).slice(0, 10)
  }, [items])

  const topProfitMarketingProducts = useMemo(() => {
    const map = new Map()
    for (const it of mkItems) {
      const key = `${it.jenis_produk}:${it.id_produk}`
      const prev = map.get(key) || { key, nama_produk: it.nama_produk || `${it.jenis_produk} #${it.id_produk}`, jenis_produk: it.jenis_produk, total_qty: 0, total_jual: 0, total_modal: 0, total_ongkir: 0, total_laba: 0, total_laba_final: 0 }
      prev.total_qty += Number(it.jumlah || 0)
      prev.total_jual += Number(it.jumlah_harga || 0)
      prev.total_modal += Number(it.jumlah_modal || 0)
      prev.total_ongkir += Number(it.jumlah_ongkir || 0)
      prev.total_laba += Number(it.laba_item || 0)
      prev.total_laba_final = Number(prev.total_jual || 0) - Number(prev.total_modal || 0) - Number(prev.total_ongkir || 0)
      map.set(key, prev)
    }
    return Array.from(map.values()).sort((a, b) => Number(b.total_laba) - Number(a.total_laba)).slice(0, 10)
  }, [mkItems])

  const topMarketingTransByQty = useMemo(() => {
    const byKode = new Map()
    for (const it of mkItems) {
      const k = it.kode_transaksi || String(it.id_grosir)
      const prev = byKode.get(k) || { kode_transaksi: k, total_qty: 0, nama_customer: it.nama_customer, sisa_bayar: it.sisa_bayar, nama_lengkap: it.nama_lengkap }
      prev.total_qty += Number(it.jumlah || 0)
      prev.nama_customer = it.nama_customer
      prev.sisa_bayar = it.sisa_bayar
      prev.nama_lengkap = it.nama_lengkap
      byKode.set(k, prev)
    }
    return Array.from(byKode.values()).sort((a, b) => Number(b.total_qty) - Number(a.total_qty)).slice(0, 10)
  }, [mkItems])

  const topMarketingTransByNominal = useMemo(() => {
    const arr = mkTrans.map(r => ({ kode_transaksi: r.kode_transaksi, fix_harga: Number(r.fix_harga || 0), nama_customer: r.nama_customer, sisa_bayar: (Number(r.fix_harga || 0) - Number(r.jml_bayar || 0)), nama_lengkap: r.nama_lengkap }))
    arr.sort((a, b) => Number(b.fix_harga) - Number(a.fix_harga))
    return arr.slice(0, 10)
  }, [mkTrans])

  const tokoTotals = useMemo(() => {
    const qty = items.reduce((a, it) => a + Number(it.jumlah || 0), 0)
    const uang = items.reduce((a, it) => a + Number(it.jumlah_harga || 0), 0)
    return { qty, uang }
  }, [items])
  const mkTotals = useMemo(() => {
    const qty = mkItems.reduce((a, it) => a + Number(it.jumlah || 0), 0)
    const uang = mkItems.reduce((a, it) => a + Number(it.jumlah_harga || 0), 0)
    return { qty, uang }
  }, [mkItems])
  const allTotals = useMemo(() => ({ qty: Number(tokoTotals.qty || 0) + Number(mkTotals.qty || 0), uang: Number(tokoTotals.uang || 0) + Number(mkTotals.uang || 0) }), [tokoTotals, mkTotals])

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-3">
        <a href="#/analysis-cabang" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 bg-slate-900 text-white hover:bg-slate-700 h-9 px-4 py-2">Kembali</a>
        <Button onClick={exportAnalysis} className="h-9 px-4 py-2">Export Excel (CSV)</Button>
        <div className="ml-auto flex items-center gap-1">
          <Button variant={tab === 'rekap' ? 'default' : 'secondary'} onClick={() => setTab('rekap')}>Rekap</Button>
          <Button variant={tab === 'marketing' ? 'default' : 'secondary'} onClick={() => setTab('marketing')}>Transaksi Marketing</Button>
          <Button variant={tab === 'toko' ? 'default' : 'secondary'} onClick={() => setTab('toko')}>Transaksi Toko</Button>
        </div>
      </div>
      <h1 className="text-2xl font-semibold mb-1">Analisis Cabang</h1>
      {(
        <p className="mb-3 text-sm text-slate-600">Pembukuan: {formatDate((listPembukuan.find(p => String(p.id_toko_tutup) === String(pembukuan)) || active)?.tanggal_buka_buku)} — {formatDate((listPembukuan.find(p => String(p.id_toko_tutup) === String(pembukuan)) || active)?.tanggal_tutup_buku)}</p>
      )}

      {tab === 'rekap' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="p-3 border rounded bg-slate-50">
            <div className="font-semibold mb-2">Rekap Toko</div>
            <div>Omset: <b>{fmtCurrency(data.toko.total_omset)}</b></div>
            <div>Laba: <b>{fmtCurrency(data.toko.total_laba)}</b></div>
          </div>
          <div className="p-3 border rounded bg-slate-50">
            <div className="font-semibold mb-2">Rekap Marketing</div>
            <div>Fix Harga: <b>{fmtCurrency(data.marketing.sum_fix_harga)}</b></div>
            <div>Bayar: <b>{fmtCurrency(data.marketing.sum_jml_bayar)}</b></div>
            <div>Sisa: <b>{fmtCurrency(data.marketing.sum_sisa_bayar)}</b></div>
            <div>Laba Item: <b>{fmtCurrency(data.marketing.sum_laba_items)}</b></div>
          </div>
          <div className="p-3 border rounded bg-slate-50">
            <div className="font-semibold mb-2">Biaya</div>
            <div>Total Biaya: <b>{fmtCurrency(data.biaya)}</b></div>
            <div>Omset Bersih: <b>{fmtCurrency(Number(data.toko.total_omset || 0) - Number(data.biaya || 0))}</b></div>
          </div>
        </div>
      )}

      {tab === 'rekap' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="p-3 border rounded bg-slate-50">
            <div className="font-semibold mb-2">Total Terjual (Toko)</div>
            <div>Qty: <b>{fmtCurrency(tokoTotals.qty)}</b></div>
            <div>Uang: <b>{fmtCurrency(tokoTotals.uang)}</b></div>
          </div>
          <div className="p-3 border rounded bg-slate-50">
            <div className="font-semibold mb-2">Total Terjual (Marketing)</div>
            <div>Qty: <b>{fmtCurrency(mkTotals.qty)}</b></div>
            <div>Uang: <b>{fmtCurrency(mkTotals.uang)}</b></div>
          </div>
          <div className="p-3 border rounded bg-slate-50">
            <div className="font-semibold mb-2">Total Terjual (Gabungan)</div>
            <div>Qty: <b>{fmtCurrency(allTotals.qty)}</b></div>
            <div>Uang: <b>{fmtCurrency(allTotals.uang)}</b></div>
          </div>
        </div>
      )}

      {tab === 'rekap' && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="border rounded">
            <div className="p-2 bg-slate-100 font-semibold">Top 10 Transaksi Marketing (Nominal)</div>
            <div className="p-2 text-xs text-slate-600">Urut berdasarkan total nominal `fix_harga`.</div>
            <div className="overflow-auto">
              <table className="w-full table-fixed text-sm">
                <thead className="bg-slate-100 uppercase text-[10px] font-bold text-slate-600 tracking-wider">
                  <tr>
                    <th className="p-2 text-left w-8">No</th>
                    <th className="p-2 text-left w-20">Kode</th>
                    <th className="p-2 text-left">Customer</th>
                    <th className="p-2 text-left">Marketing</th>
                    <th className="p-2 text-right">Nominal</th>
                    <th className="p-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {topMarketingTransByNominal.map((t, idx) => (
                    <tr key={t.kode_transaksi} className="border-t hover:bg-white transition-colors">
                      <td className="p-2 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                      <td className="p-2 font-mono text-xs"><MarketingTransactionDetailTrigger kodeTransaksi={t.kode_transaksi}><span className="text-primary hover:underline cursor-pointer">{t.kode_transaksi}</span></MarketingTransactionDetailTrigger></td>
                      <td className="p-2 font-medium">{t.nama_customer}</td>
                      <td className="p-2 text-slate-500">{t.nama_lengkap}</td>
                      <td className="p-2 text-right tabular-nums font-semibold">{fmtCurrency(t.fix_harga)}</td>
                      <td className="p-2 text-[10px] uppercase font-bold">{Number(t.sisa_bayar || 0) <= 0 ? <span className="text-green-600">Lunas</span> : <span className="text-red-600">Belum Lunas</span>}</td>
                    </tr>
                  ))}
                  {topMarketingTransByNominal.length === 0 && (
                    <tr><td className="p-3" colSpan={4}>Tidak ada data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="border rounded">
            <div className="p-2 bg-slate-100 font-semibold">Top 10 Transaksi Marketing (Qty Produk)</div>
            <div className="p-2 text-xs text-slate-600">Urut berdasarkan akumulasi qty item per transaksi.</div>
            <div className="overflow-auto">
              <table className="w-full table-fixed text-sm">
                <thead className="bg-slate-100 uppercase text-[10px] font-bold text-slate-600 tracking-wider">
                  <tr>
                    <th className="p-2 text-left w-8">No</th>
                    <th className="p-2 text-left w-20">Kode</th>
                    <th className="p-2 text-left">Customer</th>
                    <th className="p-2 text-left">Marketing</th>
                    <th className="p-2 text-right">Total Qty</th>
                    <th className="p-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {topMarketingTransByQty.map((t, idx) => (
                    <tr key={t.kode_transaksi} className="border-t hover:bg-white transition-colors">
                      <td className="p-2 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                      <td className="p-2 font-mono text-xs">{t.kode_transaksi}</td>
                      <td className="p-2 font-medium">{t.nama_customer}</td>
                      <td className="p-2 text-slate-500">{t.nama_lengkap}</td>
                      <td className="p-2 text-right tabular-nums">{fmtCurrency(t.total_qty)}</td>
                      <td className="p-2 text-[10px] uppercase font-bold">{Number(t.sisa_bayar || 0) <= 0 ? <span className="text-green-600">Lunas</span> : <span className="text-red-600">Belum Lunas</span>}</td>
                    </tr>
                  ))}
                  {topMarketingTransByQty.length === 0 && (
                    <tr><td className="p-3" colSpan={4}>Tidak ada data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'rekap' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="border rounded">
            <div className="p-2 bg-slate-100 font-semibold">Produk Terlaris</div>
            <table className="w-full text-sm">
              <thead className="bg-slate-100 uppercase text-[10px] font-bold text-slate-600 tracking-wider">
                <tr>
                  <th className="p-2 text-left w-8">No</th>
                  <th className="p-2 text-left">Produk</th>
                  <th className="p-2 text-left">Jenis</th>
                  <th className="p-2 text-right">Qty</th>
                </tr>
              </thead>
              <tbody>
                {data.top_products.map((p, idx) => (
                  <tr key={idx} className="border-t hover:bg-white transition-colors">
                    <td className="p-2 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                    <td className="p-2 font-medium">{p.nama_produk}</td>
                    <td className="p-2 opacity-70">{p.jenis_produk}</td>
                    <td className="p-2 text-right tabular-nums font-semibold">{fmtCurrency(p.qty)}</td>
                  </tr>
                ))}
                {data.top_products.length === 0 && (
                  <tr><td className="p-3 text-center text-slate-400" colSpan={4}>Tidak ada data</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="border rounded">
            <div className="p-2 bg-slate-100 font-semibold">Jam Ramai (Transaksi Toko)</div>
            <table className="w-full text-sm">
              <thead className="bg-slate-100 uppercase text-[10px] font-bold text-slate-600 tracking-wider">
                <tr>
                  <th className="p-2 text-left w-8">No</th>
                  <th className="p-2 text-left">Jam</th>
                  <th className="p-2 text-right">Jumlah Trx</th>
                </tr>
              </thead>
              <tbody>
                {data.peak_hours.map((h, idx) => (
                  <tr key={idx} className="border-t hover:bg-white transition-colors">
                    <td className="p-2 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                    <td className="p-2 font-medium">{String(h.jam).padStart(2, '0')}:00</td>
                    <td className="p-2 text-right tabular-nums font-semibold">{fmtCurrency(h.hits)}</td>
                  </tr>
                ))}
                {data.peak_hours.length === 0 && (
                  <tr><td className="p-3 text-center text-slate-400" colSpan={3}>Tidak ada data</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="border rounded">
            <div className="p-2 bg-slate-100 font-semibold">10 Produk Laba Tertinggi (Transaksi Toko)</div>
            <div className="p-2 text-xs text-slate-600">Berdasarkan total laba item pada pembukuan dan cabang ini.</div>
            <div className="overflow-auto">
              <table className="w-full table-fixed text-sm">
                <thead className="bg-slate-100 uppercase text-[10px] font-bold text-slate-600 tracking-wider">
                  <tr>
                    <th className="p-2 text-left w-8">No</th>
                    <th className="p-2 text-left">Produk</th>
                    <th className="p-2 text-left">Jenis</th>
                    <th className="p-2 text-right">Qty</th>
                    <th className="p-2 text-right">Laba Item</th>
                    <th className="p-2 text-right">Laba Final</th>
                    <th className="p-2 text-left w-[90px]">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsLoading ? (
                    <TableBodySkeleton rows={6} cols={7} />
                  ) : topProfitProducts.map((p, idx) => (
                    <React.Fragment key={p.key}>
                      <tr className="border-t hover:bg-slate-50 transition-colors">
                        <td className="p-2 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                        <td className="p-2 font-medium">{p.nama_produk}</td>
                        <td className="p-2 opacity-70">{p.jenis_produk}</td>
                        <td className="p-2 text-right tabular-nums">{fmtCurrency(p.total_qty)}</td>
                        <td className="p-2 text-right tabular-nums font-semibold">{fmtCurrency(p.total_laba)}</td>
                        <td className="p-2 text-right tabular-nums font-bold text-green-700">{fmtCurrency(p.total_laba_final)}</td>
                        <td className="p-2 whitespace-nowrap"><DetailButtonProduct prodKey={p.key} openProducts={openProducts} setOpenProducts={setOpenProducts} /></td>
                      </tr>
                      <ProductDetailTransactions prodKey={p.key} items={items} openProducts={openProducts} />
                    </React.Fragment>
                  ))}
                  {(!itemsLoading && topProfitProducts.length === 0) && (
                    <tr><td className="p-3" colSpan={9}>Tidak ada data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="border rounded">
            <div className="p-2 bg-slate-100 font-semibold">10 Produk Laba Tertinggi (Transaksi Marketing)</div>
            <div className="p-2 text-xs text-slate-600">Berdasarkan total laba item pada transaksi marketing di pembukuan dan cabang ini.</div>
            <div className="overflow-auto">
              <table className="w-full table-fixed text-sm">
                <thead className="bg-slate-100 uppercase text-[10px] font-bold text-slate-600 tracking-wider">
                  <tr>
                    <th className="p-2 text-left w-8">No</th>
                    <th className="p-2 text-left">Produk</th>
                    <th className="p-2 text-left">Jenis</th>
                    <th className="p-2 text-right">Qty</th>
                    <th className="p-2 text-right">Laba Item</th>
                    <th className="p-2 text-right">Laba Final</th>
                    <th className="p-2 text-left w-[90px]">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {mkLoading ? (
                    <TableBodySkeleton rows={6} cols={7} />
                  ) : topProfitMarketingProducts.map((p, idx) => (
                    <React.Fragment key={p.key}>
                      <tr className="border-t hover:bg-slate-50 transition-colors">
                        <td className="p-2 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                        <td className="p-2 font-medium">{p.nama_produk}</td>
                        <td className="p-2 opacity-70">{p.jenis_produk}</td>
                        <td className="p-2 text-right tabular-nums">{fmtCurrency(p.total_qty)}</td>
                        <td className="p-2 text-right tabular-nums font-semibold">{fmtCurrency(p.total_laba)}</td>
                        <td className="p-2 text-right tabular-nums font-bold text-green-700">{fmtCurrency(p.total_laba_final)}</td>
                        <td className="p-2 whitespace-nowrap"><DetailButtonMkProduct prodKey={p.key} openProducts={openMkProducts} setOpenProducts={setOpenMkProducts} /></td>
                      </tr>
                      <MarketingProductDetailTransactions prodKey={p.key} items={mkItems} openProducts={openMkProducts} />
                    </React.Fragment>
                  ))}
                  {(!mkLoading && topProfitMarketingProducts.length === 0) && (
                    <tr><td className="p-3" colSpan={9}>Tidak ada data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'rekap' && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 border rounded bg-slate-50">
            <div className="font-semibold mb-2">Ringkasan Cabang</div>
            <div>Nama Cabang: <b>{params.get('nama') || cabang}</b></div>
            <div>Omset Toko: <b>{fmtCurrency(data.toko.total_omset)}</b></div>
            <div>Laba Toko: <b>{fmtCurrency(data.toko.total_laba)}</b></div>
          </div>
          <div className="p-3 border rounded bg-slate-50">
            <div className="font-semibold mb-2">Ringkasan Marketing</div>
            <div>Fix Harga: <b>{fmtCurrency(data.marketing.sum_fix_harga)}</b></div>
            <div>Ongkir: <b>{fmtCurrency(data.marketing.sum_ongkir_items)}</b></div>
            <div>Bayar: <b>{fmtCurrency(data.marketing.sum_jml_bayar)}</b></div>
            <div>Sisa Bayar: <b>{fmtCurrency(data.marketing.sum_sisa_bayar)}</b></div>
            <div>Tagihan Blacklist: <b>{fmtCurrency(data.marketing.sum_tagihan_blacklist)}</b></div>
            <div>Laba Item: <b>{fmtCurrency(data.marketing.sum_laba_items)}</b></div>
          </div>
          <div className="p-3 border rounded bg-slate-50">
            <div className="font-semibold mb-2">Catatan</div>
            <div className="text-sm text-slate-700">Laba dihitung dari harga jual item dikurangi modal. Omset Toko adalah jumlah pembayaran yang masuk pada periode. Jika banyak transaksi belum lunas, laba dapat lebih besar daripada omset.</div>
          </div>
        </div>
      )}

      {tab === 'marketing' && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <input className="border rounded px-2 py-1 text-sm" placeholder="Cari kode/customer/marketing" value={mQ} onChange={e => { setMQ(e.target.value); setMPage(1) }} />
            <select className="border rounded px-2 py-1 text-sm" value={mStatus} onChange={e => { setMStatus(e.target.value); setMPage(1) }}>
              <option value="">Semua status</option>
              <option value="lunas">Lunas</option>
              <option value="belum">Belum Lunas</option>
            </select>
            <select className="border rounded px-2 py-1 text-sm" value={mLimit} onChange={e => { setMLimit(parseInt(e.target.value, 10)); setMPage(1) }}>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
          <div className="overflow-auto border rounded">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 sticky top-0 z-10">
                <tr>
                  <th className="p-2 text-right w-12">No</th>
                  <th className="p-2 text-left">Tanggal</th>
                  <th className="p-2 text-left">Kode</th>
                  <th className="p-2 text-left">Cabang</th>
                  <th className="p-2 text-left">Marketing</th>
                  <th className="p-2 text-left">Customer</th>
                  <th className="p-2 text-right">Fix Harga</th>
                  <th className="p-2 text-right">Jml Bayar</th>
                  <th className="p-2 text-right">Sisa Bayar</th>
                  <th className="p-2 text-right">Laba Item</th>
                </tr>
              </thead>
              <tbody>
                {mTransLoading ? (
                  <TableBodySkeleton rows={10} cols={10} />
                ) : mRows.map((r, idx) => (
                  <tr key={r.id_transaksi} className="border-t">
                    <td className="p-2 text-right">{((mMeta.page - 1) * mMeta.limit) + idx + 1}</td>
                    <td className="p-2">{formatDate(r.tanggal_order)}</td>
                    <td className="p-2">{r.kode_transaksi}</td>
                    <td className="p-2">{r.nama_cabang}</td>
                    <td className="p-2">{r.nama_lengkap}</td>
                    <td className="p-2">
                      <CustomerDetailTrigger name={r.nama_customer} kodeTransaksi={r.kode_transaksi} status={r.status_user}>{r.nama_customer}</CustomerDetailTrigger>
                    </td>
                    <td className="p-2 text-right">{fmtCurrency(r.fix_harga)}</td>
                    <td className="p-2 text-right">{fmtCurrency(r.jml_bayar)}</td>
                    <td className="p-2 text-right">{fmtCurrency(r.sisa_bayar)}</td>
                    <td className="p-2 text-right">{fmtCurrency(r.laba_items)}</td>
                  </tr>
                ))}
                {!mTransLoading && mRows.length === 0 && (
                  <tr><td className="p-3" colSpan={10}>Tidak ada data</td></tr>
                )}
              </tbody>
              <tfoot className="bg-slate-50">
                <tr className="border-t font-semibold">
                  <td className="p-2" colSpan={6}>Total</td>
                  <td className="p-2 text-right">{fmtCurrency(mRows.reduce((a, b) => a + Number(b.fix_harga || 0), 0))}</td>
                  <td className="p-2 text-right">{fmtCurrency(mRows.reduce((a, b) => a + Number(b.jml_bayar || 0), 0))}</td>
                  <td className="p-2 text-right">{fmtCurrency(mRows.reduce((a, b) => a + Number(b.sisa_bayar || 0), 0))}</td>
                  <td className="p-2 text-right">{fmtCurrency(mRows.reduce((a, b) => a + Number(b.laba_items || 0), 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <Pagination
            className="mt-2"
            page={mMeta.page}
            totalPages={mMeta.totalPages}
            total={mMeta.total}
            disabledPrev={mMeta.page <= 1}
            disabledNext={mMeta.page >= mMeta.totalPages}
            onPrev={() => setMPage(p => Math.max(1, p - 1))}
            onNext={() => setMPage(p => p + 1)}
          />
        </div>
      )}

      {tab === 'toko' && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <input className="border rounded px-2 py-1 text-sm" placeholder="Cari kode grosir/cabang" value={tQ} onChange={e => { setTQ(e.target.value); setTPage(1) }} />
            <select className="border rounded px-2 py-1 text-sm" value={tStatus} onChange={e => { setTStatus(e.target.value); setTPage(1) }}>
              <option value="">Semua status</option>
              <option value="lunas">Lunas</option>
              <option value="belum">Belum Lunas</option>
            </select>
            <select className="border rounded px-2 py-1 text-sm" value={tLimit} onChange={e => { setTLimit(parseInt(e.target.value, 10)); setTPage(1) }}>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
          <div className="overflow-auto border rounded">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 sticky top-0 z-10">
                <tr>
                  <th className="p-2 text-right w-12">No</th>
                  <th className="p-2 text-left">Tanggal</th>
                  <th className="p-2 text-left">Kode Grosir</th>
                  <th className="p-2 text-left">Cabang</th>
                  <th className="p-2 text-right">Fix Harga</th>
                  <th className="p-2 text-right">Jml Bayar</th>
                  <th className="p-2 text-right">Sisa Bayar</th>
                  <th className="p-2 text-right">Modal</th>
                  <th className="p-2 text-right">Qty Produk</th>
                </tr>
              </thead>
              <tbody>
                {tTransLoading ? (
                  <TableBodySkeleton rows={10} cols={9} />
                ) : tRows.map((r, idx) => (
                  <tr key={r.kode_grosir} className="border-t">
                    <td className="p-2 text-right">{((tMeta.page - 1) * tMeta.limit) + idx + 1}</td>
                    <td className="p-2">{formatDate(r.tanggal_grosir)}</td>
                    <td className="p-2">{r.kode_grosir}</td>
                    <td className="p-2">{r.nama_cabang}</td>
                    <td className="p-2 text-right">{fmtCurrency(r.fix_harga)}</td>
                    <td className="p-2 text-right">{fmtCurrency(r.jml_bayar)}</td>
                    <td className="p-2 text-right">{fmtCurrency(r.sisa_bayar)}</td>
                    <td className="p-2 text-right">{fmtCurrency(r.sum_modal)}</td>
                    <td className="p-2 text-right">{fmtCurrency(r.sum_qty)}</td>
                  </tr>
                ))}
                {!tTransLoading && tRows.length === 0 && (
                  <tr><td className="p-3" colSpan={9}>Tidak ada data</td></tr>
                )}
              </tbody>
              <tfoot className="bg-slate-50">
                <tr className="border-t font-semibold">
                  <td className="p-2" colSpan={4}>Total</td>
                  <td className="p-2 text-right">{fmtCurrency(tRows.reduce((a, b) => a + Number(b.fix_harga || 0), 0))}</td>
                  <td className="p-2 text-right">{fmtCurrency(tRows.reduce((a, b) => a + Number(b.jml_bayar || 0), 0))}</td>
                  <td className="p-2 text-right">{fmtCurrency(tRows.reduce((a, b) => a + Number(b.sisa_bayar || 0), 0))}</td>
                  <td className="p-2 text-right">{fmtCurrency(tRows.reduce((a, b) => a + Number(b.sum_modal || 0), 0))}</td>
                  <td className="p-2 text-right">{fmtCurrency(tRows.reduce((a, b) => a + Number(b.sum_qty || 0), 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <Pagination
            className="mt-2"
            page={tMeta.page}
            totalPages={tMeta.totalPages}
            total={tMeta.total}
            disabledPrev={tMeta.page <= 1}
            disabledNext={tMeta.page >= tMeta.totalPages}
            onPrev={() => setTPage(p => Math.max(1, p - 1))}
            onNext={() => setTPage(p => p + 1)}
          />
        </div>
      )}
      <CustomerSheet open={openCustomer} onOpenChange={setOpenCustomer} profile={customerProfile} items={customerItems} />
    </div>
  )
}

function ProfileRow({ label, value }) {
  return (
    <div className="flex items-start gap-2 text-sm"><div className="w-40 text-slate-600">{label}</div><div className="flex-1 break-words">{value || '-'}</div></div>
  )
}

export function CustomerSheet({ open, onOpenChange, profile, items }) {
  const p = profile || {}
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg w-full">
        <SheetHeader>
          <SheetTitle>Profil Customer</SheetTitle>
        </SheetHeader>
        <div className="mt-3 space-y-2">
          <ProfileRow label="Nama" value={p.nama_customer} />
          <ProfileRow label="Kode" value={p.kode_customer} />
          <ProfileRow label="QR" value={p.kode_qr} />
          <ProfileRow label="No HP" value={p.no_hp} />
          <ProfileRow label="Jenis Kelamin" value={p.jk} />
          <ProfileRow label="NIK KTP" value={p.no_ktp} />
          <ProfileRow label="No KK" value={p.no_kk} />
          <ProfileRow label="Tempat Lahir" value={p.tempat_lahir} />
          <ProfileRow label="Tanggal Lahir" value={p.tanggal_lahir} />
          <ProfileRow label="Alamat" value={p.alamat_lengkap} />
          <ProfileRow label="Kabupaten" value={p.kabupaten} />
          <ProfileRow label="Kecamatan" value={p.kecamatan} />
          <ProfileRow label="Desa" value={p.desa} />
          <ProfileRow label="Cabang" value={p.nama_cabang} />
          <ProfileRow label="Marketing" value={p.nama_marketing} />
          <ProfileRow label="Dokumen KTP" value={p.file_ktp ? (<a href={p.file_ktp} target="_blank" rel="noreferrer" className="text-primary underline">Lihat</a>) : ''} />
          <ProfileRow label="Dokumen KK" value={p.file_kk ? (<a href={p.file_kk} target="_blank" rel="noreferrer" className="text-primary underline">Lihat</a>) : ''} />
        </div>
        <div className="mt-4">
          <div className="font-semibold mb-2">Produk pada transaksi</div>
          <div className="overflow-auto border rounded">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 uppercase text-[10px] font-bold text-slate-600 tracking-wider">
                <tr>
                  <th className="p-2 text-left w-8">No</th>
                  <th className="p-2 text-left">Produk</th>
                  <th className="p-2 text-left">Jenis</th>
                  <th className="p-2 text-right">Qty</th>
                  <th className="p-2 text-right">Hrg Unit</th>
                  <th className="p-2 text-right">Hrg Jual</th>
                  <th className="p-2 text-right">Modal</th>
                  <th className="p-2 text-right">Ongkir</th>
                  <th className="p-2 text-right">Laba Fin</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={idx} className="border-t hover:bg-slate-50 transition-colors">
                    <td className="p-2 text-slate-400 font-mono text-[9px]">{idx + 1}</td>
                    <td className="p-2 font-medium">{it.nama_produk || `${it.jenis_produk} #${it.id_produk}`}</td>
                    <td className="p-2 opacity-70 italic text-[11px]">{it.jenis_produk}</td>
                    <td className="p-2 text-right tabular-nums">{fmtCurrency(it.jumlah)}</td>
                    <td className="p-2 text-right tabular-nums text-slate-500">{fmtCurrency(it.harga_produk)}</td>
                    <td className="p-2 text-right tabular-nums font-semibold">{fmtCurrency(it.jumlah_harga || (Number(it.harga_produk || 0) * Number(it.jumlah || 0)))}</td>
                    <td className="p-2 text-right tabular-nums text-slate-500">{fmtCurrency(it.jumlah_modal)}</td>
                    <td className="p-2 text-right tabular-nums text-orange-600 font-medium">{fmtCurrency(it.jumlah_ongkir)}</td>
                    <td className="p-2 text-right tabular-nums font-bold text-green-700">{fmtCurrency((Number(it.jumlah_harga || 0) - Number(it.jumlah_modal || 0) - Number(it.jumlah_ongkir || 0)))}</td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td className="p-3 text-center text-slate-400" colSpan={9}>Tidak ada item transaksi</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}


function fmtCurrency(n) { return Number(n || 0).toLocaleString('id-ID') }
function formatDate(s) { if (!s) return ''; if (typeof s === 'string') return s.slice(0, 10); try { return new Date(s).toLocaleDateString('id-ID') } catch { return String(s) } }

function DetailButtonProduct({ prodKey, openProducts, setOpenProducts }) {
  const open = !!openProducts[prodKey]
  const toggle = () => setOpenProducts(m => ({ ...m, [prodKey]: !open }))
  return <Button onClick={toggle}>{open ? 'Tutup' : 'Detail'}</Button>
}

function ProductDetailTransactions({ prodKey, items, openProducts }) {
  const open = !!openProducts[prodKey]
  if (!open) return null
  const [jenis, idStr] = prodKey.split(':')
  const idProd = Number(idStr)
  const rows = items.filter(it => String(it.jenis_produk) === String(jenis) && Number(it.id_produk) === idProd)
  return (
    <tr className="bg-slate-50">
      <td className="p-2" colSpan={9}>
        <table className="min-w-full text-xs">
          <thead className="bg-slate-100 uppercase text-[9px] font-bold text-slate-500 tracking-wider">
            <tr>
              <th className="p-2 text-left w-8">No</th>
              <th className="p-2 text-left">Transaksi</th>
              <th className="p-2 text-left">Produk</th>
              <th className="p-2 text-right">Qty</th>
              <th className="p-2 text-right">Hrg Unit</th>
              <th className="p-2 text-right">Hrg Jual</th>
              <th className="p-2 text-right">Laba Item</th>
              <th className="p-2 text-right">Laba Final</th>
              <th className="p-2 text-left">Tanggal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((it, idx) => (
              <tr key={`${prodKey}-${idx}`} className="border-t hover:bg-white transition-colors">
                <td className="p-2 text-slate-400 font-mono text-[9px]">{idx + 1}</td>
                <td className="p-2 font-mono text-[10px]">{it.id_grosir}</td>
                <td className="p-2 font-medium">{it.nama_produk || `${it.jenis_produk} #${it.id_produk}`}</td>
                <td className="p-2 text-right tabular-nums">{it.jumlah}</td>
                <td className="p-2 text-right tabular-nums text-slate-500">{fmtCurrency(it.harga_produk)}</td>
                <td className="p-2 text-right tabular-nums font-semibold">{fmtCurrency(it.jumlah_harga)}</td>
                <td className="p-2 text-right tabular-nums font-semibold text-green-700">{fmtCurrency(it.laba_item)}</td>
                <td className="p-2 text-right tabular-nums font-bold text-green-800">{fmtCurrency((Number(it.jumlah_harga || 0) - Number(it.jumlah_modal || 0) - Number(it.jumlah_ongkir || 0)))}</td>
                <td className="p-2 text-[10px] text-slate-500">{formatDate(it.tanggal_log)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </td>
    </tr>
  )
}

function DetailButtonMkProduct({ prodKey, openProducts, setOpenProducts }) {
  const open = !!openProducts[prodKey]
  const toggle = () => setOpenProducts(m => ({ ...m, [prodKey]: !open }))
  return <Button onClick={toggle}>{open ? 'Tutup' : 'Detail'}</Button>
}

function MarketingProductDetailTransactions({ prodKey, items, openProducts }) {
  const open = !!openProducts[prodKey]
  if (!open) return null
  const [jenis, idStr] = prodKey.split(':')
  const idProd = Number(idStr)
  const rows = items.filter(it => String(it.jenis_produk) === String(jenis) && Number(it.id_produk) === idProd)
  return (
    <tr className="bg-slate-50">
      <td className="p-2" colSpan={11}>
        <table className="min-w-full text-xs">
          <thead className="bg-slate-100 uppercase text-[9px] font-bold text-slate-500 tracking-wider">
            <tr>
              <th className="p-2 text-left w-8">No</th>
              <th className="p-2 text-left">Transaksi</th>
              <th className="p-2 text-left">Produk</th>
              <th className="p-2 text-right">Qty</th>
              <th className="p-2 text-right">Hrg Unit</th>
              <th className="p-2 text-right">Hrg Jual</th>
              <th className="p-2 text-right">Laba Item</th>
              <th className="p-2 text-right">Laba Final</th>
              <th className="p-2 text-left">Marketing</th>
              <th className="p-2 text-right">Status</th>
              <th className="p-2 text-left">Tanggal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((it, idx) => (
              <tr key={`${prodKey}-${idx}`} className="border-t hover:bg-white transition-colors">
                <td className="p-2 text-slate-400 font-mono text-[9px]">{idx + 1}</td>
                <td className="p-2 font-mono text-[10px]"><MarketingTransactionDetailTrigger kodeTransaksi={it.kode_transaksi}>{it.kode_transaksi}</MarketingTransactionDetailTrigger></td>
                <td className="p-2 font-medium">{it.nama_produk || `${it.jenis_produk} #${it.id_produk}`}</td>
                <td className="p-2 text-right tabular-nums">{it.jumlah}</td>
                <td className="p-2 text-right tabular-nums text-slate-500">{fmtCurrency(it.harga_produk)}</td>
                <td className="p-2 text-right tabular-nums font-semibold">{fmtCurrency(it.jumlah_harga)}</td>
                <td className="p-2 text-right tabular-nums font-semibold text-green-700">{fmtCurrency(it.laba_item)}</td>
                <td className="p-2 text-right tabular-nums font-bold text-green-800">{fmtCurrency((Number(it.jumlah_harga || 0) - Number(it.jumlah_modal || 0) - Number(it.jumlah_ongkir || 0)))}</td>
                <td className="p-2 text-[10px]">{it.nama_lengkap}</td>
                <td className="p-2 text-right text-[9px] font-bold uppercase">{Number(it.sisa_bayar || 0) <= 0 ? <span className="text-green-600">Lunas</span> : <span className="text-red-600">Belum</span>}</td>
                <td className="p-2 text-[10px] text-slate-500 whitespace-nowrap">{formatDate(it.tanggal_log)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </td>
    </tr>
  )
}

function exportAnalysis() {
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '')
  const cabang = params.get('nama') || params.get('cabang') || ''
  const pembukuan = params.get('pembukuan_id') || ''
  const rows = []
  const push = (arr) => { for (const a of arr) rows.push(a.join(',')) }
  const data = window.__AN_DATA || {}
  const tokoItems = window.__AN_ITEMS || []
  const mkItems = window.__AN_MK_ITEMS || []
  push([[`Analisis Cabang`, cabang, `Pembukuan`, pembukuan]])
  push([[`Rekap Toko`, `Omset`, Number(data?.toko?.total_omset || 0), `Laba`, Number(data?.toko?.total_laba || 0)]])
  push([[`Rekap Marketing`, `Fix Harga`, Number(data?.marketing?.sum_fix_harga || 0), `Bayar`, Number(data?.marketing?.sum_jml_bayar || 0), `Sisa`, Number(data?.marketing?.sum_sisa_bayar || 0), `Tagihan Blacklist`, Number(data?.marketing?.sum_tagihan_blacklist || 0), `Laba Item`, Number(data?.marketing?.sum_laba_items || 0)]])
  push([[``]])
  push([[`Transaksi Toko (Items)`]])
  push([[`Transaksi`, `Produk`, `Jenis`, `Qty`, `Harga Unit`, `Harga Jual`, `Modal Unit`, `Modal Total`, `Ongkir Unit`, `Ongkir Total`, `Laba Item`, `Laba Final`, `Tanggal`]])
  for (const it of tokoItems) {
    push([[it.id_grosir, (it.nama_produk || `${it.jenis_produk} #${it.id_produk}`), it.jenis_produk, it.jumlah, it.harga_produk, it.jumlah_harga, it.harga_modal, it.jumlah_modal, it.harga_ongkir, it.jumlah_ongkir, it.laba_item, (Number(it.jumlah_harga || 0) - Number(it.jumlah_modal || 0) - Number(it.jumlah_ongkir || 0)), it.tanggal_log]])
  }
  push([[``]])
  push([[`Transaksi Marketing (Items)`]])
  push([[`Kode`, `Customer`, `Produk`, `Jenis`, `Qty`, `Harga Unit`, `Harga Jual`, `Modal Unit`, `Modal Total`, `Ongkir Unit`, `Ongkir Total`, `Laba Item`, `Laba Final`, `Status`, `Tanggal`]])
  for (const it of mkItems) {
    push([[it.kode_transaksi, it.nama_customer, (it.nama_produk || `${it.jenis_produk} #${it.id_produk}`), it.jenis_produk, it.jumlah, it.harga_produk, it.jumlah_harga, it.harga_modal, it.jumlah_modal, it.harga_ongkir, it.jumlah_ongkir, it.laba_item, (Number(it.jumlah_harga || 0) - Number(it.jumlah_modal || 0) - Number(it.jumlah_ongkir || 0)), (Number(it.sisa_bayar || 0) <= 0 ? 'Lunas' : 'Belum Lunas'), it.tanggal_log]])
  }
  const csv = rows.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `analisis_cabang_${cabang || 'cabang'}_${pembukuan || 'period'}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
