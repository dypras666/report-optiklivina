import React, { useEffect, useMemo, useState } from 'react'
import CustomerDetailTrigger from '@/components/customer/CustomerDetailTrigger.jsx'
import { Button } from '@/components/ui/button'
import Pagination from '@/components/ui/Pagination.jsx'
import { tableClass, theadClass, containerClass } from '@/components/ui/tableStyles.js'
import { TableBodySkeleton } from '@/components/ui/TableSkeleton.jsx'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://reportsapi.optiklivina.com'

export default function OmsetToko() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [controller, setController] = useState(null)
  const [cabangOpts, setCabangOpts] = useState([])
  const [filters, setFilters] = useState({ cabang: '', tanggal: '' })
  const [meta, setMeta] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 })
  const [openRows, setOpenRows] = useState({})
  const [itemsMap, setItemsMap] = useState({})

  useEffect(() => {
    const d = new Date().toISOString().slice(0, 10)
    setFilters(f => ({ ...f, tanggal: d }))
  }, [])

  useEffect(() => { initOptions() }, [])

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    if (filters.tanggal) { p.set('tanggal', filters.tanggal) }
    if (filters.cabang) { p.set('cabang', filters.cabang) }
    if (meta.page) { p.set('page', meta.page) }
    if (meta.limit) { p.set('limit', meta.limit) }
    return p.toString()
  }, [filters, meta.page, meta.limit])

  async function initOptions() {
    const res = await fetch(`${API_BASE}/api/options/cabang`)
    const json = await res.json()
    setCabangOpts(json.data || [])
  }

  async function fetchData() {
    if (controller) { try { controller.abort() } catch { } }
    const ctrl = new AbortController()
    setController(ctrl)
    setLoading(true)
    const url = `${API_BASE}/api/omset/toko/day${qs ? `?${qs}` : ''}`
    try {
      const res = await fetch(url, { signal: ctrl.signal })
      const json = await res.json()
      setRows(json.data || [])
      setMeta(json.meta || { page: 1, limit: 50, total: 0, totalPages: 0 })
    } catch (e) {
      if (e?.name !== 'AbortError') { console.error(e) }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (filters.tanggal) fetchData() }, [filters.tanggal, filters.cabang, meta.page, meta.limit])

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-3">
        <a href="#/" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 bg-slate-900 text-white hover:bg-slate-700 h-9 px-4 py-2">Kembali</a>
      </div>
      <h1 className="text-2xl font-semibold mb-1">Omset Toko (Harian)</h1>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        <input type="date" className="border rounded px-2 py-1" value={filters.tanggal} onChange={e => setFilters(f => ({ ...f, tanggal: e.target.value }))} />
        <select className="border rounded px-2 py-1" value={filters.cabang} onChange={e => setFilters(f => ({ ...f, cabang: e.target.value }))}>
          <option value="">Pilih cabang</option>
          {cabangOpts.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <select className="border rounded px-2 py-1" value={meta.limit} onChange={e => setMeta(m => ({ ...m, page: 1, limit: parseInt(e.target.value, 10) }))}>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={200}>200</option>
          <option value={1000}>Show All</option>
        </select>
        <Button onClick={fetchData} disabled={loading}>{loading ? 'Memuat...' : 'Filter'}</Button>
      </div>

      <div className={containerClass + " shadow-sm border rounded"}>
        <table className={tableClass}>
          <thead className={theadClass + " uppercase text-[10px] font-bold text-slate-600 tracking-wider bg-slate-100"}>
            <tr>
              <th className="p-2 text-left w-12">No</th>
              <th className="p-2 text-left">Cabang</th>
              <th className="p-2 text-right">Omset Toko</th>
              <th className="p-2 text-right"># Cust</th>
              <th className="p-2 text-right"># Trx</th>
              <th className="p-2 text-right">Kacamata</th>
              <th className="p-2 text-right">GL</th>
              <th className="p-2 text-right">Frame</th>
              <th className="p-2 text-right">Softlens</th>
              <th className="p-2 text-right">Ongkir</th>
              <th className="p-2 text-left w-32">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableBodySkeleton rows={10} cols={11} />
            ) : rows.map((r, idx) => (
              <React.Fragment key={r.id_cabang}>
                <tr className="border-t hover:bg-slate-50 transition-colors">
                  <td className="p-2 text-slate-400 font-mono text-[10px]">{((meta.page - 1) * meta.limit) + idx + 1}</td>
                  <td className="p-2 font-medium">{r.nama_cabang}</td>
                  <td className="p-2 text-right tabular-nums font-semibold">{fmtCurrency(r.total_omset)}</td>
                  <td className="p-2 text-right tabular-nums">{fmtCurrency(r.num_customer)}</td>
                  <td className="p-2 text-right tabular-nums">{fmtCurrency(r.num_trx)}</td>
                  <td className="p-2 text-right tabular-nums text-slate-500">{fmtCurrency(r.total_kacamata)}</td>
                  <td className="p-2 text-right tabular-nums text-slate-500">{fmtCurrency(r.total_ganti_lensa)}</td>
                  <td className="p-2 text-right tabular-nums text-slate-500">{fmtCurrency(r.total_ganti_frame)}</td>
                  <td className="p-2 text-right tabular-nums text-slate-500">{fmtCurrency(r.total_softlens)}</td>
                  <td className="p-2 text-right tabular-nums text-orange-600">{fmtCurrency(r.total_ongkir)}</td>
                  <td className="p-2 flex gap-2">
                    <RowDetailOmset cabangId={r.id_cabang} tanggal={filters.tanggal} openRows={openRows} setOpenRows={setOpenRows} itemsMap={itemsMap} setItemsMap={setItemsMap} />
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { window.location.hash = `#/analysis?cabang=${r.id_cabang}` }}>Analisis</Button>
                  </td>
                </tr>
                <DetailRowOmset cabangId={r.id_cabang} keyRow={`${r.id_cabang}-${filters.tanggal}`} openRows={openRows} itemsMap={itemsMap} loading={!!openRows[`${r.id_cabang}-${filters.tanggal}`] && !itemsMap[`${r.id_cabang}-${filters.tanggal}`]} />
              </React.Fragment>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td className="p-3 text-center text-slate-400" colSpan={11}>Tidak ada data untuk tanggal ini</td></tr>
            )}
          </tbody>
          <tfoot className="bg-slate-50 border-t-2">
            <tr className="font-bold text-slate-700">
              <td className="p-2" colSpan={2}>GRAND TOTAL</td>
              <td className="p-2 text-right tabular-nums underline">{fmtCurrency(rows.reduce((a, r) => a + Number(r.total_omset || 0), 0))}</td>
              <td className="p-2 text-right tabular-nums">{fmtCurrency(rows.reduce((a, r) => a + Number(r.num_customer || 0), 0))}</td>
              <td className="p-2 text-right tabular-nums">{fmtCurrency(rows.reduce((a, r) => a + Number(r.num_trx || 0), 0))}</td>
              <td className="p-2 text-right tabular-nums">{fmtCurrency(rows.reduce((a, r) => a + Number(r.total_kacamata || 0), 0))}</td>
              <td className="p-2 text-right tabular-nums">{fmtCurrency(rows.reduce((a, r) => a + Number(r.total_ganti_lensa || 0), 0))}</td>
              <td className="p-2 text-right tabular-nums">{fmtCurrency(rows.reduce((a, r) => a + Number(r.total_ganti_frame || 0), 0))}</td>
              <td className="p-2 text-right tabular-nums">{fmtCurrency(rows.reduce((a, r) => a + Number(r.total_softlens || 0), 0))}</td>
              <td className="p-2 text-right tabular-nums text-orange-600">{fmtCurrency(rows.reduce((a, r) => a + Number(r.total_ongkir || 0), 0))}</td>
              <td className="p-2"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <Pagination
        className="mt-3"
        page={meta.page}
        totalPages={meta.totalPages}
        total={meta.total}
        disabledPrev={meta.limit >= 1000 || meta.page <= 1 || loading}
        disabledNext={meta.limit >= 1000 || meta.page >= meta.totalPages || loading}
        onPrev={() => setMeta(m => ({ ...m, page: Math.max(1, m.page - 1) }))}
        onNext={() => setMeta(m => ({ ...m, page: Math.min(m.totalPages, m.page + 1) }))}
      />
    </div>
  )
}

