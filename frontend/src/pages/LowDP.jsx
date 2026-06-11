import React, { useEffect, useMemo, useState } from 'react'
import Pagination from '@/components/ui/Pagination.jsx'
import { TableBodySkeleton } from '@/components/ui/TableSkeleton.jsx'
import { containerClass, tableClass, theadClass } from '@/components/ui/tableStyles.js'
import { Button } from '@/components/ui/button'
import MarketingTransactionDetailTrigger from '@/components/marketing/MarketingTransactionDetailTrigger.jsx'
import { Combobox } from '@/components/ui/combobox'
import { AlertTriangle, TrendingDown, DollarSign, Users, Percent } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://reportsapi.optiklivina.com'

export default function LowDP() {
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)
    const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
    const [filters, setFilters] = useState({ pembukuan_id: '', cabang: '', marketing: '', q: '' })
    const [listPembukuan, setListPembukuan] = useState([])
    const [cabangOpts, setCabangOpts] = useState([])
    const [marketingOpts, setMarketingOpts] = useState([])
    const [summary, setSummary] = useState({
        total_transaksi: 0,
        total_fix_harga: 0,
        total_dp: 0,
        total_sisa_bayar: 0,
        avg_dp_percent: 0
    })

    const qs = useMemo(() => {
        const p = new URLSearchParams()
        if (filters.pembukuan_id) { p.set('pembukuan_id', filters.pembukuan_id) }
        if (filters.cabang) { p.set('cabang', filters.cabang) }
        if (filters.marketing) { p.set('marketing', filters.marketing) }
        if (filters.q) { p.set('q', filters.q) }
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

    useEffect(() => { initPembukuan().then(initOptions) }, [])
    useEffect(() => { if (filters.pembukuan_id) fetchData() }, [meta.page, meta.limit, filters.pembukuan_id, filters.cabang, filters.marketing])
    useEffect(() => { setMeta(m => ({ ...m, page: 1 })) }, [filters.pembukuan_id, filters.cabang, filters.marketing])

    async function fetchData() {
        if (!filters.pembukuan_id) return
        setLoading(true)
        try {
            const url = `${API_BASE}/api/reports/marketing-low-dp${qs ? `?${qs}` : ''}`
            const res = await fetch(url)
            const json = await res.json()
            const incomingMeta = json.meta || { page: 1, limit: 20, total: 0, totalPages: 0 }
            const requestedPage = Number(incomingMeta.page || 1)
            const totalPages = Number(incomingMeta.totalPages || 0)
            const finalPage = (totalPages > 0 && requestedPage > totalPages) ? totalPages : requestedPage
            setRows(json.data || [])
            setSummary(json.summary || { total_transaksi: 0, total_fix_harga: 0, total_dp: 0, total_sisa_bayar: 0, avg_dp_percent: 0 })
            setMeta({ ...incomingMeta, page: finalPage })
        } catch (e) { console.error(e) } finally { setLoading(false) }
    }

    function handleSearch(e) {
        e.preventDefault()
        setMeta(m => ({ ...m, page: 1 }))
        fetchData()
    }

    return (
        <div className={containerClass}>
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 rounded-lg">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-semibold">Laporan DP Dibawah 20%</h1>
                    <p className="text-sm text-slate-500">Transaksi yang belum lunas dengan DP kurang dari 20%</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                <div className="bg-white border rounded-lg p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-slate-500 mb-1">
                        <Users className="h-4 w-4" />
                        <span className="text-xs">Total Transaksi</span>
                    </div>
                    <div className="text-xl font-bold text-slate-800">{fmtCurrency(summary.total_transaksi)}</div>
                </div>
                <div className="bg-white border rounded-lg p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-slate-500 mb-1">
                        <DollarSign className="h-4 w-4" />
                        <span className="text-xs">Total Harga</span>
                    </div>
                    <div className="text-xl font-bold text-slate-800">Rp {fmtCurrency(summary.total_fix_harga)}</div>
                </div>
                <div className="bg-white border rounded-lg p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-green-500 mb-1">
                        <TrendingDown className="h-4 w-4" />
                        <span className="text-xs">Total DP</span>
                    </div>
                    <div className="text-xl font-bold text-green-600">Rp {fmtCurrency(summary.total_dp)}</div>
                </div>
                <div className="bg-white border rounded-lg p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-red-500 mb-1">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-xs">Total Sisa</span>
                    </div>
                    <div className="text-xl font-bold text-red-600">Rp {fmtCurrency(summary.total_sisa_bayar)}</div>
                </div>
                <div className="bg-white border rounded-lg p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-orange-500 mb-1">
                        <Percent className="h-4 w-4" />
                        <span className="text-xs">Rata-rata DP</span>
                    </div>
                    <div className="text-xl font-bold text-orange-600">{Number(summary.avg_dp_percent || 0).toFixed(1)}%</div>
                </div>
            </div>

            {/* Filters */}
            <form onSubmit={handleSearch} className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-4">
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
                <input
                    type="text"
                    className="border rounded px-2 py-1"
                    placeholder="Cari transaksi/customer..."
                    value={filters.q}
                    onChange={e => setFilters(f => ({ ...f, q: e.target.value }))}
                />
                <select className="border rounded px-2 py-1" value={meta.limit} onChange={e => setMeta(m => ({ ...m, page: 1, limit: parseInt(e.target.value, 10) }))}>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                </select>
                <Button type="submit" disabled={loading}>{loading ? 'Memuat...' : 'Filter'}</Button>
            </form>

            {/* Table */}
            <div className="overflow-auto border rounded shadow-sm">
                <table className={tableClass}>
                    <thead className={theadClass + " bg-slate-100 uppercase text-[10px] font-bold text-slate-600 tracking-wider sticky top-0"}>
                        <tr>
                            <th className="p-2 text-left w-12">No</th>
                            <th className="p-2 text-left w-24">Kode Trx</th>
                            <th className="p-2 text-left">Customer</th>
                            <th className="p-2 text-left">Marketing / Toko</th>
                            <th className="p-2 text-right">Total Harga</th>
                            <th className="p-2 text-right">DP</th>
                            <th className="p-2 text-center">% DP</th>
                            <th className="p-2 text-right">Sisa Bayar</th>
                            <th className="p-2 text-center">Umur</th>
                            <th className="p-2 text-left">Tanggal</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <TableBodySkeleton rows={10} cols={10} />
                        ) : rows.map((row, idx) => (
                            <tr key={`${row.kode_transaksi}-${idx}`} className="border-t hover:bg-slate-50 transition-colors">
                                <td className="p-2 text-slate-400 font-mono text-[10px]">{((meta.page - 1) * meta.limit) + idx + 1}</td>
                                <td className="p-2 font-mono text-xs">
                                    <MarketingTransactionDetailTrigger kodeTransaksi={row.kode_transaksi}>
                                        <span className="text-primary hover:underline cursor-pointer">{row.kode_transaksi}</span>
                                    </MarketingTransactionDetailTrigger>
                                </td>
                                <td className="p-2">
                                    <div className="font-medium">{row.nama_customer}</div>
                                </td>
                                <td className="p-2 text-xs text-slate-500 font-medium">{[row.nama_lengkap, row.nama_cabang].filter(Boolean).join(' / ')}</td>
                                <td className="p-2 text-right font-semibold tabular-nums">{fmtCurrency(row.fix_harga)}</td>
                                <td className="p-2 text-right text-green-700 tabular-nums font-medium">{fmtCurrency(row.jml_bayar || 0)}</td>
                                <td className="p-2 text-center">
                                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tabular-nums ${Number(row.dp_percent) === 0 ? 'bg-red-100 text-red-700' :
                                        Number(row.dp_percent) < 10 ? 'bg-orange-100 text-orange-700' :
                                            'bg-yellow-100 text-yellow-700'
                                        }`}>
                                        {Number(row.dp_percent || 0).toFixed(1)}%
                                    </span>
                                </td>
                                <td className="p-2 text-right text-red-600 font-bold tabular-nums">{fmtCurrency(row.sisa_bayar)}</td>
                                <td className="p-2 text-center">
                                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${Number(row.days_since_order) > 90 ? 'bg-red-100 text-red-700' :
                                        Number(row.days_since_order) > 30 ? 'bg-orange-100 text-orange-700' :
                                            'bg-slate-100 text-slate-700'
                                        }`}>
                                        {row.days_since_order} HR
                                    </span>
                                </td>
                                <td className="p-2 text-[10px] uppercase text-slate-500">{formatDate(row.tanggal_order)}</td>
                            </tr>
                        ))}
                        {!loading && rows.length === 0 && (
                            <tr>
                                <td className="p-4 text-center text-slate-500" colSpan={10}>
                                    <div className="flex flex-col items-center gap-2 py-6">
                                        <AlertTriangle className="h-8 w-8 text-slate-300" />
                                        <span>Tidak ada transaksi dengan DP dibawah 20%</span>
                                    </div>
                                </td>
                            </tr>
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
