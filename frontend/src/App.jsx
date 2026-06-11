import React, { useEffect, useMemo, useState, useRef } from 'react'
import { Bell, Eye, EyeOff, TrendingUp, LayoutDashboard, Store, Database, PieChart, ClipboardList, Check, Ticket, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar'
import AppSidebar from './components/app-sidebar.jsx'
import OmsetToko from './pages/OmsetToko.jsx'
import Pagination from '@/components/ui/Pagination.jsx'
import { containerClass } from '@/components/ui/tableStyles.js'
import MarketingTable from '@/components/reports/MarketingTable'
import { Combobox } from '@/components/ui/combobox'
import MarketingTransactionDetailTrigger from '@/components/marketing/MarketingTransactionDetailTrigger.jsx'
import TokoTable from '@/components/reports/TokoTable'
import OmsetTable from '@/components/reports/OmsetTable'
import AnalysisCabang from './pages/AnalysisCabang.jsx'
import CustomerDetailTrigger from '@/components/customer/CustomerDetailTrigger.jsx'
import AnalysisCabangTop from './pages/AnalysisCabangTop.jsx'
import AnalysisMarketing from './pages/AnalysisMarketing.jsx'
import LabaRugi from './pages/LabaRugi.jsx'
import Aset from './pages/Aset.jsx'
import AsetIdleExport from './pages/AsetIdleExport.jsx'
import Customers from './pages/Customers.jsx'
import { TableBodySkeleton } from '@/components/ui/TableSkeleton.jsx'
import MasterItems from './pages/MasterItems.jsx'
import ItemsTransaksi from './pages/ItemsTransaksi.jsx'
import KtpRegister from './pages/KtpRegister.jsx'
import LowDP from './pages/LowDP.jsx'
import BestCustomers from './pages/BestCustomers.jsx'
import VoucherPayments from './pages/VoucherPayments.jsx'
import Sponsors from './pages/Sponsors.jsx'
import TransactionSearch from './pages/TransactionSearch.jsx'
import VoucherApproval from './pages/VoucherApproval.jsx'
import CollectorPayments from './pages/CollectorPayments.jsx'
import CollectorManagement from './pages/CollectorManagement.jsx'
import PointUsage from './pages/PointUsage.jsx'
import SponsorApproval from './pages/SponsorApproval.jsx'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://reportsapi.optiklivina.com'
const OMSET_URL = import.meta.env.VITE_OMSET_URL || ''

export default function App() {
  const [notifications, setNotifications] = useState([])
  const [jobs, setJobs] = useState([])
  const [openJobs, setOpenJobs] = useState(false)
  const [route, setRoute] = useState(window.location.hash.replace('#/', '') || '')
  const routeBase = React.useMemo(() => (route || '').split('?')[0], [route])
  const [authToken, setAuthToken] = useState(localStorage.getItem('authToken') || '')
  const [authLoading, setAuthLoading] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const origFetchRef = useRef(null)
  const logoutTimerRef = useRef(null)
  useEffect(() => {
    const onHash = () => setRoute(window.location.hash.replace('#/', '') || '')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  useEffect(() => {
    if (!authToken) return
    const es = new EventSource(`${API_BASE}/api/jobs/events${authToken ? `?token=${encodeURIComponent(authToken)}` : ''}`)
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg?.type === 'job_enqueued') {
          setJobs(j => [{ id: msg.id, type: msg.job_type, status: 'pending', progress: 0, label: msg.label || '' }, ...j.filter(x => x.id !== msg.id)].slice(0, 50))
        } else if (msg?.type === 'job_progress') {
          setJobs(j => {
            const exists = j.find(x => x.id === msg.id)
            const upd = { id: msg.id, type: msg.job_type, status: 'in_progress', progress: Number(msg.progress || 0), label: msg.label || '' }
            return exists ? j.map(x => x.id === msg.id ? { ...x, ...upd } : x) : [upd, ...j].slice(0, 50)
          })
        } else if (msg?.type === 'job_completed') {
          if (msg?.status === 'completed') {
            const isMarketing = msg?.job_type === 'analysisMarketing'
            const link = isMarketing ? `#/analysis-marketing?report=${msg.id}` : `${API_BASE}/api/reports/generated/${msg.id}`
            setNotifications(n => [{ id: msg.id, text: 'Laporan siap', link }, ...n.filter(x => x.id !== msg.id)].slice(0, 5))
          }
          const isMarketing = msg?.job_type === 'analysisMarketing'
          const link = isMarketing ? `#/analysis-marketing?report=${msg.id}` : `${API_BASE}/api/reports/generated/${msg.id}`
          setJobs(j => j.map(x => x.id === msg.id ? { ...x, status: msg.status || 'completed', progress: msg.status === 'completed' ? 100 : Number(x.progress || 0), label: msg.label || x.label } : x))
        }
      } catch { }
    }
    return () => { es.close() }
  }, [authToken])
  useEffect(() => {
    if (!authToken) return
    async function initJobs() {
      try {
        const res = await fetch(`${API_BASE}/api/jobs`)
        const json = await res.json()
        setJobs((json.jobs || []).map(j => ({ id: j.id, type: j.type, status: j.status, progress: Number(j.progress || 0), label: (j.marketing_name && j.period_text) ? `${j.marketing_name} • ${j.period_text}` : (j.period_text || '') })))
      } catch { }
    }
    initJobs()
  }, [authToken])
  useEffect(() => {
    if (routeBase === 'omset') {
      setFilters(f => ({ ...f, mode: 'omset' }))
    } else if (routeBase === 'toko') {
      setFilters(f => ({ ...f, mode: 'toko' }))
    } else if (routeBase === 'marketing' || routeBase === '') {
      setFilters(f => ({ ...f, mode: 'marketing' }))
    }
  }, [routeBase])
  const [showOmsetHarian, setShowOmsetHarian] = useState(false)
  useEffect(() => {
    setShowOmsetHarian(routeBase === 'omset-harian')
  }, [routeBase])
  const isOmsetRoute = route === 'omset'
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({ pembukuan_id: '', marketing: '', cabang: '', mode: 'marketing' })
  const [activePembukuan, setActivePembukuan] = useState(null)
  const [listPembukuan, setListPembukuan] = useState([])
  const [marketingOpts, setMarketingOpts] = useState([])
  const [cabangOpts, setCabangOpts] = useState([])
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [openRows, setOpenRows] = useState({})
  const [itemsMap, setItemsMap] = useState({})
  const [omsetOpenRows, setOmsetOpenRows] = useState({})
  const [omsetItemsMap, setOmsetItemsMap] = useState({})
  const [controller, setController] = useState(null)
  const tableRef = useRef(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  function toggleFullscreen() {
    const el = tableRef.current
    if (!el) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
      setIsFullscreen(false)
    } else {
      el.requestFullscreen?.()
      setIsFullscreen(true)
    }
  }



  useEffect(() => {
    if (!origFetchRef.current) { origFetchRef.current = window.fetch }
    const orig = origFetchRef.current
    window.fetch = async (input, init = {}) => {
      const headers = new Headers(init?.headers || {})
      const tok = localStorage.getItem('authToken')
      if (tok) headers.set('Authorization', `Bearer ${tok}`)
      const res = await orig(input, { ...init, headers })
      if (res?.status === 401) {
        try { localStorage.removeItem('authToken') } catch { }
        const urlStr = String(input)
        const isWhitelisted = urlStr.includes('/api/aset') || urlStr.includes('/api/options') || urlStr.includes('/api/pembukuan/active')
        if (!isWhitelisted) {
           window.dispatchEvent(new Event('auth-logout'))
        }
      }
      return res
    }
    const onLogout = () => setAuthToken('')
    window.addEventListener('auth-logout', onLogout)
    return () => window.removeEventListener('auth-logout', onLogout)
  }, [])

  function readCookieToken() {
    try {
      const pairs = document.cookie.split(';').map(s => s.trim())
      for (const p of pairs) {
        if (p.startsWith('authToken=')) return decodeURIComponent(p.slice('authToken='.length))
      }
      return null
    } catch { return null }
  }

  function readQueryToken() {
    try {
      const params = new URLSearchParams(window.location.search)
      const t = params.get('token')
      return t || null
    } catch { return null }
  }

  useEffect(() => {
    if (authToken) return
    try {
      const m = String(window.location.pathname || '').match(/^\/?token\/(.+)$/)
      if (m && m[1]) {
        const tok = decodeURIComponent(m[1])
        try { localStorage.setItem('authToken', tok) } catch { }
        setAuthToken(tok)
        const h = window.location.hash || '#/'
        window.history.replaceState(null, '', '/' + (h.startsWith('#') ? h : ('#' + h)))
        return
      }
    } catch { }
    const fromQuery = readQueryToken()
    const fromCookie = readCookieToken()
    const fromEnv = import.meta.env.VITE_DEFAULT_TOKEN || ''
    const tok = fromQuery || fromCookie || fromEnv
    if (tok) {
      try { localStorage.setItem('authToken', tok) } catch { }
      setAuthToken(tok)
    }
  }, [])

  async function doLogin(e) {
    e?.preventDefault?.()
    if (authLoading) return
    setAuthLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
      const json = await res.json()
      if (res.ok && json?.token) { localStorage.setItem('authToken', json.token); setAuthToken(json.token) }
      else { alert(json?.error || 'Login gagal') }
    } catch { alert('Login gagal') }
    finally { setAuthLoading(false) }
  }

  function doLogout() {
    try { localStorage.removeItem('authToken') } catch { }
    setAuthToken('')
    window.dispatchEvent(new Event('auth-logout'))
  }

  function parseJwt(token) {
    try {
      const parts = String(token).split('.')
      if (parts.length < 2) return null
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
      const json = JSON.parse(atob(b64))
      return json
    } catch { return null }
  }

  function getTokenExpiryMs(token) {
    const payload = parseJwt(token)
    const expSec = payload?.exp ? Number(payload.exp) : null
    return expSec ? (expSec * 1000) : null
  }

  useEffect(() => {
    if (logoutTimerRef.current) { clearTimeout(logoutTimerRef.current); logoutTimerRef.current = null }
    if (!authToken) return
    const expMs = getTokenExpiryMs(authToken)
    if (expMs && Number.isFinite(expMs)) {
      const now = Date.now()
      if (now >= expMs) { doLogout(); return }
      const delay = Math.max(0, expMs - now)
      logoutTimerRef.current = setTimeout(() => { doLogout() }, delay)
    }
    return () => { if (logoutTimerRef.current) { clearTimeout(logoutTimerRef.current); logoutTimerRef.current = null } }
  }, [authToken])

  const totals = useMemo(() => {
    const fix = rows.reduce((a, r) => a + Number(r.fix_harga || 0), 0)
    const ongkir = rows.reduce((a, r) => a + Number(r.ongkir_items || 0), 0)
    const bayar = rows.reduce((a, r) => a + Number(r.jml_bayar || 0), 0)
    const sisa = rows.reduce((a, r) => a + Number(r.sisa_bayar || 0), 0)
    const laba = rows.reduce((a, r) => a + Number(r.laba_items || 0), 0)
    const laba_est = rows.reduce((a, r) => a + (Number(r.sisa_bayar || 0) > 0 ? Number(r.laba_items || 0) : 0), 0)
    const laba_paid = rows.reduce((a, r) => a + ((Number(r.sisa_bayar || 0) <= 0) ? Number(r.laba_items || 0) : 0), 0)
    return { fix, ongkir, bayar, sisa, laba, laba_est, laba_paid }
  }, [rows])

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    if (filters.pembukuan_id) { p.set('pembukuan_id', filters.pembukuan_id) }
    if (filters.marketing) { p.set('marketing', filters.marketing) }
    if (filters.cabang) { p.set('cabang', filters.cabang) }
    if (meta.page) { p.set('page', meta.page) }
    if (meta.limit) { p.set('limit', meta.limit) }
    return p.toString()
  }, [filters, meta.page, meta.limit])

  async function fetchData() {
    if (controller) { try { controller.abort() } catch { } }
    const ctrl = new AbortController()
    setController(ctrl)
    setLoading(true)
    const base = (filters.mode === 'toko') ? 'toko' : (filters.mode === 'omset' ? 'omset-toko' : 'marketing')
    const url = `${API_BASE}/api/reports/${base}${qs ? `?${qs}` : ''}`
    try {
      const res = await fetch(url, { signal: ctrl.signal })
      const json = await res.json()
      const incomingMeta = json.meta || { page: 1, limit: 20, total: 0, totalPages: 0 }
      const requestedPage = Number(incomingMeta.page || 1)
      const totalPages = Number(incomingMeta.totalPages || 0)
      const finalPage = (totalPages > 0 && requestedPage > totalPages) ? totalPages : requestedPage
      setRows(json.data || [])
      setMeta({ ...incomingMeta, page: finalPage })
    } catch (e) {
      if (e?.name !== 'AbortError') { console.error(e) }
    } finally {
      setLoading(false)
    }
  }

  async function initPembukuan() {
    const [activeRes, listRes] = await Promise.all([
      fetch(`${API_BASE}/api/pembukuan/active`),
      fetch(`${API_BASE}/api/pembukuan/list`)
    ])
    const activeJson = await activeRes.json()
    const listJson = await listRes.json()
    setActivePembukuan(activeJson.data || null)
    setListPembukuan(listJson.data || [])
    if (activeJson.data && activeJson.data.id_toko_tutup) {
      setFilters(f => ({ ...f, pembukuan_id: String(activeJson.data.id_toko_tutup) }))
    }
  }

  async function initOptions() {
    const [mRes, cRes] = await Promise.all([
      fetch(`${API_BASE}/api/options/marketing`),
      fetch(`${API_BASE}/api/options/cabang`)
    ])
    const mJson = await mRes.json()
    const cJson = await cRes.json()
    setMarketingOpts(mJson.data || [])
    setCabangOpts(cJson.data || [])
  }

  useEffect(() => {
    if (!authToken) return
    if (['', 'marketing', 'toko', 'omset', 'collector-payments', 'low-dp', 'marketing-overdue'].includes(routeBase)) {
      initPembukuan().then(initOptions).then(fetchData)
    }
  }, [routeBase, authToken])
  useEffect(() => {
    if (!authToken) return
    if (['', 'marketing', 'toko', 'omset', 'collector-payments', 'low-dp', 'marketing-overdue'].includes(routeBase)) {
      fetchData()
    }
  }, [meta.page, meta.limit, filters.mode, filters.cabang, filters.marketing, filters.pembukuan_id, routeBase, authToken])

  useEffect(() => {
    setMeta(m => ({ ...m, page: 1 }))
  }, [filters.mode, filters.pembukuan_id])
  useEffect(() => {
    if (!authToken) return
    async function refetchMarketing() {
      const cabangId = filters.cabang || ''
      const url = cabangId ? `${API_BASE}/api/options/marketing?cabangId=${cabangId}` : `${API_BASE}/api/options/marketing`
      const res = await fetch(url)
      const json = await res.json()
      setMarketingOpts(json.data || [])
    }
    // reset marketing saat cabang berubah
    setFilters(f => ({ ...f, marketing: '' }))
    refetchMarketing()
  }, [filters.cabang, authToken])

  useEffect(() => {
    if (!authToken) return
    if (routeBase === 'marketing-overdue') {
      initOptions()
    }
  }, [routeBase, authToken])

  async function deleteJob(j) {
    try {
      await fetch(`${API_BASE}/api/jobs/${j.id}`, { method: 'DELETE' })
      setJobs(s => s.filter(x => x.id !== j.id))
      setNotifications(n => n.filter(x => x.id !== j.id))
    } catch { }
  }

  const isPublicRoute = React.useMemo(() => {
    return ['master-katalog', 'master-frame', 'master-softlens', 'master-lensa', 'aset'].includes(routeBase)
  }, [routeBase])

  if (!authToken && !isPublicRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <form onSubmit={doLogin} className="w-full max-w-sm p-4 bg-white border rounded shadow">
          <div className="text-lg font-semibold mb-3">Masuk</div>
          <div className="mb-2">
            <input className="w-full border rounded px-2 py-2" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
          </div>
          <div className="mb-4 relative">
            <input className="w-full border rounded px-2 py-2 pr-10" type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700" onClick={() => setShowPassword(s => !s)}>{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
          </div>
          <button className="w-full py-2 rounded bg-slate-800 text-white" disabled={authLoading} onClick={doLogin}>{authLoading ? 'Memproses...' : 'Login'}</button>
        </form>
      </div>
    )
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex">
        <AppSidebar />
        <SidebarInset className="px-0 mx-0 w-full min-w-0 overflow-x-hidden">
          <div className="mb-2 flex items-center justify-between">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <button className="inline-flex items-center justify-center rounded-md h-8 w-8 border" onClick={() => setOpenJobs(o => !o)}>
                <Bell className="h-4 w-4" />
              </button>
              {authToken ? (
                <Button variant="outline" className="h-8" onClick={doLogout}>Keluar</Button>
              ) : (
                <Button variant="outline" className="h-8" onClick={() => setRoute('login')}>Masuk</Button>
              )}
            </div>
          </div>
          {openJobs && (
            <div className="absolute right-2 top-10 z-50 bg-white border rounded shadow w-[280px] max-w-[90%]">
              <div className="px-3 py-2 border-b text-sm font-semibold">Antrean Laporan</div>
              <div className="max-h-[320px] overflow-auto">
                {jobs.map(j => (
                  <div key={j.id} className="px-3 py-2 border-b">
                    <div className="text-xs text-slate-600 truncate">{j.label || j.type}</div>
                    <div className="text-xs mb-1">{j.status === 'pending' ? 'Menunggu' : (j.status === 'in_progress' ? 'Memproses' : (j.status === 'failed' ? 'Gagal' : 'Selesai'))}</div>
                    <div className="h-2 bg-slate-200 rounded">
                      <div className={j.status === 'failed' ? "h-2 bg-red-600 rounded" : "h-2 bg-green-600 rounded"} style={{ width: `${Math.max(0, Math.min(100, j.status === 'completed' ? 100 : Number(j.progress || 0)))}%` }}></div>
                    </div>
                    {j.status === 'completed' && (
                      <div className="mt-2 text-xs flex items-center gap-2">
                        <a href={j.type === 'analysisMarketing' ? `#/analysis-marketing?report=${j.id}` : `${API_BASE}/api/reports/generated/${j.id}`} className="underline">Lihat</a>
                        <button className="underline text-red-600" onClick={() => deleteJob(j)}>Hapus</button>
                      </div>
                    )}
                    {j.status === 'failed' && (
                      <div className="mt-2 text-xs flex items-center gap-2">
                        <button className="underline" onClick={() => retryJob(j)}>Coba Lagi</button>
                        <button className="underline text-red-600" onClick={() => deleteJob(j)}>Hapus</button>
                      </div>
                    )}
                  </div>
                ))}
                {jobs.length === 0 && (
                  <div className="px-3 py-2 text-sm">Tidak ada antrean</div>
                )}
              </div>
            </div>
          )}
          {notifications.length > 0 && (
            <div className="fixed top-2 right-2 z-50 space-y-2">
              {notifications.map(n => (
                <div key={n.id} className="bg-green-600 text-white px-3 py-2 rounded shadow flex items-center gap-2">
                  <span>{n.text}</span>
                  <a href={n.link} className="underline">Lihat</a>
                  <button className="ml-2 underline" onClick={() => setNotifications(s => s.filter(x => x.id !== n.id))}>Tutup</button>
                </div>
              ))}
            </div>
          )}
          {routeBase === 'login' ? (
             <div className="min-h-screen flex items-center justify-center bg-slate-100">
               <form onSubmit={doLogin} className="w-full max-w-sm p-4 bg-white border rounded shadow">
                 <div className="text-lg font-semibold mb-3">Masuk</div>
                 <div className="mb-2">
                   <input className="w-full border rounded px-2 py-2" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
                 </div>
                 <div className="mb-4 relative">
                   <input className="w-full border rounded px-2 py-2 pr-10" type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
                   <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700" onClick={() => setShowPassword(s => !s)}>{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
                 </div>
                 <button className="w-full py-2 rounded bg-slate-800 text-white" disabled={authLoading} onClick={doLogin}>{authLoading ? 'Memproses...' : 'Login'}</button>
               </form>
             </div>
          ) : showOmsetHarian ? (
            <OmsetToko />
          ) : route.startsWith('analysis?') ? (
            <AnalysisCabang />
          ) : routeBase === 'analysis-cabang' ? (
            <AnalysisCabangTop />
          ) : routeBase === 'analysis-marketing' ? (
            <AnalysisMarketing />
          ) : routeBase === 'laba-rugi' ? (
            <LabaRugi />
          ) : routeBase === 'aset' ? (
            <Aset />
          ) : route.startsWith('aset-idle-export?') ? (
            <AsetIdleExport />
          ) : routeBase === 'customers' ? (
            <Customers />
          ) : routeBase === 'marketing-overdue' ? (
            <MarketingOverdueView cabangOpts={cabangOpts} marketingOpts={marketingOpts} />
          ) : routeBase === 'master-katalog' ? (
            <MasterItems jenis="katalog" />
          ) : routeBase === 'master-frame' ? (
            <MasterItems jenis="frame" />
          ) : routeBase === 'master-softlens' ? (
            <MasterItems jenis="softlens" />
          ) : routeBase === 'master-lensa' ? (
            <MasterItems jenis="lensa" />
          ) : routeBase === 'items-transaksi' ? (
            <ItemsTransaksi />
          ) : routeBase === 'ktp-register' ? (
            <KtpRegister />
          ) : routeBase === 'low-dp' ? (
            <LowDP />
          ) : routeBase === 'best-customers' ? (
            <BestCustomers />
          ) : routeBase === 'point-usage' ? (
            <PointUsage listPembukuan={listPembukuan} filters={filters} />
          ) : routeBase === 'marketing-voucher' ? (
            <VoucherPayments />
          ) : routeBase === 'sponsors' ? (
            <Sponsors />
          ) : routeBase === 'transaction-search' ? (
            <TransactionSearch />
          ) : routeBase === 'voucher-approval' ? (
            <VoucherApproval />
          ) : routeBase === 'sponsor-approval' ? (
            <SponsorApproval />
          ) : routeBase === 'collector-management' ? (
            <CollectorManagement />
          ) : (
            <>
              {routeBase === 'collector-payments' && (
                <div className="mb-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div>
                      <h1 className="text-2xl font-bold text-slate-800 tracking-tight">List Pembayaran Kolektor</h1>
                      <p className="text-slate-500 text-sm mt-1">Daftar pembayaran yang ditagih oleh kolektor</p>
                    </div>
                  </div>
                </div>
              )}

              {['', 'marketing', 'toko', 'omset', 'collector-payments'].includes(routeBase) && (
                <>
                  {routeBase !== 'collector-payments' && (
                    <>
                      <h1 className="text-2xl font-semibold mb-1">{filters.mode === 'marketing' ? 'Rekap Paket Marketing' : (filters.mode === 'toko' ? 'Rekap Toko' : 'Omset Toko (Periode)')}</h1>
                      {activePembukuan && (
                        <p className="mb-3 text-sm text-slate-600">Pembukuan aktif: {formatDate(activePembukuan.tanggal_buka_buku)} — {formatDate(activePembukuan.tanggal_tutup_buku)}</p>
                      )}
                    </>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-4">
                    <select className="border rounded px-2 py-1" value={filters.pembukuan_id} onChange={e => setFilters(f => ({ ...f, pembukuan_id: e.target.value }))}>
                      <option value="">Pilih pembukuan</option>
                      {listPembukuan.map(p => (
                        <option key={p.id_toko_tutup} value={p.id_toko_tutup}>
                          {p.tanggal_buka_buku} — {p.tanggal_tutup_buku}
                        </option>
                      ))}
                    </select>
                    {routeBase !== 'collector-payments' && (
                      <>
                        <select className="border rounded px-2 py-1" value={filters.cabang} onChange={e => setFilters(f => ({ ...f, cabang: e.target.value }))}>
                          <option value="">Pilih cabang</option>
                          {cabangOpts.map(c => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>
                        {filters.mode === 'marketing' && (
                          <Combobox
                            options={marketingOpts}
                            value={filters.marketing}
                            onChange={val => setFilters(f => ({ ...f, marketing: val }))}
                            placeholder="Pilih marketing"
                            className="w-[240px]"
                          />
                        )}
                        <select className="border rounded px-2 py-1" value={meta.limit} onChange={e => setMeta(m => ({ ...m, page: 1, limit: parseInt(e.target.value, 10) }))}>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                          <option value={200}>200</option>
                          <option value={1000}>Show All</option>
                        </select>
                        <Button onClick={fetchData} disabled={loading}>{loading ? 'Memuat...' : 'Filter'}</Button>
                        <Button onClick={toggleFullscreen}>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</Button>
                      </>
                    )}
                  </div>
                </>
              )}

              {routeBase === 'collector-payments' ? (
                <CollectorPayments filters={filters} listPembukuan={listPembukuan} />
              ) : (
                <>
                  <div ref={tableRef} className={isFullscreen ? 'bg-white text-slate-900 overflow-auto w-screen h-screen p-4 z-50' : containerClass}>
                    {filters.mode === 'marketing' && (
                      <MarketingTable rows={rows} totals={totals} openRows={openRows} setOpenRows={setOpenRows} itemsMap={itemsMap} setItemsMap={setItemsMap} />
                    )}
                    {filters.mode === 'toko' && (
                      <TokoTable rows={rows} loading={loading} />
                    )}
                    {filters.mode === 'omset' && (
                      <OmsetTable rows={rows} pembukuanId={filters.pembukuan_id} openRows={omsetOpenRows} setOpenRows={setOmsetOpenRows} itemsMap={omsetItemsMap} setItemsMap={setOmsetItemsMap} />
                    )}
                  </div>

                  <Pagination
                    className="mt-3"
                    page={meta.page}
                    totalPages={meta.totalPages}
                    total={meta.total}
                    disabledPrev={meta.limit >= 1000 || meta.page <= 1 || loading}
                    disabledNext={meta.limit >= 1000 || meta.page >= meta.totalPages || loading}
                    onPrev={() => setMeta(m => ({ ...m, page: Math.max(1, m.page - 1) }))}
                    onNext={() => setMeta(m => ({ ...m, page: Math.min(m.totalPages, m.page + 1) }))}
                  />
                </>
              )}
            </>
          )}
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}

function fmtCurrency(n) {
  return Number(n || 0).toLocaleString('id-ID')
}

function formatDate(s) {
  if (!s) return ''
  if (typeof s === 'string') return s.slice(0, 10)
  try { return new Date(s).toLocaleDateString('id-ID') } catch { return String(s) }
}

function TotalsBar({ rows = [] }) {
  const sum_fix_harga = rows.reduce((a, r) => a + Number(r.fix_harga || 0), 0)
  const sum_jml_bayar = rows.reduce((a, r) => a + Number(r.jml_bayar || 0), 0)
  const sum_sisa_bayar = rows.reduce((a, r) => a + Number(r.sisa_bayar || 0), 0)
  const sum_laba_items = rows.reduce((a, r) => a + Number(r.laba_items || 0), 0)
  const sum_laba_est = rows.reduce((a, r) => a + (Number(r.sisa_bayar || 0) > 0 ? Number(r.laba_items || 0) : 0), 0)
  const sum_laba_paid = rows.reduce((a, r) => a + (Number(r.sisa_bayar || 0) <= 0 ? Number(r.laba_items || 0) : 0), 0)
  return (
    <div className="mt-3 p-3 border rounded bg-slate-50 text-sm">
      <div className="flex gap-6">
        <div>Total Fix Harga: <b>{fmtCurrency(sum_fix_harga)}</b></div>
        <div>Total Bayar: <b>{fmtCurrency(sum_jml_bayar)}</b></div>
        <div>Sisa Bayar: <b>{fmtCurrency(sum_sisa_bayar)}</b></div>
        <div>Laba Item: <b>{fmtCurrency(sum_laba_items)}</b></div>
        <div>Estimasi Laba (Belum Lunas): <b>{fmtCurrency(sum_laba_est)}</b></div>
        <div>Laba Klik Bayar (Sudah Lunas): <b>{fmtCurrency(sum_laba_paid)}</b></div>
      </div>
    </div>
  )
}

async function retryJob(j) {
  try {
    const res = await fetch(`${API_BASE}/api/jobs/${j.id}`)
    const json = await res.json()
    const job = json.job || {}
    const payload = job.payload_json ? JSON.parse(job.payload_json) : {}
    await fetch(`${API_BASE}/api/jobs/queue`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: job.type || j.type, payload }) })
  } catch { }
}

