import React from 'react'
import Pagination from '@/components/ui/Pagination.jsx'
import { TableBodySkeleton } from '@/components/ui/TableSkeleton.jsx'
import { tableClass, theadClass, containerClass } from '@/components/ui/tableStyles.js'
import MarketingTransactionDetailTrigger from '@/components/marketing/MarketingTransactionDetailTrigger.jsx'
import CustomerDetailTrigger from '@/components/customer/CustomerDetailTrigger.jsx'
import { Search, Filter, History, User } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://reportsapi.optiklivina.com'

export default function PointUsage({ filters: globalFilters, listPembukuan }) {
    const [rows, setRows] = React.useState([])
    const [summary, setSummary] = React.useState(null)
    const [loading, setLoading] = React.useState(false)
    const [meta, setMeta] = React.useState({ page: 1, limit: 50, total: 0, totalPages: 0 })
    const [q, setQ] = React.useState('')
    const [pembukuanId, setPembukuanId] = React.useState(globalFilters?.pembukuan_id || '')

    React.useEffect(() => {
        if (globalFilters?.pembukuan_id && !pembukuanId) {
            setPembukuanId(globalFilters.pembukuan_id)
        }
    }, [globalFilters])

    React.useEffect(() => { fetchData() }, [meta.page, meta.limit, q, pembukuanId])

    async function fetchData() {
        setLoading(true)
        const p = new URLSearchParams()
        if (q) p.set('q', q)
        if (pembukuanId) p.set('pembukuan_id', pembukuanId)
        p.set('page', meta.page)
        p.set('limit', meta.limit)

        try {
            const token = localStorage.getItem('authToken')
            const headers = new Headers()
            if (token) headers.set('Authorization', `Bearer ${token}`)

            const res = await fetch(`${API_BASE}/api/reports/point-usage?${p.toString()}`, { headers })
            const json = await res.json()
            setRows(json.data || [])
            setSummary(json.summary || null)
            setMeta(json.meta || { page: 1, limit: 50, total: 0, totalPages: 0 })
        } catch (e) {
            console.error(e)
        } finally { setLoading(false) }
    }

    function formatDate(s) {
        if (!s) return '-'
        try {
            const d = new Date(s)
            return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' +
                d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        }
        catch { return String(s) }
    }

    function fmtCurrency(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID') }

    return (
        <div className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                        <History className="text-primary" />
                        Log Penggunaan Poin
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Audit log pemakaian poin customer untuk pembayaran transaksi.</p>
                </div>
                {summary && (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex flex-col items-end">
                        <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Total Poin Digunakan</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black text-amber-700">{summary.total_points_used.toLocaleString('id-ID')}</span>
                            <span className="text-sm font-bold text-amber-600">PTS</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-6 bg-white p-4 rounded-xl border shadow-sm">
                <div className="relative flex-1 min-w-[300px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        className="w-full border rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                        placeholder="Cari nama customer, kode customer, atau kode transaksi..."
                        value={q}
                        onChange={e => { setQ(e.target.value); setMeta(m => ({ ...m, page: 1 })) }}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter size={16} className="text-slate-400" />
                    <select
                        className="border rounded-lg px-3 py-2 text-sm bg-white"
                        value={pembukuanId}
                        onChange={e => { setPembukuanId(e.target.value); setMeta(m => ({ ...m, page: 1 })) }}
                    >
                        <option value="">Semua Periode</option>
                        {listPembukuan?.map(p => (
                            <option key={p.id_toko_tutup} value={p.id_toko_tutup}>
                                {p.tanggal_buka_buku} — {p.tanggal_tutup_buku}
                            </option>
                        ))}
                    </select>
                </div>
                <select
                    className="border rounded-lg px-3 py-2 text-sm bg-white"
                    value={meta.limit}
                    onChange={e => setMeta(m => ({ ...m, page: 1, limit: parseInt(e.target.value, 10) }))}
                >
                    <option value={20}>20 baris</option>
                    <option value={50}>50 baris</option>
                    <option value={100}>100 baris</option>
                </select>
                <button
                    onClick={fetchData}
                    className="px-5 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-700 transition-all shadow-sm active:scale-95"
                >
                    Refresh
                </button>
            </div>

            <div className={containerClass + " rounded-xl shadow-sm border border-slate-200 overflow-hidden"}>
                <table className={tableClass}>
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="p-4 text-left w-12 text-[10px] font-bold text-slate-500 uppercase tracking-widest">No</th>
                            <th className="p-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Waktu Log</th>
                            <th className="p-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Customer</th>
                            <th className="p-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Transaksi</th>
                            <th className="p-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Cabang</th>
                            <th className="p-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nominal</th>
                            <th className="p-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Poin Pakai</th>
                            <th className="p-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">Petugas</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {loading ? (
                            <TableBodySkeleton rows={10} cols={8} />
                        ) : (
                            <>
                                {rows.map((r, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="p-4 text-slate-400 text-sm">{(meta.page - 1) * meta.limit + idx + 1}</td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-slate-700 whitespace-nowrap">{formatDate(r.tanggal_penggunaan).split(' ')[0]}</span>
                                                <span className="text-[10px] text-slate-400 font-mono">{formatDate(r.tanggal_penggunaan).split(' ')[1]}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <CustomerDetailTrigger name={r.nama_customer} kodeTransaksi={r.kode_transaksi} status={r.status_user}>
                                                <div className="flex flex-col cursor-pointer group/cust">
                                                    <span className="font-bold text-slate-800 group-hover/cust:text-primary transition-colors">{r.nama_customer || '-'}</span>
                                                    <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                                                        {r.kode_customer}
                                                        {r.no_hp && <span className="text-slate-300">• {r.no_hp}</span>}
                                                    </span>
                                                </div>
                                            </CustomerDetailTrigger>
                                        </td>
                                        <td className="p-4">
                                            <MarketingTransactionDetailTrigger kodeTransaksi={r.kode_transaksi}>
                                                <div className="flex flex-col cursor-pointer group/trx">
                                                    <span className="text-sm font-mono text-primary font-bold group-hover/trx:underline">{r.kode_transaksi || '-'}</span>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-100 text-slate-600 font-bold uppercase tracking-tighter">
                                                            {r.jenis_beli || 'N/A'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </MarketingTransactionDetailTrigger>
                                        </td>
                                        <td className="p-4 text-sm text-slate-600 font-medium">{r.nama_cabang || '-'}</td>
                                        <td className="p-4 text-right">
                                            <span className="text-sm font-bold text-slate-700">{fmtCurrency(r.nominal_transaksi)}</span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200 font-black tabular-nums shadow-sm group-hover:bg-amber-500 group-hover:text-white group-hover:border-amber-600 transition-all duration-300">
                                                <span className="text-sm">{r.point_use}</span>
                                                <span className="text-[9px] uppercase tracking-wider opacity-80">pts</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                                                <User size={10} className="text-slate-400" />
                                                {r.nama_sales || r.username || 'System'}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {rows.length === 0 && (
                                    <tr><td className="p-16 text-center text-slate-400 italic font-medium" colSpan={8}>Tidak ada log penggunaan poin untuk filter ini</td></tr>
                                )}
                            </>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <p className="text-xs text-slate-500 font-medium">
                    Menampilkan <span className="text-slate-800 font-bold">{rows.length}</span> dari <span className="text-slate-800 font-bold">{meta.total}</span> riwayat penggunaan poin.
                </p>
                <Pagination
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
        </div>
    )
}
