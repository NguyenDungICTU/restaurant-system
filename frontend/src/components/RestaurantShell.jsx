import { useEffect, useMemo, useState } from 'react'
import {
  ApartmentOutlined, BellOutlined, CalendarOutlined, CheckSquareOutlined,
  DashboardOutlined, DollarOutlined, FileTextOutlined, FireOutlined,
  LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined, ReadOutlined,
  SafetyOutlined, SettingOutlined, ShoppingCartOutlined, TableOutlined,
  TeamOutlined, UnorderedListOutlined, UserOutlined,
} from '@ant-design/icons'
import { Button, Tooltip } from 'antd'
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

const ROLE_LABELS = { QUAN_LY: 'Quản lý', PHUC_VU: 'Phục vụ', BEP: 'Bếp', THU_NGAN: 'Thu ngân' }

const ROLE_NAVIGATION = {
  QUAN_LY: [
    { key: 'dashboard', label: 'Tổng quan', icon: DashboardOutlined },
    { key: 'bookings', label: 'Đặt bàn', icon: CalendarOutlined },
    { key: 'customers', label: 'Khách hàng', icon: TeamOutlined },
    { key: 'menu-management', label: 'Thực đơn', icon: UnorderedListOutlined },
    { key: 'daily-menu', label: 'Món trong ngày', icon: FireOutlined },
    { key: 'orders', label: 'Đơn hàng', icon: ShoppingCartOutlined },
    { key: 'service-orders', label: 'Theo dõi món', icon: BellOutlined },
    { key: 'employees', label: 'Nhân viên', icon: TeamOutlined },
    { key: 'areas', label: 'Khu vực', icon: ApartmentOutlined },
    { key: 'tables', label: 'Quản lý bàn', icon: TableOutlined },
    { key: 'reports', label: 'Báo cáo', icon: FileTextOutlined },
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

const PATH_TO_PAGE = {
  '/': null, '/dashboard': 'dashboard', '/bookings': 'bookings', '/customers': 'customers',
  '/menu-management': 'menu-management', '/orders': 'orders', '/employees': 'employees',
  '/areas': 'areas', '/tables': 'tables', '/reports': 'reports', '/audit': 'audit',
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
    <div className="app-shell" style={{ display: 'flex', width: '100vw', minHeight: '100vh', overflowX: 'hidden' }}>
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="brand"><div className="brand-mark">R</div>{!collapsed && <div><strong>Resto</strong><span>Management</span></div>}</div>
        <div className="nav-section">
          {!collapsed && <p className="nav-title">CÔNG VIỆC</p>}
          {navigation.map(({ key, label: text, icon: Icon }) => (
            <button key={key} className={`nav-item ${page === key ? 'active' : ''}`} onClick={() => goTo(key)} title={collapsed ? text : undefined}>
              <Icon />{!collapsed && <span>{text}</span>}
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <button className="nav-item logout-nav" onClick={signout}><LogoutOutlined />{!collapsed && <span>Đăng xuất</span>}</button>
        </div>
        <div className="user-card"><div className="avatar"><UserOutlined /></div>{!collapsed && <div className="user-copy"><strong>{user?.full_name || 'Nhân viên'}</strong><span>{ROLE_LABELS[role] || role}</span></div>}</div>
      </aside>

      <main className="main-content" style={{ flex: 1, minWidth: 0, maxWidth: '100%', overflowX: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
            <RoleWorkspace resource="dashboard" />
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
            <ServiceOrders />
          ) : page === 'kitchen' ? (
            <Kitchen />
          ) : (
            <RoleWorkspace resource={page} />
          )}
        </div>
      </main>
    </div>
  )
}