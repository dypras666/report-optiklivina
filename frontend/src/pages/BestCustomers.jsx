import React from 'react'
import Pagination from '@/components/ui/Pagination.jsx'
import { TableBodySkeleton } from '@/components/ui/TableSkeleton.jsx'
import { tableClass, theadClass, containerClass } from '@/components/ui/tableStyles.js'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://reportsapi.optiklivina.com'

export default function BestCustomers() {
    const [rows, setRows] = React.useState([])
    const [loading, setLoading] = React.useState(false)
    const [meta, setMeta] = React.useState({ page: 1, limit: 50, total: 0, totalPages: 0 })
    const [q, setQ] = React.useState('')

    React.useEffect(() => { fetchData() }, [meta.page, meta.limit, q])

    async function fetchData() {
        setLoading(true)
        const p = new URLSearchParams()
        if (q) p.set('q', q)
        p.set('page', meta.page)
        p.set('limit', meta.limit)

        try {
            const token = localStorage.getItem('authToken')
            const headers = new Headers()
            if (token) headers.set('Authorization', `Bearer ${token}`)

            const res = await fetch(`${API_BASE}/api/reports/best-customers?${p.toString()}`, { headers })
            const json = await res.json()
            setRows(json.data || [])
            setMeta(json.meta || { page: 1, limit: 50, total: 0, totalPages: 0 })
        } catch (e) {
            console.error(e)
        } finally { setLoading(false) }
    }

    return (
        <div className="p-6">
            <h1 className="text-2xl font-semibold mb-2">Poin Customer</h1>
            <p className="text-gray-500 mb-4 text-sm">Poin dihitung dari transaksi "Kacamata" berdasarkan pengaturan rule.</p>

            <div className="flex gap-2 mb-3">
                <input
                    className="border rounded px-2 py-1 w-64"
                    placeholder="Cari customer / no HP / kode"
                    value={q}
                    onChange={e => { setQ(e.target.value); setMeta(m => ({ ...m, page: 1 })) }}
                />
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
                            <th className="p-2 text-left w-16">Peringkat</th>
                            <th className="p-2 text-left">Kode Customer</th>
                            <th className="p-2 text-left">Kode QR</th>
                            <th className="p-2 text-left">Nama Customer</th>
                            <th className="p-2 text-left">No HP</th>
                            <th className="p-2 text-right">Total Transaksi</th>
                            <th className="p-2 text-right">Poin Didapat</th>
                            <th className="p-2 text-right">Poin Terpakai</th>
                            <th className="p-2 text-right">Poin Sisa</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <TableBodySkeleton rows={10} cols={9} />
                        ) : (
                            <>
                                {rows.map((r, idx) => (
                                    <tr key={idx} className="border-t hover:bg-gray-50">
                                        <td className="p-2 text-gray-500">{(meta.page - 1) * meta.limit + idx + 1}</td>
                                        <td className="p-2 font-mono text-sm">{r.kode_customer || '-'}</td>
                                        <td className="p-2 font-mono text-sm">{r.kode_qr || '-'}</td>
                                        <td className="p-2 font-medium">{r.nama_customer || '-'}</td>
                                        <td className="p-2 text-gray-600">{r.no_hp || '-'}</td>
                                        <td className="p-2 text-right">{r.total_trx}</td>
                                        <td className="p-2 text-right text-gray-600">{Number(r.total_spent || 0).toLocaleString('id-ID')}</td>
                                        <td className="p-2 text-right text-red-500">{Number(r.total_used || 0).toLocaleString('id-ID')}</td>
                                        <td className="p-2 text-right font-bold text-green-600">{Number(r.current_points || 0).toLocaleString('id-ID')}</td>
                                    </tr>
                                ))}
                                {rows.length === 0 && (
                                    <tr><td className="p-3 text-center text-gray-500" colSpan={9}>Tidak ada data</td></tr>
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

function fmtCurrency(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID') }
