import React from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import {
  Wallet,
  BarChart3,
  Calendar,
  Eye,
  DollarSign,
  Search,
  Users,
  Ticket,
  TrendingUp,
  LayoutDashboard,
  Store,
  Database,
  PieChart,
  ClipboardList,
  Check
} from 'lucide-react'

export default function AppSidebar() {
  const [openMaster, setOpenMaster] = React.useState(false)

  const marketingItems = [
    { title: 'Rekap Marketing', url: '#/marketing', icon: Wallet },
    { title: 'Tagihan Macet', url: '#/marketing-overdue', icon: ClipboardList },
    { title: 'DP Rendah (<20%)', url: '#/low-dp', icon: DollarSign },
    { title: 'Pembayaran Kolektor', url: '#/collector-payments', icon: Users },
    { title: 'Manajemen Kolektor', url: '#/collector-management', icon: Users },
    { title: 'Items Transaksi', url: '#/items-transaksi', icon: LayoutDashboard },
  ]

  const tokoItems = [
    { title: 'Rekap Toko', url: '#/toko', icon: Store },
    { title: 'Omset (Periode)', url: '#/omset', icon: Calendar },
    { title: 'Omset (Harian)', url: '#/omset-harian', icon: Calendar },
  ]

  const analysisItems = [
    { title: 'Analisis Cabang', url: '#/analysis-cabang', icon: TrendingUp },
    { title: 'Analisis Marketing', url: '#/analysis-marketing', icon: PieChart },
    { title: 'Laba Rugi', url: '#/laba-rugi', icon: BarChart3 },
    { title: 'Laporan Aset', url: '#/aset', icon: Eye },
  ]

  const voucherCustomerItems = [
    { title: 'Approval Voucher', url: '#/voucher-approval', icon: Check },
    { title: 'Pembayaran Voucher', url: '#/marketing-voucher', icon: Ticket },
    { title: 'Persetujuan Sponsor', url: '#/sponsor-approval', icon: Check },
    { title: 'Data Sponsor', url: '#/sponsors', icon: Users },
    { title: 'Customer List', url: '#/customers', icon: Users },
    { title: 'Poin Customer', url: '#/best-customers', icon: TrendingUp },
    { title: 'Riwayat Poin', url: '#/point-usage', icon: ClipboardList },
  ]

  const masterLinks = [
    { title: 'Katalog', url: '#/master-katalog' },
    { title: 'Frame', url: '#/master-frame' },
    { title: 'Softlens', url: '#/master-softlens' },
    { title: 'Lensa', url: '#/master-lensa' },
  ]

  const MenuSection = ({ label, items }) => (
    <SidebarGroup>
      <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild>
                <a href={item.url} className="px-3 py-1.5 rounded-md hover:bg-slate-100 flex items-center gap-3 transition-colors">
                  <item.icon size={16} className="text-slate-600" />
                  <span className="text-sm text-slate-700 font-medium">{item.title}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b">
        <div className="flex items-center gap-2 font-bold text-lg text-primary">
          <div className="bg-primary text-white p-1 rounded">OL</div>
          <span>Optik Livina</span>
        </div>
      </SidebarHeader>

      <SidebarContent className="py-2">
        {/* Utilitas Utama */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="#/transaction-search" className="m-2 px-3 py-2 bg-slate-100 rounded-lg flex items-center gap-3 hover:bg-slate-200 transition-colors border border-slate-200">
                    <Search size={18} className="text-primary" />
                    <span className="font-semibold text-slate-800">Cari Transaksi</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <MenuSection label="Marketing" items={marketingItems} />
        <MenuSection label="Toko & Penjualan" items={tokoItems} />
        <MenuSection label="Analisis & Profit" items={analysisItems} />
        <MenuSection label="Voucher & Customer" items={voucherCustomerItems} />

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Master Data</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <button
                    type="button"
                    onClick={() => setOpenMaster(o => !o)}
                    className="w-full text-left px-3 py-1.5 rounded-md hover:bg-slate-100 flex items-center gap-3 transition-colors"
                  >
                    <Database size={16} className="text-slate-600" />
                    <span className="text-sm text-slate-700 font-medium">Data Master</span>
                    <span className="ml-auto text-[10px] text-slate-400">{openMaster ? '▲' : '▼'}</span>
                  </button>
                </SidebarMenuButton>
                {openMaster && (
                  <div className="mt-1 ml-4 pl-5 border-l border-slate-200 space-y-1 py-1">
                    {masterLinks.map(link => (
                      <a
                        key={link.url}
                        href={link.url}
                        className="block px-3 py-1 text-sm text-slate-600 hover:text-primary hover:bg-slate-50 rounded-md transition-all"
                      >
                        {link.title}
                      </a>
                    ))}
                  </div>
                )}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-400 italic">v2.1 - Voucher Integrated</span>
          <SidebarTrigger />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}