async function deleteJob(j) {
  try {
    await fetch(`${API_BASE}/api/jobs/${j.id}`, { method: 'DELETE' })
    setJobs(s => s.filter(x => x.id !== j.id))
  } catch { }
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
  return <Button onClick={toggle}>{open ? 'Tutup' : 'Detail'}</Button>
}

function RowDetailOmset({ cabangId, tanggal, openRows, setOpenRows, itemsMap, setItemsMap }) {
  const key = `${cabangId}-${tanggal}`
  const open = !!openRows[key]
  const [loading, setLoading] = React.useState(false)
  const toggle = async () => {
    if (!tanggal) return
    if (!open && !itemsMap[key]) {
      setLoading(true)
      const url = `${API_BASE}/api/omset/toko/day/items?cabang=${cabangId}&tanggal=${tanggal}`
      const res = await fetch(url)
      const json = await res.json()
      setItemsMap(m => ({ ...m, [key]: json.data || [] }))
      setLoading(false)
    }
    setOpenRows(m => ({ ...m, [key]: !open }))
  }
  return <Button onClick={toggle} disabled={loading}>{loading ? 'Memuat...' : (open ? 'Tutup' : 'Detail')}</Button>
}

function DetailRowOmset({ cabangId, keyRow, openRows, itemsMap }) {
  const open = !!openRows[keyRow]
  const items = itemsMap[keyRow] || []
  const loading = open && !itemsMap[keyRow]
  if (!open) return null
  return (
    <tr className="bg-slate-50">
      <td className="p-2" colSpan={8}>
        <table className="min-w-full text-xs">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-2 text-left">Produk</th>
              <th className="p-2 text-left">Jenis</th>
              <th className="p-2 text-right">Qty</th>
              <th className="p-2 text-right">Harga Unit</th>
              <th className="p-2 text-right">Harga Jual</th>
              <th className="p-2 text-right">Modal Unit</th>
              <th className="p-2 text-right">Modal Total</th>
              <th className="p-2 text-right">Laba Item</th>
              <th className="p-2 text-left">Tanggal</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableBodySkeleton rows={6} cols={9} />
            ) : items.map((it, idx) => (
              <tr key={`${keyRow}-${idx}`} className="border-t">
                <td className="p-2">{it.nama_produk || `${it.jenis_produk} #${it.id_produk}`}</td>
                <td className="p-2">{it.jenis_produk}</td>
                <td className="p-2 text-right">{it.jumlah}</td>
                <td className="p-2 text-right">{fmtCurrency(it.harga_produk)}</td>
                <td className="p-2 text-right">{fmtCurrency(it.jumlah_harga)}</td>
                <td className="p-2 text-right">{fmtCurrency(it.harga_modal)}</td>
                <td className="p-2 text-right">{fmtCurrency(it.jumlah_modal)}</td>
                <td className="p-2 text-right">{fmtCurrency(it.laba_item)}</td>
                <td className="p-2">{formatDate(it.tanggal_log)}</td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr><td className="p-2" colSpan={9}>Tidak ada item</td></tr>
            )}
          </tbody>
        </table>
      </td>
    </tr>
  )
}

