import React, { useState, useEffect } from 'react'
import { UserPlus, Search, Edit, Power, PowerOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { TableBodySkeleton } from '@/components/ui/TableSkeleton.jsx'
import Pagination from '@/components/ui/Pagination.jsx'
import { tableClass, theadClass } from '@/components/ui/tableStyles.js'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://reportsapi.optiklivina.com'

export default function CollectorManagement() {
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(false)
    const [q, setQ] = useState('')
    const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 })
    const [createDialog, setCreateDialog] = useState(false)
    const [editDialog, setEditDialog] = useState(false)
    const [selectedCollector, setSelectedCollector] = useState(null)
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        nama_lengkap: '',
        id_cabang: ''
    })
    const [cabangOpts, setCabangOpts] = useState([])
    const [submitting, setSubmitting] = useState(false)
    const [confirmDialog, setConfirmDialog] = useState({ open: false, collector: null, action: '' })
    const [actionLoading, setActionLoading] = useState(false)

    async function fetchData(page = 1) {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: meta.limit.toString(),
                q: q
            })
            const res = await fetch(`${API_BASE}/api/collectors?${params.toString()}`)
            const json = await res.json()
            setData(json.data || [])
            setMeta(json.meta || { page: 1, limit: 20, total: 0, totalPages: 1 })
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    async function fetchCabangOptions() {
        try {
            const res = await fetch(`${API_BASE}/api/options/cabang`)
            const json = await res.json()
            setCabangOpts(json.data || [])
        } catch (e) {
            console.error(e)
        }
    }

    useEffect(() => {
        fetchData(1)
        fetchCabangOptions()
    }, [])

    const handleSearch = (e) => {
        e.preventDefault()
        fetchData(1)
    }

    const handleCreate = async (e) => {
        e.preventDefault()
        if (!formData.username || !formData.password || !formData.nama_lengkap) {
            alert('Username, password, dan nama lengkap harus diisi')
            return
        }

        setSubmitting(true)
        try {
            const res = await fetch(`${API_BASE}/api/collectors/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })
            const json = await res.json()

            if (res.ok) {
                alert('Akun kolektor berhasil dibuat')
                setCreateDialog(false)
                setFormData({ username: '', password: '', nama_lengkap: '', id_cabang: '' })
                fetchData(meta.page)
            } else {
                alert(json.error || 'Gagal membuat akun kolektor')
            }
        } catch (e) {
            console.error(e)
            alert('Terjadi kesalahan')
        } finally {
            setSubmitting(false)
        }
    }

    const handleUpdate = async (e) => {
        e.preventDefault()
        if (!selectedCollector) return

        setSubmitting(true)
        try {
            const updateData = {
                nama_lengkap: formData.nama_lengkap,
                id_cabang: formData.id_cabang
            }
            if (formData.password) {
                updateData.password = formData.password
            }

            const res = await fetch(`${API_BASE}/api/collectors/${selectedCollector.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            })
            const json = await res.json()

            if (res.ok) {
                alert('Akun kolektor berhasil diperbarui')
                setEditDialog(false)
                setSelectedCollector(null)
                setFormData({ username: '', password: '', nama_lengkap: '', id_cabang: '' })
                fetchData(meta.page)
            } else {
                alert(json.error || 'Gagal memperbarui akun kolektor')
            }
        } catch (e) {
            console.error(e)
            alert('Terjadi kesalahan')
        } finally {
            setSubmitting(false)
        }
    }

    const handleToggleStatus = async (collector) => {
        const isActive = collector.status_user === 1
        const action = isActive ? 'nonaktifkan' : 'aktifkan'

        setConfirmDialog({
            open: true,
            collector: collector,
            action: action
        })
    }

    const confirmToggleStatus = async () => {
        const { collector, action } = confirmDialog
        if (!collector) return

        const isActive = collector.status_user === 1
        setActionLoading(true)

        try {
            const endpoint = isActive
                ? `${API_BASE}/api/collectors/${collector.id}`
                : `${API_BASE}/api/collectors/${collector.id}/activate`

            const res = await fetch(endpoint, {
                method: isActive ? 'DELETE' : 'POST'
            })
            const json = await res.json()

            if (res.ok) {
                setConfirmDialog({ open: false, collector: null, action: '' })
                fetchData(meta.page)
                // You can add toast notification here if you have toast component
            } else {
                alert(json.error || `Gagal ${action} akun`)
            }
        } catch (e) {
            console.error(e)
            alert('Terjadi kesalahan saat mengubah status akun')
        } finally {
            setActionLoading(false)
        }
    }

    const openEditDialog = (collector) => {
        setSelectedCollector(collector)
        setFormData({
            username: collector.username,
            password: '',
            nama_lengkap: collector.nama_lengkap,
            id_cabang: collector.id_cabang || ''
        })
        setEditDialog(true)
    }

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'

    return (
        <div className="space-y-3 p-3 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                    <h1 className="text-lg md:text-2xl font-bold text-slate-800 tracking-tight">Manajemen Akun Kolektor</h1>
                    <p className="text-slate-500 text-xs mt-0.5">Kelola akun kolektor dengan level = 10</p>
                </div>
                <Button onClick={() => setCreateDialog(true)} className="flex items-center gap-2 text-sm h-9">
                    <UserPlus size={16} />
                    <span className="hidden sm:inline">Buat Akun Kolektor</span>
                    <span className="sm:hidden">Buat Akun</span>
                </Button>
            </div>

            <div className="bg-white p-2.5 md:p-4 rounded-xl shadow-sm border border-slate-200">
                <form onSubmit={handleSearch} className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <Input
                            placeholder="Cari username atau nama..."
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            className="pl-8 text-sm h-9 bg-slate-50 border-slate-200 focus:bg-white transition-all"
                        />
                    </div>
                    <Button type="submit" disabled={loading} className="text-sm px-4 h-9">
                        {loading ? 'Memuat...' : 'Cari'}
                    </Button>
                </form>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Desktop Table View - hidden on mobile */}
                <div className="hidden md:block overflow-x-auto">
                    <table className={tableClass}>
                        <thead className={theadClass}>
                            <tr>
                                <th className="px-3 py-2 font-semibold text-xs">No</th>
                                <th className="px-3 py-2 font-semibold text-xs">Username</th>
                                <th className="px-3 py-2 font-semibold text-xs">Nama Lengkap</th>
                                <th className="px-3 py-2 font-semibold text-xs hidden lg:table-cell">Cabang</th>
                                <th className="px-3 py-2 font-semibold text-xs text-center">Level</th>
                                <th className="px-3 py-2 font-semibold text-xs text-center">Status</th>
                                <th className="px-3 py-2 font-semibold text-xs text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <TableBodySkeleton rows={8} cols={7} />
                            ) : data.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic text-sm">
                                        Tidak ada data kolektor ditemukan
                                    </td>
                                </tr>
                            ) : data.map((collector, idx) => {
                                const isActive = collector.status_user === 1
                                return (
                                    <tr key={collector.id} className={`hover:bg-slate-50 transition-colors ${!isActive ? 'bg-slate-100/50' : ''}`}>
                                        <td className="px-3 py-2 font-medium text-slate-600 text-xs">{(meta.page - 1) * meta.limit + idx + 1}</td>
                                        <td className="px-3 py-2 font-medium text-slate-800 text-sm">{collector.username}</td>
                                        <td className="px-3 py-2 text-slate-700 text-sm">{collector.nama_lengkap}</td>
                                        <td className="px-3 py-2 text-slate-600 text-xs hidden lg:table-cell">
                                            {collector.nama_cabang || '-'}
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                                {collector.level}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            {isActive ? (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                    Aktif
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                                    Nonaktif
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2">
                                            <div className="flex items-center justify-center gap-1">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 px-2 text-xs"
                                                    onClick={() => openEditDialog(collector)}
                                                >
                                                    <Edit size={12} />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant={isActive ? 'destructive' : 'default'}
                                                    className="h-7 px-2 text-xs"
                                                    onClick={() => handleToggleStatus(collector)}
                                                >
                                                    {isActive ? <PowerOff size={12} /> : <Power size={12} />}
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View - visible only on mobile */}
                <div className="md:hidden divide-y divide-slate-100">
                    {loading ? (
                        <div className="p-4 space-y-3">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="animate-pulse bg-slate-100 h-24 rounded"></div>
                            ))}
                        </div>
                    ) : data.length === 0 ? (
                        <div className="px-4 py-12 text-center text-slate-400 italic text-sm">
                            Tidak ada data kolektor ditemukan
                        </div>
                    ) : data.map((collector, idx) => {
                        const isActive = collector.status_user === 1
                        return (
                            <div key={collector.id} className={`p-3 ${!isActive ? 'bg-slate-100/50' : ''}`}>
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-semibold text-slate-800 text-sm">{collector.username}</span>
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                                {collector.level}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 truncate">{collector.nama_lengkap}</p>
                                        {collector.nama_cabang && (
                                            <p className="text-xs text-slate-500 mt-0.5">{collector.nama_cabang}</p>
                                        )}
                                    </div>
                                    <div className="flex-shrink-0 ml-2">
                                        {isActive ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                Aktif
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                                Nonaktif
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 px-3 text-xs flex-1"
                                        onClick={() => openEditDialog(collector)}
                                    >
                                        <Edit size={12} className="mr-1" />
                                        Edit
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant={isActive ? 'destructive' : 'default'}
                                        className="h-7 px-3 text-xs flex-1"
                                        onClick={() => handleToggleStatus(collector)}
                                    >
                                        {isActive ? <PowerOff size={12} className="mr-1" /> : <Power size={12} className="mr-1" />}
                                        {isActive ? 'Nonaktif' : 'Aktif'}
                                    </Button>
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className="px-3 md:px-4 py-3 bg-slate-50 border-t border-slate-100">
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

            {/* Create Dialog */}
            <Dialog open={createDialog} onOpenChange={setCreateDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Buat Akun Kolektor Baru</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Username *</label>
                            <Input
                                value={formData.username}
                                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                placeholder="Username untuk login"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Password *</label>
                            <Input
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                placeholder="Password"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap *</label>
                            <Input
                                value={formData.nama_lengkap}
                                onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })}
                                placeholder="Nama lengkap kolektor"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Cabang</label>
                            <select
                                className="w-full border rounded px-3 py-2"
                                value={formData.id_cabang}
                                onChange={(e) => setFormData({ ...formData, id_cabang: e.target.value })}
                            >
                                <option value="">Pilih cabang (opsional)</option>
                                {cabangOpts.map(c => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </select>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setCreateDialog(false)}>
                                Batal
                            </Button>
                            <Button type="submit" disabled={submitting}>
                                {submitting ? 'Menyimpan...' : 'Buat Akun'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={editDialog} onOpenChange={setEditDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Akun Kolektor</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleUpdate} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                            <Input
                                value={formData.username}
                                disabled
                                className="bg-slate-100"
                            />
                            <p className="text-xs text-slate-500 mt-1">Username tidak dapat diubah</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Password Baru</label>
                            <Input
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                placeholder="Kosongkan jika tidak ingin mengubah password"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap *</label>
                            <Input
                                value={formData.nama_lengkap}
                                onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })}
                                placeholder="Nama lengkap kolektor"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Cabang</label>
                            <select
                                className="w-full border rounded px-3 py-2"
                                value={formData.id_cabang}
                                onChange={(e) => setFormData({ ...formData, id_cabang: e.target.value })}
                            >
                                <option value="">Pilih cabang (opsional)</option>
                                {cabangOpts.map(c => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </select>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditDialog(false)}>
                                Batal
                            </Button>
                            <Button type="submit" disabled={submitting}>
                                {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Confirmation Dialog for Enable/Disable */}
            <Dialog open={confirmDialog.open} onOpenChange={(open) => !actionLoading && setConfirmDialog({ ...confirmDialog, open })}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Konfirmasi {confirmDialog.action === 'aktifkan' ? 'Aktifkan' : 'Nonaktifkan'} Akun</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-sm text-slate-600">
                            Apakah Anda yakin ingin <span className="font-semibold">{confirmDialog.action}</span> akun kolektor:
                        </p>
                        <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <div className="text-sm">
                                <div className="font-semibold text-slate-800">{confirmDialog.collector?.nama_lengkap}</div>
                                <div className="text-xs text-slate-500 mt-1">Username: {confirmDialog.collector?.username}</div>
                            </div>
                        </div>
                        {confirmDialog.action === 'nonaktifkan' && (
                            <p className="mt-3 text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                                ⚠️ Akun yang dinonaktifkan tidak akan bisa login ke sistem
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setConfirmDialog({ open: false, collector: null, action: '' })}
                            disabled={actionLoading}
                        >
                            Batal
                        </Button>
                        <Button
                            type="button"
                            variant={confirmDialog.action === 'nonaktifkan' ? 'destructive' : 'default'}
                            onClick={confirmToggleStatus}
                            disabled={actionLoading}
                        >
                            {actionLoading ? 'Memproses...' : (confirmDialog.action === 'aktifkan' ? 'Ya, Aktifkan' : 'Ya, Nonaktifkan')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
