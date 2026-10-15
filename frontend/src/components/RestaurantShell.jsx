import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import {
  ApartmentOutlined, BellOutlined, CalendarOutlined, CheckSquareOutlined,
  DashboardOutlined, DollarOutlined, FileTextOutlined, FireOutlined,
  LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined, ReadOutlined,
  SafetyOutlined, SettingOutlined, ShoppingCartOutlined, TableOutlined,
  TeamOutlined, UnorderedListOutlined, UserOutlined,
} from '@ant-design/icons'
import { Button, Tooltip } from 'antd'
import './RestaurantShell.css'
import {
  checkWorkspaceAccess,
  getHealth,
  logout,
  SESSION_ENDING_EVENT,
} from '../services/api'
import Employees from '../pages/Employees'
import Forbidden from '../pages/Forbidden'
import KhuVuc from '../pages/KhuVuc'
import Ban from '../pages/Ban'
import AuditLogs from '../pages/AuditLogs'
import Menu from '../pages/Menu'
import OpeningHoursSettings from '../pages/OpeningHoursSettings'
import BookingDemo from '../pages/BookingDemo'
import TodayBookings from '../pages/TodayBookings'
import RoleWorkspace from '../pages/RoleWorkspace'
import DailyMenu from '../pages/DailyMenu'
import OrderEntry from '../pages/OrderEntry'
import ServiceOrders from '../pages/ServiceOrders'
import Kitchen from '../pages/Kitchen'
import Reports from '../pages/Reports'
import Billing from '../pages/Billing'
import ShiftClose from '../pages/ShiftClose'
import RevenueReport from '../pages/RevenueReport'
import Overview from '../pages/Overview'

const AssistantWidget = lazy(() => import('./AssistantWidget'))

const ROLE_LABELS = { QUAN_LY: 'Quản lý', PHUC_VU: 'Phục vụ', BEP: 'Bếp', THU_NGAN: 'Thu ngân' }

const ROLE_NAVIGATION = {
  QUAN_LY: [
    { key: 'dashboard', label: 'Tổng quan', icon: DashboardOutlined },
    { key: 'bookings', label: 'Đặt bàn', icon: CalendarOutlined },
    { key: 'menu-management', label: 'Thực đơn', icon: UnorderedListOutlined },
    { key: 'daily-menu', label: 'Món trong ngày', icon: FireOutlined },
    { key: 'service-orders', label: 'Theo dõi món', icon: BellOutlined },
    { key: 'employees', label: 'Nhân viên', icon: TeamOutlined },
    { key: 'areas', label: 'Khu vực', icon: ApartmentOutlined },
    { key: 'tables', label: 'Quản lý bàn', icon: TableOutlined },
    { key: 'reports', label: 'Báo cáo món ăn', icon: FileTextOutlined },
    { key: 'revenue-report', label: 'Báo cáo doanh thu', icon: DollarOutlined },
    { key: 'checkout', label: 'Thanh toán', icon: DollarOutlined },
    { key: 'invoices', label: 'Hóa đơn', icon: FileTextOutlined },
    { key: 'audit', label: 'Nhật ký hệ thống', icon: SafetyOutlined },
    { key: 'opening-hours', label: 'Giờ mở cửa', icon: SettingOutlined },
  ],
  PHUC_VU: [
    { key: 'table-map', label: 'Sơ đồ bàn', icon: TableOutlined },
    { key: 'bookings', label: 'Danh sách đặt bàn', icon: CalendarOutlined },
    { key: 'order-entry', label: 'Gọi món', icon: ShoppingCartOutlined },
    { key: 'service-orders', label: 'Theo dõi món', icon: BellOutlined },
  ],
  BEP: [
    { key: 'kitchen', label: 'Màn hình bếp', icon: FireOutlined },
    { key: 'daily-menu', label: 'Món trong ngày', icon: ReadOutlined },
  ],
  THU_NGAN: [
    { key: 'checkout', label: 'Thanh toán', icon: DollarOutlined },
    { key: 'invoices', label: 'Hóa đơn', icon: FileTextOutlined },
    { key: 'shift-close', label: 'Chốt ca', icon: CheckSquareOutlined },
  ],
}