function DetailRow({ kode, openRows, itemsMap }) {
  const open = !!openRows[kode]
  const items = itemsMap[kode] || []
  const loading = open && !itemsMap[kode]
  if (!open) return null
  return (
    <tr className="bg-slate-50">
      <td className="p-2" colSpan={13}>
        <table className="min-w-full text-xs">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-2 text-left">Produk</th>
              <th className="p-2 text-left">Jenis</th>
              <th className="p-2 text-right">Qty</th>
              <th className="p-2 text-right">Harga</th>
              <th className="p-2 text-right">Modal Unit</th>
              <th className="p-2 text-right">Jumlah</th>
              <th className="p-2 text-right">Modal Total</th>
              <th className="p-2 text-right">Laba Item</th>
              <th className="p-2 text-left">Tanggal</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableBodySkeleton rows={6} cols={9} />
            ) : items.map((it, idx) => (
              <tr key={`${kode}-${idx}`} className="border-t">
                <td className="p-2">{it.nama_produk || `${it.jenis_produk} #${it.id_produk}`}</td>
                <td className="p-2">{it.jenis_produk}</td>
                <td className="p-2 text-right">{it.jumlah}</td>
                <td className="p-2 text-right">{fmtCurrency(it.harga_produk)}</td>
                <td className="p-2 text-right">{fmtCurrency(it.harga_modal)}</td>
                <td className="p-2 text-right">{fmtCurrency((Number(it.harga_produk || 0)) * (Number(it.jumlah || 0)))}</td>
                <td className="p-2 text-right">{fmtCurrency(it.jumlah_modal)}</td>
                <td className="p-2 text-right">{fmtCurrency(((Number(it.harga_produk || 0)) * (Number(it.jumlah || 0))) - (Number(it.jumlah_modal || 0)))}</td>
                <td className="p-2">{formatDate(it.tanggal_log)}</td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr><td className="p-2" colSpan={9}>Tidak ada item</td></tr>
            )}
          </tbody>
        </table>
      </td>
    </tr>
  )
}
function RowDetailOmsetPeriod({ cabangId, pembukuanId, openRows, setOpenRows, itemsMap, setItemsMap }) {
  const key = `period-${cabangId}-${pembukuanId}`
  const open = !!openRows[key]
  const [loading, setLoading] = React.useState(false)
  const toggle = async () => {
    if (!pembukuanId) return
    if (!open && !itemsMap[key]) {
      setLoading(true)
      const url = `${API_BASE}/api/omset/toko/items?cabang=${cabangId}&pembukuan_id=${pembukuanId}`
      const res = await fetch(url)
      const json = await res.json()
      setItemsMap(m => ({ ...m, [key]: json.data || [] }))
      setLoading(false)
    }
    setOpenRows(m => ({ ...m, [key]: !open }))
  }
  return <Button onClick={toggle} disabled={loading || !pembukuanId}>{loading ? 'Memuat...' : (!pembukuanId ? 'Pilih pembukuan' : (open ? 'Tutup' : 'Detail'))}</Button>
}

