import React from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from '@/components/ui/skeleton'

import { API_BASE } from '../../config.js'

import TransactionItemsDialog from '@/components/transaction/TransactionItemsDialog.jsx'

export default function CustomerUnpaidTrigger({ kodeCustomer, children, onOpen }) {
    const [open, setOpen] = React.useState(false)
    const [loading, setLoading] = React.useState(false)
    const [data, setData] = React.useState([])
    const [selectedTrans, setSelectedTrans] = React.useState(null)

    async function openDialog(e) {
        if (e) e.stopPropagation()
        setOpen(true)
        if (onOpen) onOpen()
        if (loading) return
        setLoading(true)
        try {
            const res = await fetch(`${API_BASE}/api/reports/customer/summary/${kodeCustomer}?limit=100`)
            const json = await res.json()
            const allTrans = json.transactions || []
            const unpaid = allTrans.filter(t => t.sisa > 0)
            setData(unpaid)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    function fmtCurrency(n) { return Number(n || 0).toLocaleString('id-ID') }
    function formatDate(s) { if (!s) return ''; if (typeof s === 'string') return s.slice(0, 10); try { return new Date(s).toLocaleDateString('id-ID') } catch { return String(s) } }

    return (
        <>
            <span onClick={openDialog} className="cursor-pointer">{children}</span>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Transaksi Belum Lunas ({kodeCustomer})</DialogTitle>
                    </DialogHeader>
                    <div className="mt-2 text-sm">
                        {loading ? (
                            <div className="space-y-2">
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-8 w-full" />
                            </div>
                        ) : (
                            <div className="border rounded overflow-hidden">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-100 border-b">
                                        <tr>
                                            <th className="p-2">Kode</th>
                                            <th className="p-2">Tanggal</th>
                                            <th className="p-2">Marketing</th>
                                            <th className="p-2 text-right">Total</th>
                                            <th className="p-2 text-right text-red-600">Sisa</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {data.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedTrans(row.kode)}>
                                                <td className="p-2 font-medium text-primary hover:underline">{row.kode}</td>
                                                <td className="p-2">{formatDate(row.tanggal)}</td>
                                                <td className="p-2 truncate max-w-[100px]">{row.nama_marketing}</td>
                                                <td className="p-2 text-right">{fmtCurrency(row.harga)}</td>
                                                <td className="p-2 text-right font-bold text-red-600 font-mono">{fmtCurrency(row.sisa)}</td>
                                            </tr>
                                        ))}
                                        {data.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="p-4 text-center text-muted-foreground">Tidak ada transaksi belum lunas</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {!loading && data.length > 0 && (
                            <div className="mt-2 text-right font-bold">
                                Total Sisa: {fmtCurrency(data.reduce((a, b) => a + Number(b.sisa || 0), 0))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <TransactionItemsDialog
                kodeTransaksi={selectedTrans}
                open={!!selectedTrans}
                onOpenChange={(v) => !v && setSelectedTrans(null)}
            />
        </>
    )
}
