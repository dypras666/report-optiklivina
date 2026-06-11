import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Search } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://reportsapi.optiklivina.com'
const LEGACY_BASE = 'http://devps.test:8081'

export default function TransactionSearch() {
    const [q, setQ] = React.useState('')
    const [loading, setLoading] = React.useState(false)
    const [data, setData] = React.useState(null)
    const [error, setError] = React.useState('')

    const handleSearch = async (e) => {
        e.preventDefault()
        if (!q.trim()) return
        setLoading(true)
        setError('')
        setData(null)

        try {
            const res = await fetch(`${API_BASE}/api/reports/transaction/full/${encodeURIComponent(q.trim())}`)
            if (res.ok) {
                const json = await res.json()
                setData(json.data)
            } else if (res.status === 404) {
                setError('Transaksi tidak ditemukan dengan kode tersebut.')
            } else {
                throw new Error('Terjadi kesalahan saat mengambil data')
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const totalPaid = data?.payments.filter(p => p.status_bayar === 'ok' || !p.status_bayar).reduce((a, b) => a + Number(b.jumlah_bayar || 0), 0) || 0
    const voucherUsed = data?.vouchers?.filter(v => v.status_bayar === 'ok' || !v.status_bayar).reduce((sum, v) => sum + Number(v.voucher_use || 0), 0) || 0
    const finalPrice = data?.header ? (Number(data.header.harga_nego) > 0 ? Number(data.header.harga_nego) : Number(data.header.total_harga)) : 0
    const sisaTagihan = finalPrice - totalPaid - voucherUsed

    return (
        <div className="p-6 max-w-full">
            <h1 className="text-2xl font-bold mb-6">Cari Transaksi</h1>

            <form onSubmit={handleSearch} className="flex gap-2 mb-8">
                <Input
                    className="max-w-md"
                    placeholder="Masukkan Kode Transaksi (contoh: 290521...)"
                    value={q}
                    onChange={e => setQ(e.target.value)}
                />
                <Button type="submit" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                    Cari
                </Button>
            </form>

            {error && <div className="p-4 bg-red-50 text-red-600 rounded mb-4">{error}</div>}

            {data && (
                <div className="space-y-6">
                    {/* Header Info */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card>
                            <CardHeader><CardTitle className="text-lg">Informasi Transaksi</CardTitle></CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-gray-500">Kode Transaksi:</span> <span className="font-mono font-medium">{data.header.kode_transaksi}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">Tanggal Order:</span> <span className="font-medium">{formatDate(data.header.tanggal_order)}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">Marketing:</span> <span className="font-medium">{data.header.nama_marketing || '-'}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">Cabang:</span> <span className="font-medium">{data.header.nama_cabang || '-'}</span></div>
                                <div className="flex justify-between border-t pt-2 mt-2 font-bold"><span className="text-gray-700">Total Harga:</span> <span className="text-green-700">{fmtCurrency(data.header.total_harga)}</span></div>
                                {data.header.harga_nego > 0 && <div className="flex justify-between font-bold"><span className="text-gray-700">Harga Nego:</span> <span className="text-blue-700">{fmtCurrency(data.header.harga_nego)}</span></div>}
                                <div className="flex justify-between font-bold"><span className="text-gray-700">Total Terbayar:</span> <span className="text-green-600">{fmtCurrency(totalPaid)}</span></div>
                                {voucherUsed > 0 && <div className="flex justify-between font-bold"><span className="text-gray-700">Voucher Digunakan:</span> <span className="text-purple-600">{fmtCurrency(voucherUsed)}</span></div>}
                                <div className={`flex justify-between font-bold text-lg border-t pt-2 ${sisaTagihan > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    <span>Sisa Tagihan:</span> <span>{fmtCurrency(sisaTagihan)}</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle className="text-lg">Informasi Customer</CardTitle></CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-gray-500">Nama:</span> <span className="font-medium">{data.header.nama_customer}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">Kode Customer:</span> <span className="font-mono">{data.header.kode_customer}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">No HP:</span> <span className="font-medium">{data.header.no_hp || '-'}</span></div>
                                <div className="mt-2"><span className="text-gray-500 block mb-1">Alamat:</span> <span className="block p-2 bg-slate-50 rounded text-gray-700">{data.header.alamat_lengkap || '-'}</span></div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle className="text-lg">Dokumen Customer</CardTitle></CardHeader>
                            <CardContent className="space-y-3">
                                {data.header.file_ktp ? (
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Foto KTP:</p>
                                        <a href={`${LEGACY_BASE}/uploads/ktp/${data.header.file_ktp}`} target="_blank" rel="noopener noreferrer">
                                            <img
                                                src={`${LEGACY_BASE}/uploads/ktp/${data.header.file_ktp}`}
                                                alt="KTP"
                                                className="w-full h-32 object-cover rounded border hover:opacity-80 cursor-pointer"
                                                onError={(e) => { e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3ENo Image%3C/text%3E%3C/svg%3E' }}
                                            />
                                        </a>
                                    </div>
                                ) : (
                                    <div className="text-center p-4 bg-gray-50 rounded text-gray-400 text-sm">Foto KTP tidak tersedia</div>
                                )}

                                {data.header.file_kk ? (
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Foto KK:</p>
                                        <a href={`${LEGACY_BASE}/uploads/kk/${data.header.file_kk}`} target="_blank" rel="noopener noreferrer">
                                            <img
                                                src={`${LEGACY_BASE}/uploads/kk/${data.header.file_kk}`}
                                                alt="KK"
                                                className="w-full h-32 object-cover rounded border hover:opacity-80 cursor-pointer"
                                                onError={(e) => { e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3ENo Image%3C/text%3E%3C/svg%3E' }}
                                            />
                                        </a>
                                    </div>
                                ) : (
                                    <div className="text-center p-4 bg-gray-50 rounded text-gray-400 text-sm">Foto KK tidak tersedia</div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Items */}
                    <Card>
                        <CardHeader><CardTitle className="text-lg">Detail Item (Produk)</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader className="bg-slate-100 uppercase text-[10px] font-bold text-slate-600 tracking-wider">
                                    <TableRow>
                                        <TableHead className="w-12">No</TableHead>
                                        <TableHead>Produk</TableHead>
                                        <TableHead>Jenis</TableHead>
                                        <TableHead className="text-right">Qty</TableHead>
                                        <TableHead className="text-right">Harga Satuan</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.items.map((item, idx) => (
                                        <TableRow key={idx} className="hover:bg-slate-50 transition-colors">
                                            <TableCell className="text-slate-400 font-mono text-[10px]">{idx + 1}</TableCell>
                                            <TableCell className="font-medium">{item.nama_produk_resolved || `#${item.id_produk}`}</TableCell>
                                            <TableCell className="capitalize text-gray-400 text-xs italic">{item.jenis_produk}</TableCell>
                                            <TableCell className="text-right tabular-nums">{item.jumlah}</TableCell>
                                            <TableCell className="text-right tabular-nums text-slate-500">{fmtCurrency(item.harga_produk)}</TableCell>
                                            <TableCell className="text-right font-bold tabular-nums">{fmtCurrency(item.jumlah_harga)}</TableCell>
                                        </TableRow>
                                    ))}
                                    {data.items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-gray-500">Tidak ada item</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* Payments */}
                    <Card>
                        <CardHeader><CardTitle className="text-lg">Riwayat Pembayaran</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader className="bg-slate-100 uppercase text-[10px] font-bold text-slate-600 tracking-wider">
                                    <TableRow>
                                        <TableHead className="w-12">No</TableHead>
                                        <TableHead>Tanggal Bayar</TableHead>
                                        <TableHead>Jenis Pembayaran</TableHead>
                                        <TableHead className="text-right">Jumlah Bayar</TableHead>
                                        <TableHead className="text-right">Admin Fee</TableHead>
                                        <TableHead className="text-center">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.payments.map((pay, idx) => (
                                        <TableRow key={idx} className="hover:bg-slate-50 transition-colors">
                                            <TableCell className="text-slate-400 font-mono text-[10px]">{idx + 1}</TableCell>
                                            <TableCell className="text-xs text-slate-500">{formatDate(pay.tanggal_bayar)}</TableCell>
                                            <TableCell className="capitalize font-medium">{pay.jenis_transaksi}</TableCell>
                                            <TableCell className="text-right font-bold text-green-600 tabular-nums">{fmtCurrency(pay.jumlah_bayar)}</TableCell>
                                            <TableCell className="text-right text-red-500 tabular-nums">{pay.biaya_admin > 0 ? fmtCurrency(pay.biaya_admin) : '-'}</TableCell>
                                            <TableCell className="text-center">
                                                {pay.status_bayar === 'pending' ? (
                                                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wider">Pending</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold uppercase tracking-wider">OK</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {data.payments.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-gray-500">Belum ada pembayaran</TableCell></TableRow>}
                                    <TableRow className="bg-slate-50 font-bold border-t-2">
                                        <TableCell colSpan={3} className="text-right">Total Terbayar</TableCell>
                                        <TableCell className="text-right text-green-700 tabular-nums underline decoration-double">{fmtCurrency(totalPaid)}</TableCell>
                                        <TableCell colSpan={2}></TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* Voucher Usage */}
                    {data.vouchers && data.vouchers.length > 0 && (
                        <Card>
                            <CardHeader><CardTitle className="text-lg">Penggunaan Voucher</CardTitle></CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader className="bg-slate-100 uppercase text-[10px] font-bold text-slate-600 tracking-wider">
                                        <TableRow>
                                            <TableHead className="w-12">No</TableHead>
                                            <TableHead>Tanggal Pakai</TableHead>
                                            <TableHead>Jenis Transaksi</TableHead>
                                            <TableHead>Marketing</TableHead>
                                            <TableHead className="text-right">Voucher Digunakan</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.vouchers.map((voucher, idx) => (
                                            <TableRow key={idx} className="hover:bg-slate-50 transition-colors">
                                                <TableCell className="text-slate-400 font-mono text-[10px]">{idx + 1}</TableCell>
                                                <TableCell className="text-xs text-slate-500">{formatDate(voucher.tanggal_use)}</TableCell>
                                                <TableCell className="capitalize font-medium">{voucher.jenis_transaksi}</TableCell>
                                                <TableCell className="text-slate-600">{voucher.marketing || '-'}</TableCell>
                                                <TableCell className="text-right font-bold text-purple-600 tabular-nums">{fmtCurrency(voucher.voucher_use)}</TableCell>
                                            </TableRow>
                                        ))}
                                        <TableRow className="bg-purple-50 font-bold border-t-2">
                                            <TableCell colSpan={4} className="text-right">Total Voucher Digunakan</TableCell>
                                            <TableCell className="text-right text-purple-700 tabular-nums underline">{fmtCurrency(voucherUsed)}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}

                </div>
            )}
        </div>
    )
}

function fmtCurrency(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID') }
function formatDate(s) {
    if (!s) return ''
    try { return new Date(s).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) } catch { return String(s) }
}