const NAVIGATION_GROUPS = [
  {
    title: 'ĐIỀU HÀNH',
    keys: ['dashboard', 'bookings', 'tables', 'table-map', 'order-entry', 'service-orders', 'kitchen'],
  },
  {
    title: 'DANH MỤC',
    keys: ['menu-management', 'daily-menu', 'areas'],
  },
  {
    title: 'TÀI CHÍNH',
    keys: ['checkout', 'invoices', 'shift-close'],
  },
  {
    title: 'BÁO CÁO',
    keys: ['reports', 'revenue-report'],
  },
  {
    title: 'HỆ THỐNG',
    keys: ['employees', 'opening-hours', 'audit'],
  },
]

const PATH_TO_PAGE = {
  '/': null, '/dashboard': 'dashboard', '/bookings': 'bookings', '/customers': 'customers',
  '/menu-management': 'menu-management', '/orders': 'orders', '/employees': 'employees',
  '/areas': 'areas', '/tables': 'tables', '/reports': 'reports',
  '/revenue-report': 'revenue-report', '/audit': 'audit',
  '/opening-hours': 'opening-hours', '/table-map': 'table-map', '/order-entry': 'order-entry',
  '/kitchen': 'kitchen', '/service-orders': 'service-orders', '/daily-menu': 'daily-menu', '/checkout': 'checkout',
  '/invoices': 'invoices', '/shift-close': 'shift-close',
}

function pageFromPath() { return PATH_TO_PAGE[window.location.pathname] || null }
function apiErrorMessage(error) {
  const detail = error?.response?.data?.detail
  return typeof detail === 'string' ? detail : detail?.message || 'Bạn không có quyền truy cập chức năng này.'
}

