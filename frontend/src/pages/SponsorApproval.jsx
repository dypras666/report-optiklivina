import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { fetchSponsorApprovals, updateSponsorApproval } from '@/api/sponsors'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
    CheckCircle,
    XCircle,
    Clock,
    RefreshCcw,
    Search,
    Filter
} from 'lucide-react'
import { fetchCabangList, fetchPembukuanList, fetchMarketingList } from '@/api/options'

export default function SponsorApproval() {
    const [data, setData] = useState([])
    const [stats, setStats] = useState({ total: 0, pending: 0, total_nominal_pending: 0, acc: 0, tolak: 0 })
    const [loading, setLoading] = useState(false)

    // Filters
    const [search, setSearch] = useState('')
    const [cabangId, setCabangId] = useState('')
    const [marketingId, setMarketingId] = useState('')
    const [pembukuanId, setPembukuanId] = useState('')

    // Options
    const [cabangOptions, setCabangOptions] = useState([])
    const [marketingOptions, setMarketingOptions] = useState([])
    const [pembukuanOptions, setPembukuanOptions] = useState([])

    // Pagination & Sorting
    const [page, setPage] = useState(0)
    const pageSize = 20
    const [totalRecords, setTotalRecords] = useState(0)

    // Initial load config
    useEffect(() => {
        Promise.all([
            fetchCabangList(),
            fetchMarketingList(),
            fetchPembukuanList()
        ]).then(([cabangs, marketings, pembukuans]) => {
            setCabangOptions(cabangs)
            setMarketingOptions(marketings)
            setPembukuanOptions(pembukuans)
        }).catch(err => console.error("Failed to load options", err))
    }, [])

    const loadData = async () => {
        setLoading(true)
        try {
            const res = await fetchSponsorApprovals({
                cabangId,
                marketingId,
                pembukuanId,
                page,
                pageSize,
                search
            })
            setData(res.data || [])
            setStats(res.stats || { total: 0, pending: 0, total_nominal_pending: 0, acc: 0, tolak: 0 })
            setTotalRecords(res.total || 0)
        } catch (err) {
            alert(err.response?.data?.error || err.message || 'Failed to fetch data')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [page, cabangId, marketingId, pembukuanId])

    const handleSearch = (e) => {
        e.preventDefault()
        setPage(0)
        loadData()
    }

    const handleAction = async (kode, actionValue) => {
        try {
            setLoading(true)
            await updateSponsorApproval(kode, actionValue)
            alert(actionValue === 2 ? 'Sponsor disetujui' : actionValue === 3 ? 'Sponsor ditolak' : 'Sponsor dikembalikan ke pending')
            loadData()
        } catch (err) {
            alert('Gagal memperbarui status sponsor')
            setLoading(false) // loadData already handles setLoading, but if it falls here we need to stop it
        }
    }

    const getStatusBadge = (status) => {
        if (status === 2) return <Badge className="bg-green-600 text-white">Disetujui</Badge>
        if (status === 3) return <Badge variant="destructive">Ditolak</Badge>
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">Pending</Badge>
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Persetujuan Sponsor</h2>
                    <p className="text-muted-foreground">Daftar Pengajuan Sponsor Baru</p>
                </div>
                <Button onClick={() => loadData()} variant="outline" size="sm">
                    <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Pengajuan</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total}</div>
                    </CardContent>
                </Card>
                <Card className="border-orange-200 bg-orange-50/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-orange-800">Pending</CardTitle>
                        <Clock className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-700">{stats.pending}</div>
                        <p className="text-xs text-orange-600 mt-1">
                            Potensi: {formatCurrency(stats.total_nominal_pending)}
                        </p>
                    </CardContent>
                </Card>
                <Card className="border-green-200 bg-green-50/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-green-800">Disetujui (ACC)</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-700">{stats.acc}</div>
                    </CardContent>
                </Card>
                <Card className="border-red-200 bg-red-50/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-red-800">Ditolak</CardTitle>
                        <XCircle className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-700">{stats.tolak}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="pb-3 border-b">
                    <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
                        <form onSubmit={handleSearch} className="flex flex-1 gap-2 w-full lg:w-auto relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Cari nama atau kode sponsor..."
                                className="pl-9 bg-white max-w-sm"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                            <Button type="submit" variant="secondary">Cari</Button>
                        </form>

                        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                            <select className="flex h-9 w-full lg:w-[150px] items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50" value={pembukuanId} onChange={e => { setPembukuanId(e.target.value); setPage(0) }}>
                                <option value="">Semua Periode</option>
                                {pembukuanOptions.map(o => <option key={o.id} value={o.id}>{o.nama_pembukuan}</option>)}
                            </select>
                            <select className="flex h-9 w-full lg:w-[150px] items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50" value={cabangId} onChange={e => { setCabangId(e.target.value); setPage(0) }}>
                                <option value="">Semua Cabang</option>
                                {cabangOptions.map(o => <option key={o.id_cabang} value={o.id_cabang}>{o.nama_cabang}</option>)}
                            </select>
                            <select className="flex h-9 w-full lg:w-[150px] items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50" value={marketingId} onChange={e => { setMarketingId(e.target.value); setPage(0) }}>
                                <option value="">Semua Marketing</option>
                                {marketingOptions.map(o => <option key={o.id} value={o.id}>{o.nama_lengkap}</option>)}
                            </select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50">
                                    <TableHead className="w-[100px]">Kode Customer</TableHead>
                                    <TableHead>Nama Sponsor</TableHead>
                                    <TableHead>Marketing</TableHead>
                                    <TableHead>Cabang</TableHead>
                                    <TableHead>Total Transaksi</TableHead>
                                    <TableHead>Tanggal Input</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading && data.length === 0 ? (
                                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                                ) : data.length === 0 ? (
                                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Tidak ada data ditemukan</TableCell></TableRow>
                                ) : (
                                    data.map((row) => (
                                        <TableRow key={row.kode_customer} className="hover:bg-slate-50 transition-colors">
                                            <TableCell className="font-mono text-xs">{row.kode_customer}</TableCell>
                                            <TableCell className="font-medium">{row.nama_customer}</TableCell>
                                            <TableCell>{row.nama_marketing || '-'}</TableCell>
                                            <TableCell>{row.nama_cabang || '-'}</TableCell>
                                            <TableCell className="font-semibold">{formatCurrency(row.total_nominal || 0)}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {row.tanggal_input_log ? formatDate(row.tanggal_input_log) : '-'}
                                            </TableCell>
                                            <TableCell>
                                                {getStatusBadge(row.sponsor_approval)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    {row.sponsor_approval !== 2 && (
                                                        <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => handleAction(row.kode_customer, 2)}>
                                                            ACC
                                                        </Button>
                                                    )}
                                                    {row.sponsor_approval !== 3 && (
                                                        <Button size="sm" variant="destructive" onClick={() => handleAction(row.kode_customer, 3)}>
                                                            Tolak
                                                        </Button>
                                                    )}
                                                    {(row.sponsor_approval === 2 || row.sponsor_approval === 3) && (
                                                        <Button size="sm" variant="outline" onClick={() => handleAction(row.kode_customer, 1)}>
                                                            Pending
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between px-4 py-4 border-t">
                        <div className="text-sm text-muted-foreground">
                            Menampilkan {data.length > 0 ? (page * pageSize) + 1 : 0} - {Math.min((page + 1) * pageSize, totalRecords)} dari {totalRecords} data
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                disabled={page === 0 || loading}
                            >
                                Sebelumnya
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => p + 1)}
                                disabled={(page + 1) * pageSize >= totalRecords || loading}
                            >
                                Selanjutnya
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
