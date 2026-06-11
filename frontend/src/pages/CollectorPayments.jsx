import React, { useState, useEffect } from 'react'
import { Search, Percent, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TableBodySkeleton } from '@/components/ui/TableSkeleton.jsx'
import Pagination from '@/components/ui/Pagination.jsx'
import MarketingTransactionDetailTrigger from '@/components/marketing/MarketingTransactionDetailTrigger.jsx'
import CustomerDetailTrigger from '@/components/customer/CustomerDetailTrigger.jsx'
import { containerClass, tableClass, theadClass } from '@/components/ui/tableStyles.js'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://reportsapi.optiklivina.com'

export default function CollectorPayments({ filters }) {
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(false)
    const [q, setQ] = useState('')
    const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 })
    const [confirm, setConfirm] = useState({ open: false, kode: '', status: '' })

    async function fetchData(page = 1) {
        if (!filters.pembukuan_id) return
        setLoading(true)
        try {
            const params = new URLSearchParams({
                pembukuan_id: filters.pembukuan_id,
                page: page.toString(),
                limit: meta.limit.toString(),
                q: q
            })
            const res = await fetch(`${API_BASE}/api/reports/collector-payments?${params.toString()}`)
            const json = await res.json()
            setData(json.data || [])
            setMeta(json.meta || { page: 1, limit: 20, total: 0, totalPages: 1 })
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData(1)
    }, [filters.pembukuan_id])

    const handleSearch = (e) => {
        e.preventDefault()
        fetchData(1)
    }

    const fmtCurrency = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0)
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'

    async function toggleBlacklist(kodeCustomer, curr) {
        const status = String(curr || '').toLowerCase() === 'blacklist' ? '' : 'blacklist'
        try {
            const res = await fetch(`${API_BASE}/api/customers/customer/${kodeCustomer}/status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status })
            })
            const json = await res.json()
            const newStatus = json?.status || null
            setData(prev => prev.map(it => it.kode_customer === kodeCustomer ? { ...it, status_customer: newStatus } : it))
        } catch (e) { console.error(e) }
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6">
                <form onSubmit={handleSearch} className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <Input
                            placeholder="Cari Kode Transaksi, Customer, atau Kolektor..."
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            className="pl-10 bg-slate-50 border-slate-200 focus:bg-white transition-all"
                        />
                    </div>
                    <Button type="submit" disabled={loading}>
                        {loading ? 'Memuat...' : 'Cari'}
                    </Button>
                </form>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className={tableClass}>
                        <thead className={theadClass}>
                            <tr>
                                <th className="px-4 py-3.5 font-semibold">No</th>
                                <th className="px-4 py-3.5 font-semibold">Tanggal Bayar</th>
                                <th className="px-4 py-3.5 font-semibold">Kode Transaksi</th>
                                <th className="px-4 py-3.5 font-semibold">Customer</th>
                                <th className="px-4 py-3.5 font-semibold text-right">Jumlah Bayar</th>
                                <th className="px-4 py-3.5 font-semibold">Kolektor</th>
                                <th className="px-4 py-3.5 font-semibold text-center">Status Cust</th>
                                <th className="px-4 py-3.5 font-semibold text-center">Poin</th>
                                <th className="px-4 py-3.5 font-semibold">Keterangan</th>
                                <th className="px-4 py-3.5 font-semibold text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <TableBodySkeleton rows={8} cols={10} />
                            ) : data.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="px-4 py-12 text-center text-slate-400 italic">
                                        Tidak ada data pembayaran kolektor ditemukan
                                    </td>
                                </tr>
                            ) : data.map((it, idx) => {
                                const isBlack = String(it.status_customer || '').toLowerCase() === 'blacklist'
                                return (
                                    <tr key={it.id_pembayaran} className={`border-t hover:bg-slate-50 transition-colors ${isBlack ? 'bg-red-50/50' : ''}`}>
                                        <td className="px-4 py-3 font-medium text-slate-600">{(meta.page - 1) * meta.limit + idx + 1}</td>
                                        <td className="px-4 py-3 text-slate-600">{formatDate(it.tanggal_bayar)}</td>
                                        <td className="px-4 py-3 font-medium">
                                            <MarketingTransactionDetailTrigger kodeTransaksi={it.kode_transaksi}>
                                                <span className="text-primary hover:underline cursor-pointer">{it.kode_transaksi}</span>
                                            </MarketingTransactionDetailTrigger>
                                        </td>
                                        <td className="px-4 py-3">
                                            <CustomerDetailTrigger name={it.nama_customer} kodeTransaksi={it.kode_transaksi} status={it.status_user}>
                                                <div className="flex flex-col cursor-pointer group">
                                                    <span className="font-semibold text-slate-800 group-hover:text-primary transition-colors">{it.nama_customer}</span>
                                                    <span className="text-xs text-slate-500">{it.kode_customer}</span>
                                                </div>
                                            </CustomerDetailTrigger>
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold text-green-600 tabular-nums">
                                            {fmtCurrency(it.jumlah_bayar)}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">
                                            <div className="flex flex-col">
                                                <span className="font-medium">{it.nama_kolektor || '-'}</span>
                                                <span className="text-xs text-slate-400">Marketing: {it.nama_marketing || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {isBlack ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                                    Blacklist
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                    Normal
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {it.total_poin_digunakan > 0 ? (
                                                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-100 font-bold">
                                                    <span className="text-sm">{it.total_poin_digunakan}</span>
                                                    <span className="text-[10px] uppercase tracking-wider">pts</span>
                                                </div>
                                            ) : <span className="text-slate-300">-</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-1 max-w-[200px]">
                                                {it.keterangan_status && (
                                                    <span className="text-[10px] leading-tight font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                                        Note Kolektor: {it.keterangan_status}
                                                    </span>
                                                )}
                                                {it.keterangan_order && (
                                                    <span className="text-[10px] leading-tight text-slate-500 italic line-clamp-2" title={it.keterangan_order}>
                                                        Order: {it.keterangan_order}
                                                    </span>
                                                )}
                                                {(!it.keterangan_status && !it.keterangan_order) && <span className="text-slate-300">-</span>}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <Button
                                                size="sm"
                                                variant={isBlack ? 'outline' : 'destructive'}
                                                className="h-8 px-3 text-xs"
                                                onClick={() => {
                                                    if (isBlack) {
                                                        toggleBlacklist(it.kode_customer, it.status_customer)
                                                    } else {
                                                        setConfirm({ open: true, kode: it.kode_customer, status: it.status_customer })
                                                    }
                                                }}
                                            >
                                                {isBlack ? 'Unblock' : 'Blacklist'}
                                            </Button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="px-4 py-4 bg-slate-50 border-t border-slate-100">
                    <Pagination
                        page={meta.page}
                        totalPages={meta.totalPages}
                        total={meta.total}
                        disabledPrev={meta.page <= 1 || loading}
                        disabledNext={meta.page >= meta.totalPages || loading}
                        onPrev={() => fetchData(meta.page - 1)}
                        onNext={() => fetchData(meta.page + 1)}
                        onJump={(p) => fetchData(p)}
                    />
                </div>
            </div>

            {confirm.open && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setConfirm({ open: false, kode: '', status: '' })}></div>
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6">
                            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                                <AlertCircle className="text-red-600" size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Konfirmasi Blacklist</h3>
                            <p className="text-slate-600">Apakah Anda yakin ingin memasukkan customer ini ke dalam daftar hitam? Customer akan ditandai di semua laporan.</p>
                        </div>
                        <div className="bg-slate-50 px-6 py-4 flex gap-3 justify-end">
                            <Button variant="ghost" className="font-medium" onClick={() => setConfirm({ open: false, kode: '', status: '' })}>Batal</Button>
                            <Button variant="destructive" className="px-8 font-semibold shadow-lg shadow-red-200" onClick={() => {
                                const k = confirm.kode;
                                setConfirm({ open: false, kode: '', status: '' });
                                toggleBlacklist(k, confirm.status)
                            }}>Ya, Blacklist</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