export default function RestaurantShell({ user, onLogout }) {
  const role = user?.role || 'PHUC_VU'
  const navigation = useMemo(() => ROLE_NAVIGATION[role] || [], [role])
  const navigationGroups = useMemo(() => NAVIGATION_GROUPS.map(({ title, keys }) => ({
    title,
    items: keys.map((key) => navigation.find((item) => item.key === key)).filter(Boolean),
  })).filter((group) => group.items.length > 0), [navigation])
  const firstAllowedPage = navigation[0]?.key || 'dashboard'
  const initialPathPage = pageFromPath()
  const [page, setPage] = useState(initialPathPage || firstAllowedPage)
  const [focusedBookingId, setFocusedBookingId] = useState(
    () => new URLSearchParams(window.location.search).get('bookingId')
  )
  const [collapsed, setCollapsed] = useState(false)
  const [health, setHealth] = useState('checking')
  const [accessState, setAccessState] = useState({
    page: null,
    loading: true,
    allowed: false,
    message: '',
  })

  useEffect(() => {
    if (!initialPathPage) {
      window.history.replaceState({}, '', `/${firstAllowedPage}`)
    }
  }, [firstAllowedPage, initialPathPage])

  useEffect(() => {
    const onPopState = () => {
      setPage(pageFromPath() || firstAllowedPage)
      setFocusedBookingId(
        new URLSearchParams(window.location.search).get('bookingId')
      )
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [firstAllowedPage])

  useEffect(() => {
    function openBooking(event) {
      const bookingId = event.detail?.bookingId
      if (bookingId == null) return

      setFocusedBookingId(String(bookingId))
      window.history.pushState(
        {},
        '',
        `/bookings?bookingId=${encodeURIComponent(bookingId)}`
      )
      setPage('bookings')
    }

    window.addEventListener('restaurant:open-booking', openBooking)
    return () =>
      window.removeEventListener('restaurant:open-booking', openBooking)
  }, [])

  useEffect(() => {
    let mounted = true
    checkWorkspaceAccess(page)
      .then(() => mounted && setAccessState({
        page,
        loading: false,
        allowed: true,
        message: '',
      }))
      .catch((error) => mounted && setAccessState({
        page,
        loading: false,
        allowed: false,
        message: apiErrorMessage(error),
      }))
    return () => { mounted = false }
  }, [page, user?.id])

  useEffect(() => {
    let mounted = true
    getHealth().then(() => mounted && setHealth('online')).catch(() => mounted && setHealth('offline'))
    return () => { mounted = false }
  }, [])

  function goTo(nextPage) {
    window.history.pushState({}, '', `/${nextPage}`)
    setFocusedBookingId(null)
    setPage(nextPage)
  }

  async function signout() {
    const logoutRequest = logout()
    window.dispatchEvent(new Event(SESSION_ENDING_EVENT))
    onLogout()
    await logoutRequest.catch(() => false)
  }

  const label = navigation.find((item) => item.key === page)?.label || 'Không có quyền truy cập'

  return (
    <div className={`app-shell ${collapsed ? 'app-shell--sidebar-collapsed' : ''}`}>
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="brand"><div className="brand-mark">R</div>{!collapsed && <div><strong>Resto</strong><span>Management</span></div>}</div>
        <nav className="nav-section" aria-label="Chức năng">
          {navigationGroups.map(({ title, items }) => (
            <section key={title} className="nav-group" aria-label={title}>
              {!collapsed && <h2 className="nav-title">{title}</h2>}
              {items.map(({ key, label: text, icon: Icon }) => (
                <button key={key} data-assistant-nav={key} className={`nav-item ${page === key ? 'active' : ''}`} onClick={() => goTo(key)} title={collapsed ? text : undefined}>
                  <Icon />{!collapsed && <span>{text}</span>}
                </button>
              ))}
            </section>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item logout-nav" onClick={signout}><LogoutOutlined />{!collapsed && <span>Đăng xuất</span>}</button>
        </div>
        <div className="user-card"><div className="avatar"><UserOutlined /></div>{!collapsed && <div className="user-copy"><strong>{user?.full_name || 'Nhân viên'}</strong><span>{ROLE_LABELS[role] || role}</span></div>}</div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <Button type="text" className="collapse-button" icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => setCollapsed((v) => !v)} />
          <div className="breadcrumb"><span>Nhà hàng</span><b>/</b><strong>{label}</strong></div>
          <div className="topbar-actions">
            <div className="connection-status"><span className={`status-dot ${health === 'online' ? 'success' : health === 'offline' ? 'danger' : 'warning'}`} /><span>API {health === 'online' ? 'Online' : health === 'offline' ? 'Offline' : 'Đang kiểm tra'}</span></div>
            <Tooltip title="Thông báo"><Button type="text" icon={<BellOutlined />} /></Tooltip>
            <div className="top-avatar">{(user?.full_name || 'A').slice(0, 1).toUpperCase()}</div>
          </div>
        </header>

        <div
          data-assistant-page={page}
          data-assistant-ready={accessState.page === page && accessState.allowed && !accessState.loading ? 'true' : 'false'}
          className={`page-content ${
            page === 'tables' || page === 'table-map'
              ? 'page-content--table-map'
              : ''
          }`}
          style={{ flex: 1, width: '100%', boxSizing: 'border-box' }}
        >
          {accessState.loading || accessState.page !== page ? (
            <div className="role-access-loading">Đang kiểm tra quyền truy cập...</div>
          ) : !accessState.allowed ? (
            <Forbidden message={accessState.message} />
          ) : page === 'dashboard' ? (
            <Overview onNavigate={goTo} />
          ) : page === 'employees' ? (
            <Employees />
          ) : page === 'areas' ? (
            <KhuVuc />
          ) : page === 'tables' || page === 'table-map' ? (
            <Ban user={user} />
          ) : page === 'menu-management' ? (
            <Menu />
          ) : page === 'daily-menu' ? (
            <DailyMenu />
          ) : page === 'audit' ? (
            <AuditLogs />
          ) : page === 'opening-hours' ? (
            <OpeningHoursSettings />
          ) : page === 'bookings' ? (
            role === 'PHUC_VU' ? <TodayBookings /> : <BookingDemo focusedBookingId={focusedBookingId} />
          ) : page === 'order-entry' ? (
            <OrderEntry />
          ) : page === 'service-orders' ? (
            <ServiceOrders user={user} />
          ) : page === 'reports' ? (
            <Reports />
          ) : page === 'kitchen' ? (
            <Kitchen />
          ) : page === 'revenue-report' ? (
            <RevenueReport />
          ) : page === 'shift-close' ? (
            <ShiftClose user={user} />
          ) : page === 'checkout' || page === 'invoices' ? (
            <Billing user={user} initialMode={page === 'invoices' ? 'invoices' : 'checkout'} />
          ) : (
            <RoleWorkspace resource={page} />
          )}
        </div>
      </main>
      <Suspense fallback={null}>
        <AssistantWidget key={`${user?.id}-${role}`} page={page} navigation={navigation}
          ready={accessState.page === page && accessState.allowed && !accessState.loading} onNavigate={goTo} />
      </Suspense>
    </div>
  )
}