function fmtCurrency(n) {
  return Number(n || 0).toLocaleString('id-ID')
}

function RowDetailOmset({ cabangId, tanggal, openRows, setOpenRows, itemsMap, setItemsMap }) {
  const key = `${cabangId}-${tanggal}`
  const open = !!openRows[key]
  const [loading, setLoading] = React.useState(false)
  const toggle = async () => {
    if (!tanggal) return
    if (!open && !itemsMap[key]) {
      setLoading(true)
      const url = `${API_BASE}/api/omset/toko/day/items?cabang=${cabangId}&tanggal=${tanggal}`
      const res = await fetch(url)
      const json = await res.json()
      setItemsMap(m => ({ ...m, [key]: json.data || [] }))
      setLoading(false)
    }
    setOpenRows(m => ({ ...m, [key]: !open }))
  }
  return <Button onClick={toggle} disabled={loading || !tanggal}>{loading ? 'Memuat...' : (!tanggal ? 'Pilih tanggal' : (open ? 'Tutup' : 'Detail'))}</Button>
}

function DetailRowOmset({ cabangId, keyRow, openRows, itemsMap, loading }) {
  const open = !!openRows[keyRow]
  const items = itemsMap[keyRow] || []
  if (!open) return null
  return (
    <tr className="bg-slate-50">
      <td className="p-2" colSpan={11}>
        <div className="pl-6 border-l-4 border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 uppercase text-[9px] font-bold text-slate-500 tracking-wider">
              <tr>
                <th className="p-2 text-left w-8">No</th>
                <th className="p-2 text-left w-24">Transaksi</th>
                <th className="p-2 text-left">Customer</th>
                <th className="p-2 text-left">Produk</th>
                <th className="p-2 text-left">Jenis</th>
                <th className="p-2 text-right">Qty</th>
                <th className="p-2 text-right">Harga Unit</th>
                <th className="p-2 text-right">Total Jual</th>
                <th className="p-2 text-right">Laba Item</th>
                <th className="p-2 text-left">Tanggal</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableBodySkeleton rows={6} cols={10} />
              ) : items.map((it, idx) => (
                <tr key={`${keyRow}-${idx}`} className="border-t hover:bg-white transition-colors">
                  <td className="p-2 text-slate-400 font-mono text-[9px]">{idx + 1}</td>
                  <td className="p-2 font-mono text-[10px]">{it.kode_transaksi || it.id_grosir}</td>
                  <td className="p-2 font-medium">
                    <CustomerDetailTrigger name={it.nama_customer || (it.kode_transaksi || it.id_grosir)} kodeTransaksi={it.kode_transaksi || it.id_grosir}>
                      <span className="text-primary hover:underline cursor-pointer">{it.nama_customer || (it.kode_transaksi || it.id_grosir)}</span>
                    </CustomerDetailTrigger>
                  </td>
                  <td className="p-2">{it.nama_produk || `${it.jenis_produk} #${it.id_produk}`}</td>
                  <td className="p-2 opacity-70">{it.jenis_produk}</td>
                  <td className="p-2 text-right tabular-nums">{it.jumlah}</td>
                  <td className="p-2 text-right tabular-nums">{fmtCurrency(it.harga_produk)}</td>
                  <td className="p-2 text-right tabular-nums font-medium">{fmtCurrency(it.jumlah_harga === 0 ? (Number(it.harga_produk || 0) * Number(it.jumlah || 0)) : it.jumlah_harga)}</td>
                  <td className="p-2 text-right tabular-nums font-semibold text-green-700">{fmtCurrency(it.laba_item)}</td>
                  <td className="p-2 text-[10px] text-slate-500">{formatDate(it.tanggal_log)}</td>
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr><td className="p-3 text-center text-slate-400" colSpan={10}>Tidak ada item transaksi</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  )
}

function formatDate(s) {
  if (!s) return ''
  if (typeof s === 'string') return s.slice(0, 10)
  try { return new Date(s).toLocaleDateString('id-ID') } catch { return String(s) }
}
