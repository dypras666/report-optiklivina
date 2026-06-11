import React from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from '@/components/ui/skeleton'
import { API_BASE } from '../../config.js'

export default function TransactionItemsDialog({ kodeTransaksi, open, onOpenChange }) {
    const [loading, setLoading] = React.useState(false)
    const [items, setItems] = React.useState([])
    const [payments, setPayments] = React.useState([])
    const [summary, setSummary] = React.useState(null)

    React.useEffect(() => {
        if (open && kodeTransaksi) {
            fetchDetails()
        }
    }, [open, kodeTransaksi])

    async function fetchDetails() {
        setLoading(true)
        try {
            const res = await fetch(`${API_BASE}/api/reports/marketing/${kodeTransaksi}/details`)
            const json = await res.json()
            setItems(json.items || [])
            setPayments(json.payments || [])
            setSummary(json.summary || null)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    function fmtCurrency(n) { return Number(n || 0).toLocaleString('id-ID') }
    function formatDate(s) {
        if (!s) return ''
        if (typeof s === 'string') return s.slice(0, 10)
        try { return new Date(s).toLocaleDateString('id-ID') } catch { return String(s) }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Detail Transaksi {kodeTransaksi}</DialogTitle>
                </DialogHeader>
                <div className="mt-2 text-sm space-y-4">
                    {loading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                        </div>
                    ) : (
                        <>
                            {/* Summary */}
                            {summary && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-lg">
                                    <div>
                                        <div className="text-xs text-muted-foreground">Total Harga</div>
                                        <div className="font-semibold">{fmtCurrency(summary.total_harga)}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-muted-foreground">Total Bayar</div>
                                        <div className="font-semibold text-green-600">{fmtCurrency(summary.total_bayar)}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-muted-foreground">Sisa Bayar</div>
                                        <div className="font-semibold text-red-600">{fmtCurrency(summary.sisa_bayar)}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-muted-foreground">Tanggal Order</div>
                                        <div className="font-semibold">{formatDate(summary.tanggal_order)}</div>
                                    </div>
                                </div>
                            )}

                            {/* Items */}
                            <div>
                                <h3 className="font-semibold mb-2">Item Produk</h3>
                                <div className="border rounded overflow-hidden">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-100 border-b">
                                            <tr>
                                                <th className="p-2">Produk</th>
                                                <th className="p-2 text-right">Qty</th>
                                                <th className="p-2 text-right">Harga</th>
                                                <th className="p-2 text-right">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {items.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50">
                                                    <td className="p-2">
                                                        <div className="font-medium">{row.nama_produk}</div>
                                                        <div className="text-[10px] text-slate-500">{row.jenis_produk}</div>
                                                    </td>
                                                    <td className="p-2 text-right">{row.jumlah}</td>
                                                    <td className="p-2 text-right">{fmtCurrency(row.harga_produk)}</td>
                                                    <td className="p-2 text-right font-semibold">{fmtCurrency(row.jumlah_harga || (row.harga_produk * row.jumlah))}</td>
                                                </tr>
                                            ))}
                                            {items.length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="p-4 text-center text-muted-foreground">Tidak ada item</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Payments */}
                            <div>
                                <h3 className="font-semibold mb-2">Riwayat Pembayaran</h3>
                                <div className="border rounded overflow-hidden">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-100 border-b">
                                            <tr>
                                                <th className="p-2">Tanggal</th>
                                                <th className="p-2 text-right">Jumlah</th>
                                                <th className="p-2">Metode</th>
                                                <th className="p-2">Catatan</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {payments.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50">
                                                    <td className="p-2">
                                                        <div className="font-medium">{formatDate(row.tanggal_bayar)}</div>
                                                        {row.jenis_transaksi && (
                                                            <div className="text-[10px] text-slate-500">{row.jenis_transaksi}</div>
                                                        )}
                                                    </td>
                                                    <td className="p-2 text-right font-semibold text-green-600">{fmtCurrency(row.jumlah_bayar)}</td>
                                                    <td className="p-2">
                                                        <div>{row.metode_setor || '-'}</div>
                                                        {row.id_rekening_setor && (
                                                            <div className="text-[10px] text-slate-500">Rek: {row.id_rekening_setor}</div>
                                                        )}
                                                    </td>
                                                    <td className="p-2">
                                                        {row.catatan_bayar ? (
                                                            <div className="text-xs italic text-slate-600 max-w-xs">{row.catatan_bayar}</div>
                                                        ) : (
                                                            <span className="text-muted-foreground">-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                            {payments.length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="p-4 text-center text-muted-foreground">Belum ada pembayaran</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                {payments.length > 0 && (
                                    <div className="mt-2 text-right">
                                        <span className="text-xs text-muted-foreground">Total Pembayaran: </span>
                                        <span className="font-bold text-green-600">{fmtCurrency(payments.reduce((a, b) => a + Number(b.jumlah_bayar || 0), 0))}</span>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
