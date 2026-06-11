import React from 'react'
import Pagination from '@/components/ui/Pagination.jsx'
import { TableBodySkeleton } from '@/components/ui/TableSkeleton.jsx'
import { tableClass, theadClass, containerClass } from '@/components/ui/tableStyles.js'
import { Button } from '@/components/ui/button'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://reportsapi.optiklivina.com'

export default function Sponsors() {
    const [rows, setRows] = React.useState([])
    const [loading, setLoading] = React.useState(false)
    const [meta, setMeta] = React.useState({ page: 1, limit: 50, total: 0, totalPages: 0 })
    const [q, setQ] = React.useState('')
    const [cabang, setCabang] = React.useState('')
    const [marketing, setMarketing] = React.useState('')
    const [cabangOpts, setCabangOpts] = React.useState([])
    const [marketingOpts, setMarketingOpts] = React.useState([])
    const [groupBy, setGroupBy] = React.useState('customer') // 'customer' or 'marketing'
    const [openRows, setOpenRows] = React.useState({})
    const [marketingDetails, setMarketingDetails] = React.useState({})

    React.useEffect(() => {
        fetch(`${API_BASE}/api/options/cabang`)
            .then(r => r.json())
            .then(j => setCabangOpts(j.data || []))
            .catch(() => { })

        fetch(`${API_BASE}/api/options/marketing`)
            .then(r => r.json())
            .then(j => setMarketingOpts(j.data || []))
            .catch(() => { })
    }, [])

    React.useEffect(() => { fetchData() }, [meta.page, meta.limit, q, cabang, marketing, groupBy])

    async function fetchData() {
        setLoading(true)
        const p = new URLSearchParams()
        if (q) p.set('q', q)
        if (cabang) p.set('cabang', cabang)
        if (marketing && groupBy === 'customer') p.set('marketing', marketing)
        p.set('page', meta.page)
        p.set('limit', meta.limit)

        try {
            const token = localStorage.getItem('authToken')
            const headers = new Headers()
            if (token) headers.set('Authorization', `Bearer ${token}`)

            const url = groupBy === 'marketing'
                ? `${API_BASE}/api/reports/sponsors/marketing?${p.toString()}`
                : `${API_BASE}/api/reports/sponsors?${p.toString()}`

            const res = await fetch(url, { headers })
            const json = await res.json()
            setRows(json.data || [])
            setMeta(json.meta || { page: 1, limit: 50, total: 0, totalPages: 0 })
        } catch (e) {
            console.error(e)
        } finally { setLoading(false) }
    }

    return (
        <div className="p-6">
            <h1 className="text-2xl font-semibold mb-2">Data Sponsor</h1>
            <p className="text-gray-500 mb-4 text-sm">Daftar customer yang menjadi sponsor dan saldo voucher mereka.</p>

            <div className="flex gap-2 mb-3 items-center flex-wrap">
                <input
                    className="border rounded px-2 py-1 w-64"
                    placeholder={groupBy === 'marketing' ? "Cari nama marketing" : "Cari customer / no HP"}
                    value={q}
                    onChange={e => { setQ(e.target.value); setMeta(m => ({ ...m, page: 1 })) }}
                />
                <select className="border rounded px-2 py-1" value={cabang} onChange={e => { setCabang(e.target.value); setMeta(m => ({ ...m, page: 1 })) }}>
                    <option value="">Semua Cabang</option>
                    {cabangOpts.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                {groupBy === 'customer' && (
                    <select className="border rounded px-2 py-1" value={marketing} onChange={e => { setMarketing(e.target.value); setMeta(m => ({ ...m, page: 1 })) }}>
                        <option value="">Semua Marketing</option>
                        {marketingOpts.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                )}
                <select
                    className="border rounded px-2 py-1"
                    value={meta.limit}
                    onChange={e => setMeta(m => ({ ...m, page: 1, limit: parseInt(e.target.value, 10) }))}
                >
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                </select>

                <div className="flex border rounded ml-auto">
                    <button
                        className={`px-3 py-1 ${groupBy === 'customer' ? 'bg-slate-800 text-white' : 'hover:bg-gray-100'}`}
                        onClick={() => { setGroupBy('customer'); setMeta(m => ({ ...m, page: 1 })) }}
                    >
                        By Customer
                    </button>
                    <button
                        className={`px-3 py-1 ${groupBy === 'marketing' ? 'bg-slate-800 text-white' : 'hover:bg-gray-100'}`}
                        onClick={() => { setGroupBy('marketing'); setMeta(m => ({ ...m, page: 1 })) }}
                    >
                        By Marketing
                    </button>
                </div>
            </div>

            <div className={containerClass}>
                <table className={tableClass}>
                    <thead className={theadClass}>
                        {groupBy === 'customer' ? (
                            <tr>
                                <th className="p-2 text-left w-16">No</th>
                                <th className="p-2 text-left">Kode Customer</th>
                                <th className="p-2 text-left">Nama Customer</th>
                                <th className="p-2 text-left">No HP</th>
                                <th className="p-2 text-left">Cabang</th>
                                <th className="p-2 text-left">Marketing</th>
                                <th className="p-2 text-right">Total Earned</th>
                                <th className="p-2 text-right">Total Used</th>
                                <th className="p-2 text-right">Voucher Bayar</th>
                                <th className="p-2 text-right">Balance</th>
                            </tr>
                        ) : (
                            <tr>
                                <th className="p-2 text-left w-16">No</th>
                                <th className="p-2 text-left w-24">Aksi</th>
                                <th className="p-2 text-left">Marketing</th>
                                <th className="p-2 text-left">Cabang</th>
                                <th className="p-2 text-right">Jml Sponsor</th>
                                <th className="p-2 text-right">Total Earned</th>
                                <th className="p-2 text-right">Total Used</th>
                                <th className="p-2 text-right">Voucher Bayar</th>
                                <th className="p-2 text-right">Total Balance</th>
                            </tr>
                        )}
                    </thead>
                    <tbody>
                        {loading ? (
                            <TableBodySkeleton rows={10} cols={groupBy === 'customer' ? 10 : 9} />
                        ) : (
                            <>
                                {rows.map((r, idx) => (
                                    <React.Fragment key={idx}>
                                        <tr className="border-t hover:bg-gray-50">
                                            <td className="p-2 text-gray-500">{(meta.page - 1) * meta.limit + idx + 1}</td>
                                            {groupBy === 'customer' ? (
                                                <>
                                                    <td className="p-2 font-mono text-sm">
                                                        <div className="flex items-center gap-2">
                                                            <Button
                                                                variant="ghost"
                                                                size="xs"
                                                                className="h-6 px-2 text-[10px]"
                                                                onClick={() => {
                                                                    const kode = r.kode_customer
                                                                    const isOpen = !!openRows[kode]
                                                                    if (!isOpen && !marketingDetails[kode]) {
                                                                        fetch(`${API_BASE}/api/reports/sponsors/children/${kode}`)
                                                                            .then(res => res.json())
                                                                            .then(json => setMarketingDetails(m => ({ ...m, [kode]: json.data || [] })))
                                                                            .catch(() => { })
                                                                    }
                                                                    setOpenRows(m => ({ ...m, [kode]: !isOpen }))
                                                                }}
                                                            >
                                                                {openRows[r.kode_customer] ? 'Tutup' : 'Detail'}
                                                            </Button>
                                                            {r.kode_customer}
                                                        </div>
                                                    </td>
                                                    <td className="p-2 font-medium">{r.nama_customer || '-'}</td>
                                                    <td className="p-2 text-gray-600">{r.no_hp || '-'}</td>
                                                    <td className="p-2">{r.nama_cabang}</td>
                                                    <td className="p-2">{r.nama_marketing}</td>
                                                    <td className="p-2 text-right text-gray-600">{fmtCurrency(r.total_earned)}</td>
                                                    <td className="p-2 text-right text-red-500">{fmtCurrency(r.total_used)}</td>
                                                    <td className="p-2 text-right text-purple-600 font-medium">{fmtCurrency(r.voucher_for_payment || 0)}</td>
                                                    <td className="p-2 text-right font-bold text-green-600">{fmtCurrency(r.balance)}</td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="p-2">
                                                        <MarketingDetailBtn
                                                            marketingId={r.id_marketing}
                                                            openRows={openRows}
                                                            setOpenRows={setOpenRows}
                                                            marketingDetails={marketingDetails}
                                                            setMarketingDetails={setMarketingDetails}
                                                        />
                                                    </td>
                                                    <td className="p-2 font-medium">{r.nama_marketing}</td>
                                                    <td className="p-2">{r.nama_cabang}</td>
                                                    <td className="p-2 text-right">{r.total_sponsors}</td>
                                                    <td className="p-2 text-right text-gray-600">{fmtCurrency(r.total_earned)}</td>
                                                    <td className="p-2 text-right text-red-500">{fmtCurrency(r.total_used)}</td>
                                                    <td className="p-2 text-right text-purple-600 font-medium">{fmtCurrency(r.total_voucher_for_payment || 0)}</td>
                                                    <td className="p-2 text-right font-bold text-green-600">{fmtCurrency(r.total_balance)}</td>
                                                </>
                                            )}
                                        </tr>
                                        {groupBy === 'customer' && openRows[r.kode_customer] && (
                                            <SponsorChildRow children={marketingDetails[r.kode_customer] || []} totalCols={10} />
                                        )}
                                        {groupBy === 'marketing' && (
                                            <MarketingDetailRow marketingId={r.id_marketing} openRows={openRows} marketingDetails={marketingDetails} />
                                        )}
                                    </React.Fragment>
                                ))}
                                {rows.length === 0 && (
                                    <tr><td className="p-3 text-center text-gray-500" colSpan={10}>Tidak ada data</td></tr>
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

function MarketingDetailBtn({ marketingId, openRows, setOpenRows, marketingDetails, setMarketingDetails }) {
    const open = !!openRows[marketingId]
    const toggle = async () => {
        if (!open && !marketingDetails[marketingId]) {
            try {
                const res = await fetch(`${API_BASE}/api/reports/sponsors?marketing=${marketingId}&limit=100`)
                const json = await res.json()
                setMarketingDetails(m => ({ ...m, [marketingId]: json.data || [] }))
            } catch { }
        }
        setOpenRows(m => ({ ...m, [marketingId]: !open }))
    }
    return <Button variant="outline" size="sm" onClick={toggle}>{open ? 'Tutup' : 'List'}</Button>
}

function MarketingDetailRow({ marketingId, openRows, marketingDetails }) {
    const [openSponsors, setOpenSponsors] = React.useState({})
    const [sponsorDetails, setSponsorDetails] = React.useState({})

    if (!openRows[marketingId]) return null
    const items = marketingDetails[marketingId] || []

    const toggleSponsor = async (kode) => {
        const isOpen = !!openSponsors[kode]
        if (!isOpen && !sponsorDetails[kode]) {
            try {
                const res = await fetch(`${API_BASE}/api/reports/sponsors/children/${kode}`)
                const json = await res.json()
                setSponsorDetails(m => ({ ...m, [kode]: json.data || [] }))
            } catch { }
        }
        setOpenSponsors(m => ({ ...m, [kode]: !isOpen }))
    }

    return (
        <tr className="bg-slate-50">
            <td colSpan={10} className="p-4">
                <div className="pl-4 border-l-4 border-slate-300">
                    <h4 className="text-sm font-semibold mb-2 text-slate-700">Daftar Sponsor</h4>
                    <table className="w-full text-xs">
                        <thead className="bg-slate-100 uppercase text-[9px] font-bold text-slate-500 tracking-wider">
                            <tr className="border-b">
                                <th className="p-2 text-left w-8">No</th>
                                <th className="p-2 text-left w-20">Aksi</th>
                                <th className="p-2 text-left">Kode</th>
                                <th className="p-2 text-left">Nama</th>
                                <th className="p-2 text-left">No HP</th>
                                <th className="p-2 text-right">Earned</th>
                                <th className="p-2 text-right">Used</th>
                                <th className="p-2 text-right">Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((it, idx) => (
                                <React.Fragment key={idx}>
                                    <tr className="border-b hover:bg-white transition-colors">
                                        <td className="p-2 text-slate-400 font-mono text-[9px]">{idx + 1}</td>
                                        <td className="p-2">
                                            <Button
                                                variant="ghost"
                                                size="xs"
                                                className="h-6 px-2 text-[10px]"
                                                onClick={() => toggleSponsor(it.kode_customer)}
                                            >
                                                {openSponsors[it.kode_customer] ? 'Tutup' : 'Detail'}
                                            </Button>
                                        </td>
                                        <td className="p-2 font-mono">{it.kode_customer}</td>
                                        <td className="p-2 font-medium">{it.nama_customer}</td>
                                        <td className="p-2 text-slate-500">{it.no_hp}</td>
                                        <td className="p-2 text-right tabular-nums">{fmtCurrency(it.total_earned)}</td>
                                        <td className="p-2 text-right tabular-nums text-red-500">{fmtCurrency(it.total_used)}</td>
                                        <td className="p-2 text-right tabular-nums font-bold text-green-700">{fmtCurrency(it.balance)}</td>
                                    </tr>
                                    {openSponsors[it.kode_customer] && (
                                        <SponsorChildRow children={sponsorDetails[it.kode_customer] || []} totalCols={8} />
                                    )}
                                </React.Fragment>
                            ))}
                            {items.length === 0 && <tr><td colSpan={8} className="p-3 text-center text-gray-500">Tidak ada sponsor</td></tr>}
                        </tbody>
                    </table>
                </div>
            </td>
        </tr>
    )
}

function SponsorChildRow({ children, totalCols = 8 }) {
    const [openSponsors, setOpenSponsors] = React.useState({})
    const [sponsorDetails, setSponsorDetails] = React.useState({})

    const toggleSponsor = async (kode) => {
        const isOpen = !!openSponsors[kode]
        if (!isOpen && !sponsorDetails[kode]) {
            try {
                const token = localStorage.getItem('authToken')
                const headers = new Headers()
                if (token) headers.set('Authorization', `Bearer ${token}`)
                const res = await fetch(`${API_BASE}/api/reports/sponsors/children/${kode}`, { headers })
                const json = await res.json()
                setSponsorDetails(m => ({ ...m, [kode]: json.data || [] }))
            } catch { }
        }
        setOpenSponsors(m => ({ ...m, [kode]: !isOpen }))
    }

    return (
        <tr className="bg-white">
            <td colSpan={totalCols} className="p-3">
                <div className="ml-10 pl-4 border-l-2 border-dashed border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Customer yang disponsori:</p>
                    <table className="w-full text-xs">
                        <thead className="bg-gray-50 text-gray-500 text-[10px]">
                            <tr className="border-b">
                                <th className="p-1 px-2 text-left w-12">Aksi</th>
                                <th className="p-1 px-2 text-left">Kode</th>
                                <th className="p-1 px-2 text-left">Nama Customer</th>
                                <th className="p-1 px-2 text-left">No HP</th>
                                <th className="p-1 px-2 text-left">Kode Transaksi</th>
                                <th className="p-1 px-2 text-left">Tanggal</th>
                                <th className="p-1 px-2 text-right">Earned</th>
                            </tr>
                        </thead>
                        <tbody>
                            {children.map((c, i) => (
                                <React.Fragment key={i}>
                                    <tr className="border-b last:border-0 hover:bg-slate-50">
                                        <td className="p-1 px-2">
                                            <Button
                                                variant="ghost"
                                                size="xs"
                                                className="h-6 px-2 text-[10px]"
                                                onClick={() => toggleSponsor(c.kode_customer)}
                                            >
                                                {openSponsors[c.kode_customer] ? 'Tutup' : 'Detail'}
                                            </Button>
                                        </td>
                                        <td className="p-1 px-2 font-mono text-[10px]">{c.kode_customer}</td>
                                        <td className="p-1 px-2 font-medium">{c.nama_customer}</td>
                                        <td className="p-1 px-2 text-gray-500">{c.no_hp}</td>
                                        <td className="p-1 px-2 font-mono text-[10px]">{c.kode_transaksi}</td>
                                        <td className="p-1 px-2">{formatDate(c.tanggal_transaksi)}</td>
                                        <td className="p-1 px-2 text-right text-blue-600 font-medium">{fmtCurrency(c.voucher_get)}</td>
                                    </tr>
                                    {openSponsors[c.kode_customer] && (
                                        <SponsorChildRow children={sponsorDetails[c.kode_customer] || []} totalCols={7} />
                                    )}
                                </React.Fragment>
                            ))}
                            {children.length === 0 && (
                                <tr><td colSpan={7} className="p-2 text-center text-gray-400 italic text-[10px]">Data tidak ditemukan</td></tr>
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
