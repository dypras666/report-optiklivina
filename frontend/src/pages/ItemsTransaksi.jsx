import React, { useEffect, useMemo, useState } from 'react'
import Pagination from '@/components/ui/Pagination.jsx'
import { TableBodySkeleton } from '@/components/ui/TableSkeleton.jsx'
import { containerClass, tableClass, theadClass } from '@/components/ui/tableStyles.js'
import { Button } from '@/components/ui/button'
import MarketingTransactionDetailTrigger from '@/components/marketing/MarketingTransactionDetailTrigger.jsx'
import { Combobox } from '@/components/ui/combobox'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://reportsapi.optiklivina.com'

export default function ItemsTransaksi() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [filters, setFilters] = useState({ pembukuan_id: '', cabang: '', marketing: '' })
  const [listPembukuan, setListPembukuan] = useState([])
  const [cabangOpts, setCabangOpts] = useState([])
  const [marketingOpts, setMarketingOpts] = useState([])

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    if (filters.pembukuan_id) { p.set('pembukuan_id', filters.pembukuan_id) }
    if (filters.cabang) { p.set('cabang', filters.cabang) }
    if (filters.marketing) { p.set('marketing', filters.marketing) }
    if (meta.page) { p.set('page', meta.page) }
    if (meta.limit) { p.set('limit', meta.limit) }
    return p.toString()
  }, [filters, meta.page, meta.limit])

  async function initPembukuan() {
    const [activeRes, listRes] = await Promise.all([
      fetch(`${API_BASE}/api/pembukuan/active`),
      fetch(`${API_BASE}/api/pembukuan/list`)
    ])
    const activeJson = await activeRes.json()
    const listJson = await listRes.json()
    setListPembukuan(listJson.data || [])
    if (activeJson.data && activeJson.data.id_toko_tutup) {
      setFilters(f => ({ ...f, pembukuan_id: String(activeJson.data.id_toko_tutup) }))
    }
  }

  async function initOptions() {
    const [mRes, cRes] = await Promise.all([
      fetch(`${API_BASE}/api/options/marketing`),
      fetch(`${API_BASE}/api/options/cabang`)
    ])
    const mJson = await mRes.json()
    const cJson = await cRes.json()
    setMarketingOpts(mJson.data || [])
    setCabangOpts(cJson.data || [])
  }

  useEffect(() => { initPembukuan().then(initOptions).then(fetchData) }, [])
  useEffect(() => { fetchData() }, [meta.page, meta.limit, filters.pembukuan_id, filters.cabang, filters.marketing])
  useEffect(() => { setMeta(m => ({ ...m, page: 1 })) }, [filters.pembukuan_id, filters.cabang, filters.marketing])

  async function fetchData() {
    if (!filters.pembukuan_id) return
    setLoading(true)
    try {
      const url = `${API_BASE}/api/marketing/marketing/items/page${qs ? `?${qs}` : ''}`
      const res = await fetch(url)
      const json = await res.json()
      const incomingMeta = json.meta || { page: 1, limit: 20, total: 0, totalPages: 0 }
      const requestedPage = Number(incomingMeta.page || 1)
      const totalPages = Number(incomingMeta.totalPages || 0)
      const finalPage = (totalPages > 0 && requestedPage > totalPages) ? totalPages : requestedPage
      setRows(json.data || [])
      setMeta({ ...incomingMeta, page: finalPage })
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  return (
    <div className={containerClass}>
      <h1 className="text-2xl font-semibold mb-2">Items Transaksi</h1>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-4">
        <select className="border rounded px-2 py-1" value={filters.pembukuan_id} onChange={e => setFilters(f => ({ ...f, pembukuan_id: e.target.value }))}>
          <option value="">Pilih pembukuan</option>
          {listPembukuan.map(p => (
            <option key={p.id_toko_tutup} value={p.id_toko_tutup}>{p.tanggal_buka_buku} — {p.tanggal_tutup_buku}</option>
          ))}
        </select>
        <select className="border rounded px-2 py-1" value={filters.cabang} onChange={e => setFilters(f => ({ ...f, cabang: e.target.value }))}>
          <option value="">Pilih cabang</option>
          {cabangOpts.map(c => (<option key={c.value} value={c.value}>{c.label}</option>))}
        </select>
        <Combobox
          options={marketingOpts}
          value={filters.marketing}
          onChange={val => setFilters(f => ({ ...f, marketing: val }))}
          placeholder="Pilih marketing"
          className="w-full"
        />
        <select className="border rounded px-2 py-1" value={meta.limit} onChange={e => setMeta(m => ({ ...m, page: 1, limit: parseInt(e.target.value, 10) }))}>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={200}>200</option>
        </select>
        <Button onClick={fetchData} disabled={loading}>{loading ? 'Memuat...' : 'Filter'}</Button>
      </div>

      <div className="overflow-auto border rounded">
        <table className={tableClass}>
          <thead className={theadClass}>
            <tr>
              <th className="p-2 text-left">NO</th>
              <th className="p-2 text-left">Nama Produk</th>
              <th className="p-2 text-right">QTY</th>
              <th className="p-2 text-left">Customer</th>
              <th className="p-2 text-left">Marketing / Toko</th>
              <th className="p-2 text-right">Modal</th>
              <th className="p-2 text-right">Ongkir</th>
              <th className="p-2 text-right">Laba</th>
              <th className="p-2 text-left">Tanggal</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableBodySkeleton rows={10} cols={9} />
            ) : rows.map((it, idx) => (
              <tr key={`${it.kode_transaksi}-${it.id_sg_log}-${idx}`} className="border-t">
                <td className="p-2">{((meta.page - 1) * meta.limit) + idx + 1}</td>
                <td className="p-2"><MarketingTransactionDetailTrigger kodeTransaksi={it.kode_transaksi}>{it.nama_produk || `${it.jenis_produk} #${it.id_produk}`}</MarketingTransactionDetailTrigger></td>
                <td className="p-2 text-right">{fmtCurrency(it.jumlah)}</td>
                <td className="p-2">{it.nama_customer}</td>
                <td className="p-2">{[it.nama_lengkap, it.nama_cabang].filter(Boolean).join(' / ')}</td>
                <td className="p-2 text-right">{fmtCurrency(it.jumlah_modal)}</td>
                <td className="p-2 text-right">{fmtCurrency(it.jumlah_ongkir)}</td>
                <td className="p-2 text-right">{fmtCurrency(it.laba_item)}</td>
                <td className="p-2">{formatDate(it.tanggal_log)}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td className="p-3" colSpan={9}>Tidak ada data</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        className="mt-3"
        page={meta.page}
        totalPages={meta.totalPages}
        total={meta.total}
        disabledPrev={meta.page <= 1 || loading}
        disabledNext={meta.page >= meta.totalPages || loading}
        onPrev={() => setMeta(m => ({ ...m, page: Math.max(1, m.page - 1) }))}
        onNext={() => setMeta(m => ({ ...m, page: Math.min(m.totalPages, m.page + 1) }))}
        onJump={(p) => setMeta(m => ({ ...m, page: p }))}
      />
    </div>
  )
}

function fmtCurrency(n) {
  return Number(n || 0).toLocaleString('id-ID')
}

function formatDate(s) {
  if (!s) return ''
  if (typeof s === 'string') return s.slice(0, 10)
  try { return new Date(s).toLocaleDateString('id-ID') } catch { return String(s) }
}