function DetailRowOmsetPeriod({ keyRow, openRows, itemsMap }) {
  const open = !!openRows[keyRow]
  const items = itemsMap[keyRow] || []
  const loading = open && !itemsMap[keyRow]
  if (!open) return null
  return (
    <tr className="bg-slate-50">
      <td className="p-2" colSpan={13}>
        <table className="min-w-full text-xs">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-2 text-left">Transaksi</th>
              <th className="p-2 text-left">Customer</th>
              <th className="p-2 text-left">Produk</th>
              <th className="p-2 text-left">Jenis</th>
              <th className="p-2 text-right">Qty</th>
              <th className="p-2 text-right">Harga Unit</th>
              <th className="p-2 text-right">Harga Jual</th>
              <th className="p-2 text-right">Modal Unit</th>
              <th className="p-2 text-right">Modal Total</th>
              <th className="p-2 text-right">Laba Item</th>
              <th className="p-2 text-left">Tanggal</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableBodySkeleton rows={6} cols={13} />
            ) : items.map((it, idx) => (
              <tr key={`${keyRow}-${idx}`} className="border-t">
                <td className="p-2">{it.kode_transaksi || it.id_grosir}</td>
                <td className="p-2">{it.nama_customer || ''}</td>
                <td className="p-2">{it.nama_produk || `${it.jenis_produk} #${it.id_produk}`}</td>
                <td className="p-2">{it.jenis_produk}</td>
                <td className="p-2 text-right">{it.jumlah}</td>
                <td className="p-2 text-right">{fmtCurrency(it.harga_produk)}</td>
                <td className="p-2 text-right">{fmtCurrency(it.jumlah_harga)}</td>
                <td className="p-2 text-right">{fmtCurrency(it.harga_modal)}</td>
                <td className="p-2 text-right">{fmtCurrency(it.jumlah_modal)}</td>
                <td className="p-2 text-right">{fmtCurrency(it.laba_item)}</td>
                <td className="p-2">{formatDate(it.tanggal_log)}</td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr><td className="p-2" colSpan={11}>Tidak ada item</td></tr>
            )}
          </tbody>
        </table>
      </td>
    </tr>
  )
}

