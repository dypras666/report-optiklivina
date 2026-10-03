import React, { useState, useEffect } from 'react'
import { Search, Building, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://reportsapi.optiklivina.com'

function ToggleSwitch({ enabled, loading, onToggle, label }) {
  return (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={loading}
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 ${
          enabled ? 'bg-emerald-500' : 'bg-slate-300'
        }`}
        title={`Klik untuk ${enabled ? 'menyembunyikan' : 'menampilkan'} ${label}`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
        enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
      }`}>
        {enabled ? 'Terlihat' : 'Sembunyi'}
      </span>
    </div>
  )
}

function ColumnHeaderWithChecklist({ label, field, isChecked, onToggleAll }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 py-1">
      <span className="font-semibold text-slate-700 text-xs tracking-tight">{label}</span>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onToggleAll()
        }}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md cursor-pointer transition-all duration-150 border text-[11px] font-bold shadow-2xs select-none ${
          isChecked
            ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
            : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'
        }`}
        title={`Klik untuk ${isChecked ? 'sembunyikan' : 'tampilkan'} semua ${label}`}
      >
        <input
          type="checkbox"
          checked={isChecked}
          readOnly
          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 pointer-events-none accent-emerald-600"
        />
        <span>{isChecked ? 'Semua On' : 'Semua Off'}</span>
      </button>
    </div>
  )
}

export default function ManagementCabang() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => {
      setToast(null)
    }, 3500)
  }

  const fetchCabang = async () => {
    try {
      setLoading(true)
      const tok = localStorage.getItem('authToken')
      const res = await fetch(`${API_BASE}/api/management/cabang`, {
        headers: {
          'Authorization': `Bearer ${tok}`
        }
      })
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      }
    } catch (error) {
      console.error('Error fetching cabang:', error)
      showToast('Gagal mengambil data cabang', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCabang()
  }, [])

  const isAllChecked = (field) => {
    if (!data || data.length === 0) return false
    const key = field === 'modal' ? 'status_show_modal' : field === 'diskon' ? 'status_show_diskon' : 'status_show_harga_cabang'
    return data.every(item => item[key] === 1)
  }

  const handleToggleAll = async (field) => {
    const key = field === 'modal' ? 'status_show_modal' : field === 'diskon' ? 'status_show_diskon' : 'status_show_harga_cabang'
    const currentlyAllOn = data.length > 0 && data.every(i => i[key] === 1)
    const newStatus = currentlyAllOn ? 0 : 1
    const fieldLabels = { modal: 'Harga Modal', diskon: 'Diskon', hargaCabang: 'Harga Cabang' }

    setData(prev => prev.map(item => ({ ...item, [key]: newStatus })))

    try {
      const tok = localStorage.getItem('authToken')
      const res = await fetch(`${API_BASE}/api/management/cabang/toggle-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tok}`
        },
        body: JSON.stringify({ field, status: newStatus })
      })
      const json = await res.json()
      if (json.success) {
        showToast(`Semua ${fieldLabels[field]} cabang berhasil diubah ke ${newStatus === 1 ? 'Terlihat' : 'Tersembunyi'}`)
      } else {
        showToast(json.error || 'Gagal mengubah semua status cabang', 'error')
        fetchCabang()
      }
    } catch (e) {
      console.error(e)
      showToast('Koneksi bermasalah', 'error')
      fetchCabang()
    }
  }

  const handleToggleCabang = async (id_cabang, field, currentVal, name) => {
    const newStatus = currentVal === 1 ? 0 : 1
    const fieldEndpoints = {
      modal: '/api/management/cabang/toggle-modal',
      diskon: '/api/management/cabang/toggle-diskon',
      hargaCabang: '/api/management/cabang/toggle-harga-cabang'
    }
    const fieldLabels = {
      modal: 'Harga Modal',
      diskon: 'Diskon',
      hargaCabang: 'Harga Cabang'
    }

    const fieldKey = field === 'modal' ? 'status_show_modal' : field === 'diskon' ? 'status_show_diskon' : 'status_show_harga_cabang'

    // Optimistic update
    setData(prev => prev.map(item => item.id_cabang === id_cabang ? { ...item, [fieldKey]: newStatus } : item))
    setUpdatingId(`cabang-${id_cabang}-${field}`)

    try {
      const tok = localStorage.getItem('authToken')
      const res = await fetch(`${API_BASE}${fieldEndpoints[field]}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tok}`
        },
        body: JSON.stringify({ id_cabang, status: newStatus })
      })
      const json = await res.json()
      if (json.success) {
        showToast(`${fieldLabels[field]} cabang "${name}" diubah ke ${newStatus === 1 ? 'Terlihat' : 'Tersembunyi'}`)
      } else {
        // Revert
        setData(prev => prev.map(item => item.id_cabang === id_cabang ? { ...item, [fieldKey]: currentVal } : item))
        showToast(json.error || 'Gagal mengubah status', 'error')
      }
    } catch (error) {
      console.error(error)
      setData(prev => prev.map(item => item.id_cabang === id_cabang ? { ...item, [fieldKey]: currentVal } : item))
      showToast('Koneksi bermasalah', 'error')
    } finally {
      setUpdatingId(null)
    }
  }

  const filteredData = data.filter(c => 
    (c.nama_cabang || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.alamat_cabang || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl text-sm font-medium transition-all transform animate-in fade-in slide-in-from-top-4 ${
          toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white'
        }`}>
          {toast.type === 'error' ? <AlertCircle size={18} className="text-rose-200" /> : <CheckCircle2 size={18} className="text-emerald-400" />}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Building className="text-primary" /> Pengaturan Cabang Toko
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Atur visibilitas Harga Modal, Diskon, dan Harga Cabang per Cabang Toko
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari cabang..."
              className="w-full pl-10 pr-4 py-2 border rounded-md text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-xs text-slate-500 hover:text-slate-800 underline ml-2"
            >
              Reset
            </button>
          )}
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-600 uppercase bg-slate-100 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Nama Cabang</th>
                <th className="px-5 py-3.5 font-semibold">Alamat Cabang</th>
                <th className="px-4 py-3.5 text-center">
                  <ColumnHeaderWithChecklist
                    label="Harga Modal"
                    field="modal"
                    isChecked={isAllChecked('modal')}
                    onToggleAll={() => handleToggleAll('modal')}
                  />
                </th>
                <th className="px-4 py-3.5 text-center">
                  <ColumnHeaderWithChecklist
                    label="Diskon"
                    field="diskon"
                    isChecked={isAllChecked('diskon')}
                    onToggleAll={() => handleToggleAll('diskon')}
                  />
                </th>
                <th className="px-4 py-3.5 text-center">
                  <ColumnHeaderWithChecklist
                    label="Harga Cabang"
                    field="hargaCabang"
                    isChecked={isAllChecked('hargaCabang')}
                    onToggleAll={() => handleToggleAll('hargaCabang')}
                  />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="animate-spin text-primary" size={20} />
                      <span>Memuat data cabang...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-slate-500">Tidak ada cabang ditemukan.</td>
                </tr>
              ) : (
                filteredData.map(c => (
                  <tr key={c.id_cabang} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4 font-semibold text-slate-800">{c.nama_cabang}</td>
                    <td className="px-5 py-4 text-slate-600 truncate max-w-xs">{c.alamat_cabang}</td>
                    
                    {/* Toggle Switches */}
                    <td className="px-4 py-4 text-center">
                      <ToggleSwitch 
                        enabled={c.status_show_modal === 1}
                        loading={updatingId === `cabang-${c.id_cabang}-modal`}
                        onToggle={() => handleToggleCabang(c.id_cabang, 'modal', c.status_show_modal, c.nama_cabang)}
                        label="Harga Modal"
                      />
                    </td>
                    <td className="px-4 py-4 text-center">
                      <ToggleSwitch 
                        enabled={c.status_show_diskon === 1}
                        loading={updatingId === `cabang-${c.id_cabang}-diskon`}
                        onToggle={() => handleToggleCabang(c.id_cabang, 'diskon', c.status_show_diskon, c.nama_cabang)}
                        label="Diskon"
                      />
                    </td>
                    <td className="px-4 py-4 text-center">
                      <ToggleSwitch 
                        enabled={c.status_show_harga_cabang === 1}
                        loading={updatingId === `cabang-${c.id_cabang}-hargaCabang`}
                        onToggle={() => handleToggleCabang(c.id_cabang, 'hargaCabang', c.status_show_harga_cabang, c.nama_cabang)}
                        label="Harga Cabang"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
