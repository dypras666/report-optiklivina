import React from 'react'
import Pagination from '@/components/ui/Pagination.jsx'
import { TableBodySkeleton } from '@/components/ui/TableSkeleton.jsx'
import { tableClass, theadClass, containerClass } from '@/components/ui/tableStyles.js'
import { Button } from '@/components/ui/button'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://reportsapi.optiklivina.com'

export default function VoucherPayments() {
    const [rows, setRows] = React.useState([])
    const [loading, setLoading] = React.useState(false)
    const [meta, setMeta] = React.useState({ page: 1, limit: 50, total: 0, totalPages: 0 })
    const [q, setQ] = React.useState('')
    const [cabang, setCabang] = React.useState('')
    const [cabangOpts, setCabangOpts] = React.useState([])
    const [openRows, setOpenRows] = React.useState({})
    const [itemsMap, setItemsMap] = React.useState({})

    React.useEffect(() => {
        fetch(`${API_BASE}/api/options/cabang`)
            .then(r => r.json())
            .then(j => setCabangOpts(j.data || []))
            .catch(() => { })
    }, [])

    React.useEffect(() => { fetchData() }, [meta.page, meta.limit, q, cabang])

    async function fetchData() {
        setLoading(true)
        const p = new URLSearchParams()
        if (q) p.set('q', q)
        if (cabang) p.set('cabang', cabang)
        p.set('page', meta.page)
        p.set('limit', meta.limit)

        try {
            const token = localStorage.getItem('authToken')
            const headers = new Headers()
            if (token) headers.set('Authorization', `Bearer ${token}`)

            const res = await fetch(`${API_BASE}/api/reports/marketing-voucher?${p.toString()}`, { headers })
            const json = await res.json()
            setRows(json.data || [])
            setMeta(json.meta || { page: 1, limit: 50, total: 0, totalPages: 0 })
        } catch (e) {
            console.error(e)
        } finally { setLoading(false) }
    }

    return (
        <div className="p-6">
            <h1 className="text-2xl font-semibold mb-2">Pembayaran Voucher</h1>
            <p className="text-gray-500 mb-4 text-sm">Daftar transaksi yang menggunakan pembayaran voucher.</p>

            <div className="flex gap-2 mb-3">
                <input
                    className="border rounded px-2 py-1 w-64"
                    placeholder="Cari customer / transaksi"
                    value={q}
                    onChange={e => { setQ(e.target.value); setMeta(m => ({ ...m, page: 1 })) }}
                />
                <select className="border rounded px-2 py-1" value={cabang} onChange={e => { setCabang(e.target.value); setMeta(m => ({ ...m, page: 1 })) }}>
                    <option value="">Semua Cabang</option>
                    {cabangOpts.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <select
                    className="border rounded px-2 py-1"
                    value={meta.limit}
                    onChange={e => setMeta(m => ({ ...m, page: 1, limit: parseInt(e.target.value, 10) }))}
                >
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                </select>
            </div>

            <div className={containerClass}>
                <table className={tableClass}>
                    <thead className={theadClass}>
                        <tr>
                            <th className="p-2 text-left w-16">No</th>
                            <th className="p-2 text-left">Aksi</th>
                            <th className="p-2 text-left">Tanggal</th>
                            <th className="p-2 text-left">Customer</th>
                            <th className="p-2 text-left">Transaksi</th>
                            <th className="p-2 text-left">Cabang</th>
                            <th className="p-2 text-left">Marketing</th>
                            <th className="p-2 text-right">Voucher Digunakan</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <TableBodySkeleton rows={10} cols={8} />
                        ) : (
                            <>
                                {rows.map((r, idx) => (
                                    <React.Fragment key={idx}>
                                        <tr className="border-t hover:bg-gray-50">
                                            <td className="p-2 text-gray-500">{(meta.page - 1) * meta.limit + idx + 1}</td>
                                            <td className="p-2">
                                                <RowDetail kode={r.kode_transaksi} openRows={openRows} setOpenRows={setOpenRows} itemsMap={itemsMap} setItemsMap={setItemsMap} />
                                            </td>
                                            <td className="p-2">{formatDate(r.tanggal_use)}</td>
                                            <td className="p-2 font-medium">{r.nama_customer || '-'} <span className="text-xs text-gray-400">({r.kode_customer})</span></td>
                                            <td className="p-2 font-mono text-sm">{r.kode_transaksi}</td>
                                            <td className="p-2">{r.nama_cabang}</td>
                                            <td className="p-2">{r.nama_marketing}</td>
                                            <td className="p-2 text-right font-bold text-green-600">{fmtCurrency(r.voucher_use)}</td>
                                        </tr>
                                        <DetailRow kode={r.kode_transaksi} openRows={openRows} itemsMap={itemsMap} />
                                    </React.Fragment>
                                ))}
                                {rows.length === 0 && (
                                    <tr><td className="p-3 text-center text-gray-500" colSpan={8}>Tidak ada data</td></tr>
                                )}
                            </>
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

function RowDetail({ kode, openRows, setOpenRows, itemsMap, setItemsMap }) {
    const open = !!openRows[kode]
    const toggle = async () => {
        if (!open && !itemsMap[kode]) {
            const res = await fetch(`${API_BASE}/api/reports/marketing/${kode}/items`)
            const json = await res.json()
            setItemsMap(m => ({ ...m, [kode]: json.data || [] }))
        }
        setOpenRows(m => ({ ...m, [kode]: !open }))
    }
    return <Button variant="outline" size="sm" onClick={toggle}>{open ? 'Tutup' : 'Detail/Item'}</Button>
}

function DetailRow({ kode, openRows, itemsMap }) {
    const open = !!openRows[kode]
    const items = itemsMap[kode] || []
    const loading = open && !itemsMap[kode]
    if (!open) return null
    return (
        <tr className="bg-slate-50">
            <td className="p-2" colSpan={8}>
                <div className="pl-8 border-l-4 border-slate-300">
                    <h4 className="font-semibold text-xs mb-2">Detail Item Transaksi: {kode}</h4>
                    <table className="min-w-full text-xs">
                        <thead className="bg-slate-100 uppercase text-[9px] font-bold text-slate-500 tracking-wider">
                            <tr>
                                <th className="p-2 text-left w-8">No</th>
                                <th className="p-2 text-left">Produk</th>
                                <th className="p-2 text-left">Jenis</th>
                                <th className="p-2 text-right">Qty</th>
                                <th className="p-2 text-right">Harga</th>
                                <th className="p-2 text-right">Total</th>
                                <th className="p-2 text-left">Tanggal</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={7} className="p-4 text-center">Memuat item...</td></tr>
                            ) : items.map((it, idx) => (
                                <tr key={`${kode}-${idx}`} className="border-t hover:bg-white transition-colors">
                                    <td className="p-2 text-slate-400 font-mono text-[9px]">{idx + 1}</td>
                                    <td className="p-2 font-medium">{it.nama_produk || `${it.jenis_produk} #${it.id_produk}`}</td>
                                    <td className="p-2 opacity-70">{it.jenis_produk}</td>
                                    <td className="p-2 text-right tabular-nums">{it.jumlah}</td>
                                    <td className="p-2 text-right tabular-nums">{fmtCurrency(it.harga_produk)}</td>
                                    <td className="p-2 text-right tabular-nums font-semibold">{fmtCurrency((Number(it.harga_produk || 0)) * (Number(it.jumlah || 0)))}</td>
                                    <td className="p-2 text-[10px] text-slate-500">{formatDate(it.tanggal_log)}</td>
                                </tr>
                            ))}
                            {!loading && items.length === 0 && (
                                <tr><td className="p-2 text-center text-slate-400 font-medium" colSpan={7}>Tidak ada item</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </td>
        </tr>
    )
}

function fmtCurrency(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID') }
function formatDate(s) {
    if (!s) return ''
    try { return new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return String(s) }
}