function MarketingOverdueView({ cabangOpts = [], marketingOpts = [] }) {
  const [cabang, setCabang] = React.useState('')
  const [marketing, setMarketing] = React.useState('')
  const [status, setStatus] = React.useState('')
  const [rows, setRows] = React.useState([])
  const [loading, setLoading] = React.useState(false)
  const [openRows, setOpenRows] = React.useState({})
  const [itemsMap, setItemsMap] = React.useState({})
  const [openCustomer, setOpenCustomer] = React.useState(false)
  const [openKode, setOpenKode] = React.useState('')
  const [customerProfile, setCustomerProfile] = React.useState(null)
  const [customerItems, setCustomerItems] = React.useState([])

  async function fetchOverdue() {
    setLoading(true)
    const params = new URLSearchParams()
    if (cabang) params.set('cabang', cabang)
    if (marketing) params.set('marketing', marketing)
    if (status) params.set('status', status)
    const url = `${API_BASE}/api/reports/marketing-overdue${params.toString() ? `?${params.toString()}` : ''}`
    const res = await fetch(url)
    const json = await res.json()
    setRows(json.data || [])
    setLoading(false)
  }

  async function openCustomerDetail(kode) {
    try {
      setOpenKode(kode)
      const [profRes, itemsRes] = await Promise.all([
        fetch(`${API_BASE}/api/reports/customer/profile/${kode}`),
        fetch(`${API_BASE}/api/reports/marketing/${kode}/items`)
      ])
      const profJson = await profRes.json()
      const itemsJson = await itemsRes.json()
      setCustomerProfile(profJson.data || null)
      setCustomerItems(itemsJson.data || [])
      setOpenCustomer(true)
    } catch (e) {
      setOpenCustomer(true)
    }
  }

  const totalMacet = React.useMemo(() => {
    return rows.reduce((a, r) => a + Number(r.total_macet || 0), 0)
  }, [rows])
  const totalBlacklist = React.useMemo(() => {
    return rows.reduce((a, r) => a + Number(r.total_blacklist || 0), 0)
  }, [rows])

  return (
    <div className="w-full p-3 md:p-0">
      <h1 className="text-lg md:text-2xl font-semibold mb-2">Tagihan Macet Marketing</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <select className="border rounded px-2 py-1.5 text-sm" value={cabang} onChange={e => setCabang(e.target.value)}>
          <option value="">Pilih cabang</option>
          {cabangOpts.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <Combobox
          options={marketingOpts}
          value={marketing}
          onChange={val => setMarketing(val)}
          placeholder="Pilih marketing"
          className="w-full text-sm"
        />
        <select className="border rounded px-2 py-1.5 text-sm" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Semua status</option>
          <option value="blacklist">Blacklist</option>
          <option value="nonblacklist">Tidak Blacklist</option>
        </select>
        <Button onClick={fetchOverdue} disabled={loading} className="text-sm h-9">{loading ? 'Memuat...' : 'Tampilkan'}</Button>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto border rounded bg-white">
        <table className="min-w-full w-full table-auto text-xs">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-2 py-1.5 text-left">Marketing</th>
              <th className="px-2 py-1.5 text-left">Cabang</th>
              <th className="px-2 py-1.5 text-right">≤1 bln</th>
              <th className="px-2 py-1.5 text-right">≤3 bln</th>
              <th className="px-2 py-1.5 text-right">≤6 bln</th>
              <th className="px-2 py-1.5 text-right">≤1 thn</th>
              <th className="px-2 py-1.5 text-right">&gt;1 thn</th>
              <th className="px-2 py-1.5 text-right">Total Macet</th>
              <th className="px-2 py-1.5 text-right">Total Blacklist</th>
              <th className="px-2 py-1.5 text-right">Cust Blacklist</th>
              <th className="px-2 py-1.5 text-left">Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <React.Fragment key={`${r.id_marketing}-${r.id_cabang}-${idx}`}>
                <tr className="border-t hover:bg-slate-50">
                  <td className="px-2 py-1.5">{r.nama_marketing || r.id_marketing}</td>
                  <td className="px-2 py-1.5">{r.nama_cabang || r.id_cabang}</td>
                  <td className="px-2 py-1.5 text-right">{fmtCurrency(r.tagihan_1_bulan)}</td>
                  <td className="px-2 py-1.5 text-right">{fmtCurrency(r.tagihan_3_bulan)}</td>
                  <td className="px-2 py-1.5 text-right">{fmtCurrency(r.tagihan_6_bulan)}</td>
                  <td className="px-2 py-1.5 text-right">{fmtCurrency(r.tagihan_1_tahun)}</td>
                  <td className="px-2 py-1.5 text-right">{fmtCurrency(r.tagihan_gt_1_tahun)}</td>
                  <td className="px-2 py-1.5 text-right font-semibold">{fmtCurrency(r.total_macet)}</td>
                  <td className="px-2 py-1.5 text-right">{fmtCurrency(r.total_blacklist)}</td>
                  <td className="px-2 py-1.5 text-right">{fmtCurrency(r.num_blacklist_customer)}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap"><MarketingOverdueDetailButton row={r} openRows={openRows} setOpenRows={setOpenRows} itemsMap={itemsMap} setItemsMap={setItemsMap} status={status} /></td>
                </tr>
                <MarketingOverdueDetailRow row={r} openRows={openRows} itemsMap={itemsMap} setItemsMap={setItemsMap} />
              </React.Fragment>
            ))}
            {rows.length === 0 && (
              <tr><td className="p-3 text-center text-slate-400 text-sm" colSpan={11}>Tidak ada data</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-2">
        {rows.map((r, idx) => (
          <div key={`${r.id_marketing}-${r.id_cabang}-${idx}`} className="bg-white border rounded-lg p-3">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="font-semibold text-sm text-slate-800">{r.nama_marketing || r.id_marketing}</div>
                <div className="text-xs text-slate-500">{r.nama_cabang || r.id_cabang}</div>
              </div>
              <MarketingOverdueDetailButton row={r} openRows={openRows} setOpenRows={setOpenRows} itemsMap={itemsMap} setItemsMap={setItemsMap} status={status} />
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mt-2 pt-2 border-t">
              <div className="flex justify-between">
                <span className="text-slate-500">≤1 bln:</span>
                <span className="font-medium">{fmtCurrency(r.tagihan_1_bulan)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">≤3 bln:</span>
                <span className="font-medium">{fmtCurrency(r.tagihan_3_bulan)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">≤6 bln:</span>
                <span className="font-medium">{fmtCurrency(r.tagihan_6_bulan)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">≤1 thn:</span>
                <span className="font-medium">{fmtCurrency(r.tagihan_1_tahun)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">&gt;1 thn:</span>
                <span className="font-medium">{fmtCurrency(r.tagihan_gt_1_tahun)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Blacklist:</span>
                <span className="font-medium">{fmtCurrency(r.num_blacklist_customer)}</span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t flex justify-between items-center">
              <div className="text-xs">
                <span className="text-slate-500">Total Macet:</span>
                <span className="font-bold text-red-600 ml-1">{fmtCurrency(r.total_macet)}</span>
              </div>
              <div className="text-xs">
                <span className="text-slate-500">Total Blacklist:</span>
                <span className="font-semibold ml-1">{fmtCurrency(r.total_blacklist)}</span>
              </div>
            </div>
            <MarketingOverdueDetailRow row={r} openRows={openRows} itemsMap={itemsMap} setItemsMap={setItemsMap} />
          </div>
        ))}
        {rows.length === 0 && (
          <div className="bg-white border rounded-lg p-6 text-center text-slate-400 text-sm">Tidak ada data</div>
        )}
      </div>

      <div className="mt-3 p-2.5 md:p-3 border rounded bg-slate-50 text-xs md:text-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0">
          <div>Total Macet: <b>{fmtCurrency(totalMacet)}</b></div>
          <span className="hidden sm:inline mx-2">|</span>
          <div>Total Blacklist: <b>{fmtCurrency(totalBlacklist)}</b></div>
          <span className="hidden sm:inline mx-2">|</span>
          <div>Jumlah Cust Blacklist: <b>{fmtCurrency(rows.reduce((a, r) => a + Number(r.num_blacklist_customer || 0), 0))}</b></div>
        </div>
      </div>

    </div>
  )
}

function MarketingOverdueDetailButton({ row, openRows, setOpenRows, itemsMap, setItemsMap, status }) {
  const key = `${row.id_marketing}-${row.id_cabang}`
  const open = !!openRows[key]
  const [loading, setLoading] = React.useState(false)
  async function toggle() {
    if (!open) {
      setLoading(true)
      const params = new URLSearchParams()
      if (row.id_cabang) params.set('cabang', row.id_cabang)
      if (row.id_marketing) params.set('marketing', row.id_marketing)
      if (status) params.set('status', status)
      const url = `${API_BASE}/api/reports/marketing-overdue/transactions${params.toString() ? `?${params.toString()}` : ''}`
      const res = await fetch(url)
      const json = await res.json()
      setItemsMap(m => ({ ...m, [key]: json.data || [] }))
      setLoading(false)
    }
    setOpenRows(m => ({ ...m, [key]: !open }))
  }
  return <Button onClick={toggle} disabled={loading}>{loading ? 'Memuat...' : (open ? 'Tutup' : 'Detail')}</Button>
}

function MarketingOverdueDetailRow({ row, openRows, itemsMap, setItemsMap }) {
  const key = `${row.id_marketing}-${row.id_cabang}`
  const open = !!openRows[key]
  const items = itemsMap[key] || []
  const loading = open && !itemsMap[key]
  if (!open) return null
  const [confirm, setConfirm] = React.useState({ open: false, kode: '', status: '' })
  const sumFix = React.useMemo(() => items.reduce((a, it) => a + Number(it.fix_harga || 0), 0), [items])
  const sumBayar = React.useMemo(() => items.reduce((a, it) => a + Number(it.jml_bayar || 0), 0), [items])
  const sumSisa = React.useMemo(() => items.reduce((a, it) => a + Number(it.sisa_bayar || 0), 0), [items])
  const sumUmur = React.useMemo(() => items.reduce((a, it) => a + Number(it.umur_bulan || 0), 0), [items])
  const printRef = React.useRef(null)
  function exportDetail() {
    const rows = []
    const push = (arr) => { for (const a of arr) rows.push(a.join(',')) }
    push([[
      'No', 'Tanggal', 'Kode', 'Customer', 'Fix Harga', 'Bayar', 'Sisa', 'Terakhir Bayar', 'Ket', 'Umur (bln)'
    ]])
    items.forEach((it, idx) => {
      push([[
        String(idx + 1),
        formatDate(it.tanggal_order),
        String(it.kode_transaksi || ''),
        String(it.nama_customer || ''),
        String(it.fix_harga || 0),
        String(it.jml_bayar || 0),
        String(it.sisa_bayar || 0),
        formatDate(it.last_bayar),
        String(it.last_jenis_transaksi || ''),
        String(it.umur_bulan || 0)
      ]])
    })
    const csv = rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const mk = row.nama_marketing || row.id_marketing
    const cb = row.nama_cabang || row.id_cabang
    a.download = `marketing_overdue_detail_${mk}_${cb}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
  function printDetail() {
    try {
      const content = printRef.current ? printRef.current.innerHTML : ''
      const mk = row.nama_marketing || row.id_marketing
      const cb = row.nama_cabang || row.id_cabang
      const w = window.open('', '_blank')
      const styles = `
        <style>
          *{font-family: Arial, Helvetica, sans-serif;}
          table{width:100%; border-collapse:collapse;}
          th,td{border:1px solid #ccc; padding:6px; font-size:12px}
          thead{background:#f1f5f9}
          .title{font-size:16px; font-weight:600; margin-bottom:8px}
          .subtitle{font-size:12px; margin-bottom:12px}
          .print-hidden{display:none !important}
        </style>
      `
      w.document.write(`<!doctype html><html><head><meta charset="utf-8">${styles}</head><body>`)
      w.document.write(`<div class="title">Tagihan Macet Marketing</div>`)
      w.document.write(`<div class="subtitle">Marketing: ${mk} • Cabang: ${cb}</div>`)
      w.document.write(content)
      w.document.write(`</body></html>`)
      w.document.close()
      w.focus()
      w.print()
      w.close()
    } catch (e) { console.error(e) }
  }
  async function toggleBlacklist(kodeCustomer, curr, reason) {
    const status = String(curr || '').toLowerCase() === 'blacklist' ? '' : 'blacklist'
    try {
      const body = { status }
      if (status === 'blacklist') {
        body.reason = reason
      }
      const res = await fetch(`${API_BASE}/api/reports/customer/${kodeCustomer}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const json = await res.json()
      const newStatus = json?.status || null
      const newReason = json?.reason || null
      setItemsMap(m => {
        const arr = m[key] || []
        const upd = arr.map(it => it.kode_customer === kodeCustomer ? { ...it, status_user: newStatus, blacklist_reason: newReason } : it)
        return { ...m, [key]: upd }
      })
    } catch (e) { console.error(e) }
  }
  return (
    <tr className="bg-slate-50">
      <td className="p-1 md:p-2" colSpan={10}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
          <div className="text-xs text-slate-600">
            {items.length} transaksi macet
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 px-2 text-xs" onClick={printDetail}>Cetak PDF</Button>
            <Button size="sm" className="h-7 px-2 text-xs" onClick={exportDetail}>Export CSV</Button>
          </div>
        </div>
        <div className="overflow-x-auto w-full" ref={printRef}>
          <table className="min-w-full w-full text-xs">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-1 py-1 md:px-2 md:py-1.5 text-left">No</th>
                <th className="px-1 py-1 md:px-2 md:py-1.5 text-left">Tanggal</th>
                <th className="px-1 py-1 md:px-2 md:py-1.5 text-left">Kode</th>
                <th className="px-1 py-1 md:px-2 md:py-1.5 text-left">Customer</th>
                <th className="px-1 py-1 md:px-2 md:py-1.5 text-right">Fix Harga</th>
                <th className="px-1 py-1 md:px-2 md:py-1.5 text-right">Bayar</th>
                <th className="px-1 py-1 md:px-2 md:py-1.5 text-right">Sisa</th>
                <th className="px-1 py-1 md:px-2 md:py-1.5 text-left hidden md:table-cell">Terakhir Bayar</th>
                <th className="px-1 py-1 md:px-2 md:py-1.5 text-left hidden md:table-cell">Ket</th>
                <th className="px-1 py-1 md:px-2 md:py-1.5 text-left print-hidden">Aksi</th>
                <th className="px-1 py-1 md:px-2 md:py-1.5 text-right hidden md:table-cell">Umur (bln)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableBodySkeleton rows={8} cols={11} />
              ) : items.map((it, idx) => {
                const isBlack = String(it.status_user || '').toLowerCase() === 'blacklist'
                return (
                  <tr key={`${key}-${idx}`} className={`border-t ${isBlack ? 'bg-red-50' : ''}`}>
                    <td className="px-1 py-1 md:px-2 md:py-1.5">{idx + 1}</td>
                    <td className="px-1 py-1 md:px-2 md:py-1.5 whitespace-nowrap">{formatDate(it.tanggal_order)}</td>
                    <td className="px-1 py-1 md:px-2 md:py-1.5"><MarketingTransactionDetailTrigger kodeTransaksi={it.kode_transaksi}>{it.kode_transaksi}</MarketingTransactionDetailTrigger></td>
                    <td className="px-1 py-1 md:px-2 md:py-1.5">
                      <CustomerDetailTrigger name={it.nama_customer} kodeTransaksi={it.kode_transaksi} status={it.status_user}>
                        <div className="flex flex-col">
                          <span className="font-medium text-primary underline truncate max-w-[150px]">{it.nama_customer || it.kode_customer}</span>
                          {it.blacklist_reason && (
                            <span className="text-[10px] text-red-600 italic font-medium">"{it.blacklist_reason}"</span>
                          )}
                        </div>
                      </CustomerDetailTrigger>
                    </td>
                    <td className="px-1 py-1 md:px-2 md:py-1.5 text-right whitespace-nowrap">{fmtCurrency(it.fix_harga)}</td>
                    <td className="px-1 py-1 md:px-2 md:py-1.5 text-right whitespace-nowrap">{fmtCurrency(it.jml_bayar)}</td>
                    <td className="px-1 py-1 md:px-2 md:py-1.5 text-right whitespace-nowrap">{fmtCurrency(it.sisa_bayar)}</td>
                    <td className="px-1 py-1 md:px-2 md:py-1.5 hidden md:table-cell whitespace-nowrap">{formatDate(it.last_bayar)}</td>
                    <td className="px-1 py-1 md:px-2 md:py-1.5 hidden md:table-cell">{it.last_jenis_transaksi || ''}</td>
                    <td className="px-1 py-1 md:px-2 md:py-1.5 print-hidden"><Button size="sm" className={`h-6 px-1.5 text-xs ${isBlack ? 'bg-black text-white hover:bg-black/80' : ''}`} onClick={() => { if (isBlack) { toggleBlacklist(it.kode_customer, it.status_user) } else { setConfirm({ open: true, kode: it.kode_customer, status: it.status_user }) } }}>{isBlack ? 'Unblock' : 'Blacklist'}</Button></td>
                    <td className="px-1 py-1 md:px-2 md:py-1.5 text-right hidden md:table-cell">{fmtCurrency(it.umur_bulan)}</td>
                  </tr>
                )
              })}
              {!loading && items.length === 0 && (
                <tr><td className="p-3 text-center text-slate-400" colSpan={11}>Tidak ada transaksi macet</td></tr>
              )}
            </tbody>
            <tfoot className="bg-slate-100">
              <tr>
                <td className="px-1 py-1 md:px-2 md:py-1.5 font-semibold" colSpan={4}>Total</td>
                <td className="px-1 py-1 md:px-2 md:py-1.5 text-right font-semibold whitespace-nowrap">{fmtCurrency(sumFix)}</td>
                <td className="px-1 py-1 md:px-2 md:py-1.5 text-right font-semibold whitespace-nowrap">{fmtCurrency(sumBayar)}</td>
                <td className="px-1 py-1 md:px-2 md:py-1.5 text-right font-semibold whitespace-nowrap">{fmtCurrency(sumSisa)}</td>
                <td className="px-1 py-1 md:px-2 md:py-1.5 hidden md:table-cell"></td>
                <td className="px-1 py-1 md:px-2 md:py-1.5 hidden md:table-cell"></td>
                <td className="px-1 py-1 md:px-2 md:py-1.5"></td>
                <td className="px-1 py-1 md:px-2 md:py-1.5 text-right font-semibold hidden md:table-cell">{fmtCurrency(sumUmur)}</td>
              </tr>
            </tfoot>
          </table>
          {confirm.open && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/50" onClick={() => setConfirm({ open: false, kode: '', status: '' })}></div>
              <div className="relative bg-white rounded-md shadow-lg w-[360px] max-w-[90%]">
                <div className="px-4 py-3 border-b">
                  <div className="font-semibold text-sm">Konfirmasi Blacklist</div>
                  <div className="text-[10px] text-slate-500">Pilih alasan kenapa customer {confirm.kode} diblacklist:</div>
                </div>
                <div className="p-4 space-y-3">
                  <select
                    className="w-full border rounded p-2 text-xs"
                    id="bl-reason-select"
                    onChange={e => {
                      const val = e.target.value;
                      const input = document.getElementById('bl-custom-reason');
                      if (val === 'Lainnya') {
                        if (input) input.style.display = 'block';
                      } else {
                        if (input) input.style.display = 'none';
                      }
                    }}
                  >
                    <option value="">-- Pilih Alasan --</option>
                    <option value="Kredit Macet">Kredit Macet</option>
                    <option value="Perilaku Tidak Baik">Perilaku Tidak Baik</option>
                    <option value="Data Tidak Valid">Data Tidak Valid</option>
                    <option value="Lainnya">Lainnya (Custom)</option>
                  </select>
                  <input
                    type="text"
                    id="bl-custom-reason"
                    className="w-full border rounded p-2 text-xs"
                    placeholder="Ketik alasan custom..."
                    style={{ display: 'none' }}
                  />
                </div>
                <div className="px-4 py-3 border-t flex gap-2 justify-end">
                  <Button variant="secondary" size="sm" onClick={() => setConfirm({ open: false, kode: '', status: '' })}>Batal</Button>
                  <Button size="sm" onClick={() => {
                    const k = confirm.kode;
                    const sel = document.getElementById('bl-reason-select');
                    const customInput = document.getElementById('bl-custom-reason');
                    let r = sel?.value;
                    if (r === 'Lainnya') r = customInput?.value;
                    if (!r) { alert('Pilih alasan dulu'); return; }
                    setConfirm({ open: false, kode: '', status: '' });
                    toggleBlacklist(k, confirm.status, r)
                  }}>Simpan Blacklist</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}
