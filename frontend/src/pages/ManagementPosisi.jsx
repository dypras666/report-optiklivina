import React, { useState, useEffect } from 'react'
import { Search, Users, UserCheck, Shield, CheckCircle2, AlertCircle, Loader2, CheckSquare, ChevronDown, ChevronRight, User } from 'lucide-react'

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

export default function ManagementPosisi() {
  const [activeTab, setActiveTab] = useState('posisi') // 'posisi' | 'marketing'
  const [posisiList, setPosisiList] = useState([])
  const [marketingList, setMarketingList] = useState([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [toast, setToast] = useState(null)
  const [expandedGroupId, setExpandedGroupId] = useState(null)
  const [groupUsers, setGroupUsers] = useState({})
  const [loadingGroupUsers, setLoadingGroupUsers] = useState(false)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => {
      setToast(null)
    }, 3500)
  }

  const fetchPosisi = async () => {
    try {
      const tok = localStorage.getItem('authToken')
      const res = await fetch(`${API_BASE}/api/management/groups`, {
        headers: { 'Authorization': `Bearer ${tok}` }
      })
      const json = await res.json()
      if (json.success) {
        setPosisiList(json.data)
      }
    } catch (error) {
      console.error('Error fetching posisi:', error)
      showToast('Gagal memuat data posisi', 'error')
    }
  }

  const fetchMarketingUsers = async () => {
    try {
      const tok = localStorage.getItem('authToken')
      const res = await fetch(`${API_BASE}/api/management/marketing-users`, {
        headers: { 'Authorization': `Bearer ${tok}` }
      })
      const json = await res.json()
      if (json.success) {
        setMarketingList(json.data)
      }
    } catch (error) {
      console.error('Error fetching marketing users:', error)
      showToast('Gagal memuat akun marketing', 'error')
    }
  }

  const loadData = async () => {
    setLoading(true)
    await Promise.all([fetchPosisi(), fetchMarketingUsers()])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  // Check if all rows in current tab have the field enabled
  const isAllChecked = (field) => {
    const list = activeTab === 'posisi' ? posisiList : marketingList
    if (!list || list.length === 0) return false
    const key = field === 'modal' ? 'status_show_modal' : field === 'diskon' ? 'status_show_diskon' : 'status_show_harga_cabang'
    return list.every(item => item[key] === 1)
  }

  // Handle master toggle / checklist all in thead
  const handleToggleAll = async (field) => {
    const list = activeTab === 'posisi' ? posisiList : marketingList
    const key = field === 'modal' ? 'status_show_modal' : field === 'diskon' ? 'status_show_diskon' : 'status_show_harga_cabang'
    const currentlyAllOn = list.length > 0 && list.every(i => i[key] === 1)
    const newStatus = currentlyAllOn ? 0 : 1
    const fieldLabels = { modal: 'Harga Modal', diskon: 'Diskon', hargaCabang: 'Harga Cabang' }

    // Optimistic UI update
    if (activeTab === 'posisi') {
      setPosisiList(prev => prev.map(item => ({ ...item, [key]: newStatus })))
    } else {
      setMarketingList(prev => prev.map(item => ({ ...item, [key]: newStatus })))
    }

    try {
      const tok = localStorage.getItem('authToken')
      const endpoint = activeTab === 'posisi' ? '/api/management/groups/toggle-all' : '/api/management/marketing-users/toggle-all'
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tok}`
        },
        body: JSON.stringify({ field, status: newStatus })
      })
      const json = await res.json()
      if (json.success) {
        showToast(`Semua ${fieldLabels[field]} ${activeTab === 'posisi' ? 'posisi' : 'akun marketing'} diubah ke ${newStatus === 1 ? 'Terlihat' : 'Tersembunyi'}`)
      } else {
        showToast(json.error || 'Gagal mengubah semua status', 'error')
        loadData()
      }
    } catch (e) {
      console.error(e)
      showToast('Koneksi bermasalah', 'error')
      loadData()
    }
  }

  // Toggle handlers for Posisi (Groups)
  const handleToggleGroup = async (id, field, currentVal, name) => {
    const newStatus = currentVal === 1 ? 0 : 1
    const fieldEndpoints = {
      modal: '/api/management/groups/toggle-modal',
      diskon: '/api/management/groups/toggle-diskon',
      hargaCabang: '/api/management/groups/toggle-harga-cabang'
    }
    const fieldLabels = {
      modal: 'Harga Modal',
      diskon: 'Diskon',
      hargaCabang: 'Harga Cabang'
    }

    const fieldKey = field === 'modal' ? 'status_show_modal' : field === 'diskon' ? 'status_show_diskon' : 'status_show_harga_cabang'

    // Optimistic update
    setPosisiList(prev => prev.map(item => item.id === id ? { ...item, [fieldKey]: newStatus } : item))
    setUpdatingId(`group-${id}-${field}`)

    try {
      const tok = localStorage.getItem('authToken')
      const res = await fetch(`${API_BASE}${fieldEndpoints[field]}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tok}`
        },
        body: JSON.stringify({ id, status: newStatus })
      })
      const json = await res.json()
      if (json.success) {
        showToast(`${fieldLabels[field]} untuk posisi "${name}" diubah ke ${newStatus === 1 ? 'Terlihat' : 'Tersembunyi'}`)
      } else {
        // Revert
        setPosisiList(prev => prev.map(item => item.id === id ? { ...item, [fieldKey]: currentVal } : item))
        showToast(json.error || 'Gagal mengubah status', 'error')
      }
    } catch (error) {
      console.error(error)
      setPosisiList(prev => prev.map(item => item.id === id ? { ...item, [fieldKey]: currentVal } : item))
      showToast('Koneksi bermasalah', 'error')
    } finally {
      setUpdatingId(null)
    }
  }

  // Fetch regular users under a group/role
  const fetchGroupUsers = async (groupId) => {
    setLoadingGroupUsers(true)
    try {
      const tok = localStorage.getItem('authToken')
      const res = await fetch(`${API_BASE}/api/management/groups/${groupId}/users`, {
        headers: { 'Authorization': `Bearer ${tok}` }
      })
      const json = await res.json()
      if (json.success) {
        setGroupUsers(prev => ({ ...prev, [groupId]: json.data }))
      }
    } catch (e) {
      console.error(e)
      showToast('Gagal memuat akun pegawai', 'error')
    } finally {
      setLoadingGroupUsers(false)
    }
  }

  const handleToggleExpandGroup = (groupId) => {
    if (expandedGroupId === groupId) {
      setExpandedGroupId(null)
    } else {
      setExpandedGroupId(groupId)
      if (!groupUsers[groupId]) {
        fetchGroupUsers(groupId)
      }
    }
  }

  // Toggle handlers for Regular Group Users (Per Akun Pegawai)
  const handleToggleUser = async (userId, field, currentVal, name, groupId) => {
    const newStatus = currentVal === 1 ? 0 : 1
    const fieldEndpoints = {
      modal: '/api/management/users/toggle-modal',
      diskon: '/api/management/users/toggle-diskon',
      hargaCabang: '/api/management/users/toggle-harga-cabang'
    }
    const fieldLabels = {
      modal: 'Harga Modal',
      diskon: 'Diskon',
      hargaCabang: 'Harga Cabang'
    }
    const fieldKey = field === 'modal' ? 'effective_modal' : field === 'diskon' ? 'effective_diskon' : 'effective_harga_cabang'
    const rawKey = field === 'modal' ? 'status_show_modal' : field === 'diskon' ? 'status_show_diskon' : 'status_show_harga_cabang'

    // Optimistic update
    setGroupUsers(prev => ({
      ...prev,
      [groupId]: prev[groupId]?.map(u => u.id === userId ? { ...u, [fieldKey]: newStatus, [rawKey]: newStatus } : u)
    }))
    setUpdatingId(`user-${userId}-${field}`)

    try {
      const tok = localStorage.getItem('authToken')
      const res = await fetch(`${API_BASE}${fieldEndpoints[field]}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tok}`
        },
        body: JSON.stringify({ id: userId, status: newStatus })
      })
      const json = await res.json()
      if (json.success) {
        showToast(`${fieldLabels[field]} akun "${name}" diubah ke ${newStatus === 1 ? 'Terlihat' : 'Tersembunyi'}`)
      } else {
        // Revert
        setGroupUsers(prev => ({
          ...prev,
          [groupId]: prev[groupId]?.map(u => u.id === userId ? { ...u, [fieldKey]: currentVal, [rawKey]: currentVal } : u)
        }))
        showToast(json.error || 'Gagal mengubah status akun', 'error')
      }
    } catch (error) {
      console.error(error)
      setGroupUsers(prev => ({
        ...prev,
        [groupId]: prev[groupId]?.map(u => u.id === userId ? { ...u, [fieldKey]: currentVal, [rawKey]: currentVal } : u)
      }))
      showToast('Koneksi bermasalah', 'error')
    } finally {
      setUpdatingId(null)
    }
  }

  const isAllUsersChecked = (groupId, field) => {
    const users = groupUsers[groupId] || []
    if (users.length === 0) return false
    const fieldKey = field === 'modal' ? 'effective_modal' : field === 'diskon' ? 'effective_diskon' : 'effective_harga_cabang'
    return users.every(u => u[fieldKey] === 1)
  }

  const handleToggleAllUsersInGroup = async (groupId, field) => {
    const users = groupUsers[groupId] || []
    const fieldKey = field === 'modal' ? 'effective_modal' : field === 'diskon' ? 'effective_diskon' : 'effective_harga_cabang'
    const rawKey = field === 'modal' ? 'status_show_modal' : field === 'diskon' ? 'status_show_diskon' : 'status_show_harga_cabang'
    const currentlyAllOn = users.length > 0 && users.every(u => u[fieldKey] === 1)
    const newStatus = currentlyAllOn ? 0 : 1
    const fieldLabels = { modal: 'Harga Modal', diskon: 'Diskon', hargaCabang: 'Harga Cabang' }

    // Optimistic update
    setGroupUsers(prev => ({
      ...prev,
      [groupId]: prev[groupId]?.map(u => ({ ...u, [fieldKey]: newStatus, [rawKey]: newStatus }))
    }))

    try {
      const tok = localStorage.getItem('authToken')
      const res = await fetch(`${API_BASE}/api/management/users/toggle-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tok}`
        },
        body: JSON.stringify({ group_id: groupId, field, status: newStatus })
      })
      const json = await res.json()
      if (json.success) {
        showToast(`Semua ${fieldLabels[field]} akun posisi ini diubah ke ${newStatus === 1 ? 'Terlihat' : 'Tersembunyi'}`)
      } else {
        showToast(json.error || 'Gagal mengubah status semua akun', 'error')
        fetchGroupUsers(groupId)
      }
    } catch (e) {
      console.error(e)
      showToast('Koneksi bermasalah', 'error')
      fetchGroupUsers(groupId)
    }
  }

  // Toggle handlers for Marketing Users (Per Akun)
  const handleToggleMarketing = async (id, field, currentVal, name) => {
    const newStatus = currentVal === 1 ? 0 : 1
    const fieldEndpoints = {
      modal: '/api/management/marketing-users/toggle-modal',
      diskon: '/api/management/marketing-users/toggle-diskon',
      hargaCabang: '/api/management/marketing-users/toggle-harga-cabang'
    }
    const fieldLabels = {
      modal: 'Harga Modal',
      diskon: 'Diskon',
      hargaCabang: 'Harga Cabang'
    }

    const fieldKey = field === 'modal' ? 'status_show_modal' : field === 'diskon' ? 'status_show_diskon' : 'status_show_harga_cabang'

    // Optimistic update
    setMarketingList(prev => prev.map(item => item.id === id ? { ...item, [fieldKey]: newStatus } : item))
    setUpdatingId(`mkt-${id}-${field}`)

    try {
      const tok = localStorage.getItem('authToken')
      const res = await fetch(`${API_BASE}${fieldEndpoints[field]}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tok}`
        },
        body: JSON.stringify({ id, status: newStatus })
      })
      const json = await res.json()
      if (json.success) {
        showToast(`${fieldLabels[field]} untuk akun "${name}" diubah ke ${newStatus === 1 ? 'Terlihat' : 'Tersembunyi'}`)
      } else {
        // Revert
        setMarketingList(prev => prev.map(item => item.id === id ? { ...item, [fieldKey]: currentVal } : item))
        showToast(json.error || 'Gagal mengubah status', 'error')
      }
    } catch (error) {
      console.error(error)
      setMarketingList(prev => prev.map(item => item.id === id ? { ...item, [fieldKey]: currentVal } : item))
      showToast('Koneksi bermasalah', 'error')
    } finally {
      setUpdatingId(null)
    }
  }

  const filteredPosisi = posisiList.filter(c => 
    (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredMarketing = marketingList.filter(m => 
    (m.nama_lengkap || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.nama_cabang || '').toLowerCase().includes(searchTerm.toLowerCase())
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

      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Shield className="text-primary" /> Manajemen Akses Harga & Diskon
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Atur visibilitas Harga Modal, Diskon, dan Harga Cabang per Posisi (Role) maupun per Akun Marketing
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6 bg-white rounded-t-lg px-4 pt-3 shadow-sm">
        <button
          onClick={() => setActiveTab('posisi')}
          className={`flex items-center gap-2 pb-3 px-4 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'posisi'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users size={18} />
          <span>Posisi / Role</span>
          <span className="ml-1 text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
            {posisiList.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('marketing')}
          className={`flex items-center gap-2 pb-3 px-4 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'marketing'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck size={18} />
          <span>Akun Marketing (Per User)</span>
          <span className="ml-1 text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
            {marketingList.length}
          </span>
        </button>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        {/* Search Bar */}
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder={activeTab === 'posisi' ? "Cari nama posisi atau deskripsi..." : "Cari nama marketing, username, atau cabang..."}
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
        
        {/* Content based on Active Tab */}
        <div className="overflow-x-auto">
          {activeTab === 'posisi' ? (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-600 uppercase bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Nama Posisi</th>
                  <th className="px-5 py-3.5 font-semibold">Deskripsi</th>
                  <th className="px-5 py-3.5 text-center">
                    <ColumnHeaderWithChecklist
                      label="Harga Modal"
                      field="modal"
                      isChecked={isAllChecked('modal')}
                      onToggleAll={() => handleToggleAll('modal')}
                    />
                  </th>
                  <th className="px-5 py-3.5 text-center">
                    <ColumnHeaderWithChecklist
                      label="Diskon"
                      field="diskon"
                      isChecked={isAllChecked('diskon')}
                      onToggleAll={() => handleToggleAll('diskon')}
                    />
                  </th>
                  <th className="px-5 py-3.5 text-center">
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
                        <span>Memuat data posisi...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredPosisi.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                      Tidak ada posisi ditemukan untuk kata kunci "{searchTerm}".
                    </td>
                  </tr>
                ) : (
                  filteredPosisi.map(c => {
                    const isMarketingGroup = c.id === 4 || c.name.toLowerCase().includes('marketing')
                    return (
                      <React.Fragment key={c.id}>
                        <tr className={`hover:bg-slate-50 transition-colors ${isMarketingGroup ? 'bg-amber-50/40' : ''} ${expandedGroupId === c.id ? 'bg-slate-100/70 border-b-0' : ''}`}>
                          <td className="px-5 py-4 font-medium text-slate-800">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleToggleExpandGroup(c.id)}
                                className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                                title={expandedGroupId === c.id ? "Tutup rincian akun" : "Lihat & atur akun di posisi ini"}
                              >
                                {expandedGroupId === c.id ? <ChevronDown size={18} className="text-primary" /> : <ChevronRight size={18} />}
                              </button>
                              <span 
                                className="cursor-pointer hover:text-primary font-semibold transition-colors" 
                                onClick={() => handleToggleExpandGroup(c.id)}
                              >
                                {c.name}
                              </span>
                              {isMarketingGroup && (
                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                                  Level 4 (Marketing)
                                </span>
                              )}
                            </div>
                            <div className="pl-7 mt-0.5">
                              <button
                                type="button"
                                onClick={() => handleToggleExpandGroup(c.id)}
                                className="text-[11px] text-slate-500 hover:text-primary cursor-pointer flex items-center gap-1 font-medium transition-colors"
                              >
                                <Users size={12} />
                                <span>{expandedGroupId === c.id ? 'Tutup Akun Pegawai' : 'Buka & Atur Akun Pegawai'}</span>
                              </button>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-slate-600">
                            {isMarketingGroup ? 'Marketing & Kolektor Lapangan (Level 4)' : c.description}
                          </td>
                          
                          {/* Toggle Switches */}
                          <td className="px-5 py-4 text-center">
                            <ToggleSwitch 
                              enabled={c.status_show_modal === 1}
                              loading={updatingId === `group-${c.id}-modal`}
                              onToggle={() => handleToggleGroup(c.id, 'modal', c.status_show_modal, c.name)}
                              label="Harga Modal"
                            />
                          </td>
                          <td className="px-5 py-4 text-center">
                            <ToggleSwitch 
                              enabled={c.status_show_diskon === 1}
                              loading={updatingId === `group-${c.id}-diskon`}
                              onToggle={() => handleToggleGroup(c.id, 'diskon', c.status_show_diskon, c.name)}
                              label="Diskon"
                            />
                          </td>
                          <td className="px-5 py-4 text-center">
                            <ToggleSwitch 
                              enabled={c.status_show_harga_cabang === 1}
                              loading={updatingId === `group-${c.id}-hargaCabang`}
                              onToggle={() => handleToggleGroup(c.id, 'hargaCabang', c.status_show_harga_cabang, c.name)}
                              label="Harga Cabang"
                            />
                          </td>
                        </tr>

                        {/* Expanded Sub-table for Individual Users under this Role */}
                        {expandedGroupId === c.id && (
                          <tr className="bg-slate-100/40 border-b-2 border-slate-300">
                            <td colSpan={5} className="p-3 pl-8 md:pl-10">
                              <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-sm">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-slate-200 gap-2">
                                  <div className="flex items-center gap-2">
                                    <UserCheck size={18} className="text-primary" />
                                    <h4 className="font-bold text-slate-800 text-sm">
                                      Daftar Akun Pegawai untuk Posisi: <span className="text-primary">{c.name}</span>
                                    </h4>
                                    <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-bold border border-slate-200">
                                      {(groupUsers[c.id] || []).length} Akun Terdaftar
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-500 italic">
                                    * Pengaturan per akun ini otomatis meng-override default posisi ({c.name})
                                  </p>
                                </div>

                                {loadingGroupUsers && !groupUsers[c.id] ? (
                                  <div className="flex items-center justify-center py-8 gap-2 text-slate-500 text-sm">
                                    <Loader2 className="animate-spin text-primary" size={20} />
                                    <span>Memuat daftar akun pegawai...</span>
                                  </div>
                                ) : (groupUsers[c.id] || []).length === 0 ? (
                                  <div className="py-6 text-center text-slate-500 text-xs bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                    Tidak ada akun pegawai aktif yang terdaftar di posisi "{c.name}".
                                  </div>
                                ) : (
                                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                                    <table className="w-full text-xs text-left">
                                      <thead className="text-[11px] text-slate-600 uppercase bg-slate-50 border-b border-slate-200">
                                        <tr>
                                          <th className="px-4 py-3 font-semibold">Nama Pegawai</th>
                                          <th className="px-4 py-3 font-semibold">Email Login</th>
                                          <th className="px-4 py-3 font-semibold">Cabang Toko</th>
                                          <th className="px-3 py-3 text-center">
                                            <ColumnHeaderWithChecklist
                                              label="Harga Modal"
                                              field="modal"
                                              isChecked={isAllUsersChecked(c.id, 'modal')}
                                              onToggleAll={() => handleToggleAllUsersInGroup(c.id, 'modal')}
                                            />
                                          </th>
                                          <th className="px-3 py-3 text-center">
                                            <ColumnHeaderWithChecklist
                                              label="Diskon"
                                              field="diskon"
                                              isChecked={isAllUsersChecked(c.id, 'diskon')}
                                              onToggleAll={() => handleToggleAllUsersInGroup(c.id, 'diskon')}
                                            />
                                          </th>
                                          <th className="px-3 py-3 text-center">
                                            <ColumnHeaderWithChecklist
                                              label="Harga Cabang"
                                              field="hargaCabang"
                                              isChecked={isAllUsersChecked(c.id, 'hargaCabang')}
                                              onToggleAll={() => handleToggleAllUsersInGroup(c.id, 'hargaCabang')}
                                            />
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 bg-white">
                                        {groupUsers[c.id].map(u => (
                                          <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-4 py-3 font-medium text-slate-800">
                                              {u.first_name} {u.last_name || ''}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 font-mono text-[11px]">
                                              {u.email}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">
                                              <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md text-[11px] font-medium border border-slate-200">
                                                {u.nama_cabang || 'Pusat / Belum Ada'}
                                              </span>
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                              <ToggleSwitch
                                                enabled={u.effective_modal === 1}
                                                loading={updatingId === `user-${u.id}-modal`}
                                                onToggle={() => handleToggleUser(u.id, 'modal', u.effective_modal, `${u.first_name} (${u.email})`, c.id)}
                                                label="Harga Modal"
                                              />
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                              <ToggleSwitch
                                                enabled={u.effective_diskon === 1}
                                                loading={updatingId === `user-${u.id}-diskon`}
                                                onToggle={() => handleToggleUser(u.id, 'diskon', u.effective_diskon, `${u.first_name} (${u.email})`, c.id)}
                                                label="Diskon"
                                              />
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                              <ToggleSwitch
                                                enabled={u.effective_harga_cabang === 1}
                                                loading={updatingId === `user-${u.id}-hargaCabang`}
                                                onToggle={() => handleToggleUser(u.id, 'hargaCabang', u.effective_harga_cabang, `${u.first_name} (${u.email})`, c.id)}
                                                label="Harga Cabang"
                                              />
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-600 uppercase bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Nama Lengkap</th>
                  <th className="px-5 py-3.5 font-semibold">Username Akun</th>
                  <th className="px-5 py-3.5 font-semibold">Cabang Toko</th>
                  <th className="px-5 py-3.5 text-center">
                    <ColumnHeaderWithChecklist
                      label="Harga Modal"
                      field="modal"
                      isChecked={isAllChecked('modal')}
                      onToggleAll={() => handleToggleAll('modal')}
                    />
                  </th>
                  <th className="px-5 py-3.5 text-center">
                    <ColumnHeaderWithChecklist
                      label="Diskon"
                      field="diskon"
                      isChecked={isAllChecked('diskon')}
                      onToggleAll={() => handleToggleAll('diskon')}
                    />
                  </th>
                  <th className="px-5 py-3.5 text-center">
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
                    <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="animate-spin text-primary" size={20} />
                        <span>Memuat data akun marketing...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredMarketing.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-slate-500">
                      Tidak ada akun marketing ditemukan untuk kata kunci "{searchTerm}".
                    </td>
                  </tr>
                ) : (
                  filteredMarketing.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 font-semibold text-slate-800">
                        {m.nama_lengkap || '-'}
                      </td>
                      <td className="px-5 py-4 text-slate-600 font-mono text-xs">
                        <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200">
                          {m.username}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-700">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          {m.nama_cabang || 'Semua Cabang'}
                        </span>
                      </td>
                      
                      {/* Toggle Switches */}
                      <td className="px-5 py-4 text-center">
                        <ToggleSwitch 
                          enabled={m.status_show_modal === 1}
                          loading={updatingId === `mkt-${m.id}-modal`}
                          onToggle={() => handleToggleMarketing(m.id, 'modal', m.status_show_modal, m.nama_lengkap || m.username)}
                          label="Harga Modal"
                        />
                      </td>
                      <td className="px-5 py-4 text-center">
                        <ToggleSwitch 
                          enabled={m.status_show_diskon === 1}
                          loading={updatingId === `mkt-${m.id}-diskon`}
                          onToggle={() => handleToggleMarketing(m.id, 'diskon', m.status_show_diskon, m.nama_lengkap || m.username)}
                          label="Diskon"
                        />
                      </td>
                      <td className="px-5 py-4 text-center">
                        <ToggleSwitch 
                          enabled={m.status_show_harga_cabang === 1}
                          loading={updatingId === `mkt-${m.id}-hargaCabang`}
                          onToggle={() => handleToggleMarketing(m.id, 'hargaCabang', m.status_show_harga_cabang, m.nama_lengkap || m.username)}
                          label="Harga Cabang"
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
