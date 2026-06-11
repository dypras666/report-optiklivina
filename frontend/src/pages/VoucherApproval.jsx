import React from 'react'
import Pagination from '@/components/ui/Pagination.jsx'
import { TableBodySkeleton } from '@/components/ui/TableSkeleton.jsx'
import { tableClass, theadClass, containerClass } from '@/components/ui/tableStyles.js'
import { Button } from '@/components/ui/button'
import { Check, X, AlertCircle } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://reportsapi.optiklivina.com'

export default function VoucherApproval() {
    const [rows, setRows] = React.useState([])
    const [loading, setLoading] = React.useState(false)
    const [meta, setMeta] = React.useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
    const [q, setQ] = React.useState('')
    const [cabang, setCabang] = React.useState('')
    const [status, setStatus] = React.useState('pending')
    const [cabangOpts, setCabangOpts] = React.useState([])
    const [actionLoading, setActionLoading] = React.useState(null)

    React.useEffect(() => {
        fetch(`${API_BASE}/api/options/cabang`)
            .then(r => r.json())
            .then(j => setCabangOpts(j.data || []))
            .catch(() => { })
    }, [])

    React.useEffect(() => { fetchData() }, [meta.page, q, cabang, status])

    async function fetchData() {
        setLoading(true)
        const p = new URLSearchParams()
        if (q) p.set('q', q)
        if (cabang) p.set('cabang', cabang)
        p.set('status', status)
        p.set('page', meta.page)
        p.set('limit', meta.limit)

        try {
            const token = localStorage.getItem('authToken')
            const headers = new Headers()
            if (token) headers.set('Authorization', `Bearer ${token}`)

            const res = await fetch(`${API_BASE}/api/reports/pending-voucher?${p.toString()}`, { headers })
            const json = await res.json()
            setRows(json.data || [])
            setMeta(json.meta || { page: 1, limit: 20, total: 0, totalPages: 0 })
        } catch (e) {
            console.error(e)
        } finally { setLoading(false) }
    }

    async function handleAction(id, action) {
        const confirmMsg = action === 'approve' ? 'menyetujui' : (action === 'reject' ? 'menolak' : 'mengembalikan ke pending (rollback)')
        if (!window.confirm(`Apakah Anda yakin ingin ${confirmMsg} pembayaran ini?`)) return

        setActionLoading(id)
        try {
            const token = localStorage.getItem('authToken')
            const res = await fetch(`${API_BASE}/api/reports/${action}-voucher/${id}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const json = await res.json()
            if (json.status) {
                alert(json.msg)
                fetchData()
            } else {
                alert(json.error || 'Gagal memproses permintaan')
            }
        } catch (e) {
            alert('Kesalahan sistem: ' + e.message)
        } finally {
            setActionLoading(null)
        }
    }

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    Approval Voucher
                    <span className="bg-amber-100 text-amber-600 text-xs px-2 py-1 rounded-full">{meta.total} Data</span>
                </h1>
                <p className="text-slate-500 text-sm mt-1">Kelola pembayaran voucher: Setujui, Tolak, atau Rollback.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col">
                    <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total Voucher</span>
                    <span className="text-2xl font-bold text-green-600 mt-1">{fmtCurrency(meta.summary?.total_voucher || 0)}</span>
                </div>
                <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col">
                    <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total Cash Masuk</span>
                    <span className="text-2xl font-bold text-slate-700 mt-1">{fmtCurrency(meta.summary?.total_cash || 0)}</span>
                </div>
                <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col">
                    <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total Transaksi</span>
                    <span className="text-2xl font-bold text-blue-600 mt-1">{meta.total}</span>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4 bg-white p-3 rounded-lg border shadow-sm">
                <input
                    className="border rounded-md px-3 py-1.5 text-sm w-64 focus:ring-2 focus:ring-slate-200 outline-none transition-all"
                    placeholder="Cari customer / transaksi..."
                    value={q}
                    onChange={e => { setQ(e.target.value); setMeta(m => ({ ...m, page: 1 })) }}
                />
                <select
                    className="border rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                    value={cabang}
                    onChange={e => { setCabang(e.target.value); setMeta(m => ({ ...m, page: 1 })) }}
                >
                    <option value="">Semua Cabang</option>
                    {cabangOpts.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <select
                    className="border rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-slate-200 font-medium"
                    value={status}
                    onChange={e => { setStatus(e.target.value); setMeta(m => ({ ...m, page: 1 })) }}
                >
                    <option value="pending">⏳ Pending (Menunggu)</option>
                    <option value="ok">✅ Approved (Disetujui)</option>
                    <option value="rejected">❌ Rejected (Ditolak)</option>
                    <option value="all">📁 Semua Status</option>
                </select>
                <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
                    <AlertCircle className="h-3 w-3" />
                    Pembukuan harus aktif untuk merubah saldo
                </div>
            </div>

            <div className={containerClass}>
                <table className={tableClass}>
                    <thead className={theadClass}>
                        <tr>
                            <th className="p-3 text-left w-12 text-slate-400 font-mono text-[10px]">#</th>
                            <th className="p-3 text-left">Tanggal</th>
                            <th className="p-3 text-left">Customer</th>
                            <th className="p-3 text-left">Transaksi</th>
                            <th className="p-3 text-left">Marketing / Cabang</th>
                            <th className="p-3 text-right">Cash</th>
                            <th className="p-3 text-right text-green-600">Voucher</th>
                            <th className="p-3 text-center">Status</th>
                            <th className="p-3 text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <TableBodySkeleton rows={5} cols={9} />
                        ) : (
                            <>
                                {rows.map((r, idx) => (
                                    <tr key={r.id_pembayaran} className="hover:bg-slate-50 transition-colors group">
                                        <td className="p-3 text-slate-400 font-mono text-[10px]">{(meta.page - 1) * meta.limit + idx + 1}</td>
                                        <td className="p-3 text-xs text-slate-500">{formatDate(r.tanggal_bayar)}</td>
                                        <td className="p-3">
                                            <div className="font-semibold text-slate-700">{r.nama_customer || '-'}</div>
                                            <div className="text-[10px] text-slate-400 font-mono uppercase tracking-tight">{r.kode_customer}</div>
                                        </td>
                                        <td className="p-3 font-mono text-xs text-slate-600">{r.kode_transaksi}</td>
                                        <td className="p-3">
                                            <div className="text-sm font-medium text-slate-600">{r.nama_marketing || '-'}</div>
                                            <div className="text-[10px] opacity-60 uppercase">{r.nama_cabang}</div>
                                        </td>
                                        <td className="p-3 text-right tabular-nums text-sm font-medium text-slate-500">{fmtCurrency(r.jumlah_bayar)}</td>
                                        <td className="p-3 text-right tabular-nums font-bold text-green-600 italic">+{fmtCurrency(r.voucher)}</td>
                                        <td className="p-3 text-center">
                                            {r.status_bayar === 'pending' && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">Pending</span>}
                                            {r.status_bayar === 'ok' && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">Approved</span>}
                                            {r.status_bayar === 'rejected' && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">Rejected</span>}
                                        </td>
                                        <td className="p-3 text-center">
                                            <div className="flex justify-center gap-1 transition-opacity">
                                                {r.status_bayar === 'pending' && (
                                                    <>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            title="Approve"
                                                            className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                            disabled={!!actionLoading}
                                                            onClick={() => handleAction(r.id_pembayaran, 'approve')}
                                                        >
                                                            <Check className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            title="Reject"
                                                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                            disabled={!!actionLoading}
                                                            onClick={() => handleAction(r.id_pembayaran, 'reject')}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </>
                                                )}
                                                {(r.status_bayar === 'ok' || r.status_bayar === 'rejected') && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        title="Batalkan (Rollback ke Pending)"
                                                        className="h-8 px-2 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                                        disabled={!!actionLoading}
                                                        onClick={() => handleAction(r.id_pembayaran, 'rollback')}
                                                    >
                                                        Batal
                                                    </Button>
                                                )}
                                            </div>
                                            {actionLoading === r.id_pembayaran && <span className="text-[9px] text-slate-400">Processing...</span>}
                                        </td>
                                    </tr>
                                ))}
                                {rows.length === 0 && (
                                    <tr><td className="p-8 text-center text-slate-400 italic font-light" colSpan={9}>Tidak ada data voucher dengan status ini.</td></tr>
                                )}
                            </>
                        )}
                    </tbody>
                </table>
            </div>

            <Pagination
                className="mt-4"
                page={meta.page}
                totalPages={meta.totalPages}
                total={meta.total}
                disabledPrev={meta.page <= 1 || loading}
                disabledNext={meta.page >= meta.totalPages || loading}
                onPrev={() => setMeta(m => ({ ...m, page: Math.max(1, m.page - 1) }))}
                onNext={() => setMeta(m => ({ ...m, page: Math.min(m.totalPages, m.page + 1) }))}
            />
        </div>
    )
}

function fmtCurrency(n) { return Number(n || 0).toLocaleString('id-ID') }
function formatDate(s) {
    if (!s) return ''
    try { return new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return String(s) }
}
