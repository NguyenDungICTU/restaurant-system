import { useEffect, useMemo, useState } from 'react'
import {
  ApartmentOutlined,
  BellOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  DashboardOutlined,
  DollarOutlined,
  FileTextOutlined,
  FireOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  OrderedListOutlined,
  ReadOutlined,
  SettingOutlined,
  ShoppingCartOutlined,
  TableOutlined,
  TeamOutlined,
  UnorderedListOutlined,
  UserOutlined,
  WifiOutlined,
} from '@ant-design/icons'

import { Button, Tooltip } from 'antd'

import {
  checkWorkspaceAccess,
  getHealth,
  logout,
} from '../services/api'

import Employees from '../pages/Employees'
import Forbidden from '../pages/Forbidden'
import KhuVuc from '../pages/KhuVuc'
import OpeningHoursSettings from '../pages/OpeningHoursSettings'
import RoleWorkspace from '../pages/RoleWorkspace'


const ROLE_LABELS = {
  QUAN_LY: 'Quản lý',
  PHUC_VU: 'Phục vụ',
  BEP: 'Bếp',
  THU_NGAN: 'Thu ngân',
}


const ROLE_NAVIGATION = {
  QUAN_LY: [
    { key: 'dashboard', label: 'Tổng quan', icon: DashboardOutlined },
    { key: 'bookings', label: 'Đặt bàn', icon: CalendarOutlined },
    { key: 'customers', label: 'Khách hàng', icon: TeamOutlined },
    { key: 'menu-management', label: 'Thực đơn', icon: UnorderedListOutlined },
    { key: 'orders', label: 'Đơn hàng', icon: ShoppingCartOutlined },
    { key: 'employees', label: 'Nhân viên', icon: TeamOutlined },
    { key: 'areas', label: 'Khu vực', icon: ApartmentOutlined },
    { key: 'reports', label: 'Báo cáo', icon: FileTextOutlined },
  ],

  PHUC_VU: [
    { key: 'table-map', label: 'Sơ đồ bàn', icon: TableOutlined },
    { key: 'bookings', label: 'Danh sách đặt bàn', icon: CalendarOutlined },
    { key: 'order-entry', label: 'Gọi món', icon: ShoppingCartOutlined },
  ],

  BEP: [
    { key: 'kitchen', label: 'Màn hình bếp', icon: FireOutlined },
    { key: 'daily-menu', label: 'Danh sách món trong ngày', icon: ReadOutlined },
  ],

  THU_NGAN: [
    { key: 'checkout', label: 'Thanh toán', icon: DollarOutlined },
    { key: 'invoices', label: 'Hóa đơn', icon: FileTextOutlined },
    { key: 'shift-close', label: 'Chốt ca', icon: CheckSquareOutlined },
  ],
}


const MANAGER_SECONDARY = [
  { key: 'settings', label: 'Cài đặt', icon: SettingOutlined },
]


const PATH_TO_PAGE = {
  '/': null,
  '/dashboard': 'dashboard',
  '/bookings': 'bookings',
  '/customers': 'customers',
  '/menu-management': 'menu-management',
  '/orders': 'orders',
  '/employees': 'employees',
  '/areas': 'areas',
  '/reports': 'reports',
  '/settings': 'settings',
  '/table-map': 'table-map',
  '/order-entry': 'order-entry',
  '/kitchen': 'kitchen',
  '/daily-menu': 'daily-menu',
  '/checkout': 'checkout',
  '/invoices': 'invoices',
  '/shift-close': 'shift-close',
}


function pageFromPath() {
  return PATH_TO_PAGE[window.location.pathname] || null
}


function apiErrorMessage(error) {
  const detail = error?.response?.data?.detail

  if (typeof detail === 'string') {
    return detail
  }

  return (
    detail?.message ||
    'Bạn không có quyền truy cập chức năng này.'
  )
}


export default function RestaurantShell({
  user,
  onLogout,
}) {
  const role = user?.role || 'PHUC_VU'

  const navigation = useMemo(
    () => ROLE_NAVIGATION[role] || [],
    [role],
  )

  const secondary = role === 'QUAN_LY'
    ? MANAGER_SECONDARY
    : []

  const firstAllowedPage =
    navigation[0]?.key ||
    secondary[0]?.key ||
    'dashboard'

  const initialPathPage = pageFromPath()

  const [page, setPage] = useState(
    initialPathPage || firstAllowedPage
  )

  const [collapsed, setCollapsed] = useState(false)
  const [health, setHealth] = useState('checking')

  const [accessState, setAccessState] = useState({
    loading: true,
    allowed: false,
    message: '',
  })


  useEffect(() => {
    if (!initialPathPage) {
      window.history.replaceState(
        {},
        '',
        `/${firstAllowedPage}`,
      )
    }
  }, [])


  useEffect(() => {
    const onPopState = () => {
      setPage(
        pageFromPath() || firstAllowedPage
      )
    }

    window.addEventListener(
      'popstate',
      onPopState,
    )

    return () => {
      window.removeEventListener(
        'popstate',
        onPopState,
      )
    }
  }, [firstAllowedPage])


  useEffect(() => {
    let mounted = true

    setAccessState({
      loading: true,
      allowed: false,
      message: '',
    })

    checkWorkspaceAccess(page)
      .then(() => {
        if (mounted) {
          setAccessState({
            loading: false,
            allowed: true,
            message: '',
          })
        }
      })
      .catch((error) => {
        if (mounted) {
          setAccessState({
            loading: false,
            allowed: false,
            message: apiErrorMessage(error),
          })
        }
      })

    return () => {
      mounted = false
    }
  }, [page])


  useEffect(() => {
    let mounted = true

    getHealth()
      .then(() => {
        if (mounted) {
          setHealth('online')
        }
      })
      .catch(() => {
        if (mounted) {
          setHealth('offline')
        }
      })

    return () => {
      mounted = false
    }
  }, [])


  function goTo(nextPage) {
    window.history.pushState(
      {},
      '',
      `/${nextPage}`,
    )

    setPage(nextPage)
  }


  async function signout() {
    try {
      await logout()
    } finally {
      onLogout()
    }
  }


  const allItems = [
    ...navigation,
    ...secondary,
  ]

  const label =
    allItems.find(
      (item) => item.key === page
    )?.label ||
    'Không có quyền truy cập'


  return (
    <div className="app-shell">
      <aside
        className={`sidebar ${
          collapsed ? 'collapsed' : ''
        }`}
      >
        <div className="brand">
          <div className="brand-mark">
            R
          </div>

          {!collapsed && (
            <div>
              <strong>Resto</strong>
              <span>Management</span>
            </div>
          )}
        </div>


        <div className="nav-section">
          {!collapsed && (
            <p className="nav-title">
              CÔNG VIỆC
            </p>
          )}

          {navigation.map(({
            key,
            label: text,
            icon: Icon,
          }) => (
            <button
              key={key}
              className={`nav-item ${
                page === key
                  ? 'active'
                  : ''
              }`}
              onClick={() => goTo(key)}
              title={
                collapsed
                  ? text
                  : undefined
              }
            >
              <Icon />

              {!collapsed && (
                <span>{text}</span>
              )}
            </button>
          ))}
        </div>


        <div className="sidebar-bottom">
          {secondary.length > 0 && !collapsed && (
            <p className="nav-title">
              HỆ THỐNG
            </p>
          )}

          {secondary.map(({
            key,
            label: text,
            icon: Icon,
          }) => (
            <button
              key={key}
              className={`nav-item ${
                page === key
                  ? 'active'
                  : ''
              }`}
              onClick={() => goTo(key)}
            >
              <Icon />

              {!collapsed && (
                <span>{text}</span>
              )}
            </button>
          ))}

          <button
            className="nav-item logout-nav"
            onClick={signout}
          >
            <LogoutOutlined />

            {!collapsed && (
              <span>Đăng xuất</span>
            )}
          </button>
        </div>


        <div className="user-card">
          <div className="avatar">
            <UserOutlined />
          </div>

          {!collapsed && (
            <div className="user-copy">
              <strong>
                {user?.full_name || 'Nhân viên'}
              </strong>

              <span>
                {ROLE_LABELS[role] || role}
              </span>
            </div>
          )}
        </div>
      </aside>


      <main className="main-content">
        <header className="topbar">
          <Button
            type="text"
            className="collapse-button"
            icon={
              collapsed
                ? <MenuUnfoldOutlined />
                : <MenuFoldOutlined />
            }
            onClick={() => {
              setCollapsed(!collapsed)
            }}
          />

          <div className="breadcrumb">
            <span>Nhà hàng</span>
            <b>/</b>
            <strong>{label}</strong>
          </div>

          <div className="topbar-actions">
            <div className="connection-status">
              <span
                className={`status-dot ${
                  health === 'online'
                    ? 'success'
                    : health === 'offline'
                      ? 'danger'
                      : 'warning'
                }`}
              />

              <span>
                API {
                  health === 'online'
                    ? 'Online'
                    : health === 'offline'
                      ? 'Offline'
                      : 'Đang kiểm tra'
                }
              </span>
            </div>

            <Tooltip title="Thông báo">
              <Button
                type="text"
                icon={<BellOutlined />}
              />
            </Tooltip>

            <div className="top-avatar">
              {(user?.full_name || 'A')
                .slice(0, 1)
                .toUpperCase()}
            </div>
          </div>
        </header>


        <div className="page-content">
          {accessState.loading ? (
            <div className="role-access-loading">
              Đang kiểm tra quyền truy cập từ máy chủ...
            </div>
          ) : !accessState.allowed ? (
            <Forbidden
              message={accessState.message}
              onBack={() => goTo(firstAllowedPage)}
            />
          ) : (
            <PageContent
              page={page}
            />
          )}
        </div>
      </main>
    </div>
  )
}


function PageContent({
  page,
}) {
  if (page === 'employees') {
    return <Employees />
  }

  if (page === 'areas') {
    return <KhuVuc />
  }
  if (page === 'settings') {
  return <OpeningHoursSettings />
  }

  if (
    [
      'table-map',
      'bookings',
      'order-entry',
      'kitchen',
      'daily-menu',
      'checkout',
      'invoices',
      'shift-close',
      'reports',
    ].includes(page)
  ) {
    return (
      <RoleWorkspace
        page={page}
      />
    )
  }

  return (
    <GenericManagerPage page={page} />
  )
}


function GenericManagerPage({
  page,
}) {
  const labels = {
    dashboard: [
      'Tổng quan hoạt động',
      'Theo dõi nhanh tình trạng vận hành của nhà hàng.',
      DashboardOutlined,
    ],

    customers: [
      'Khách hàng',
      'Quản lý hồ sơ và lịch sử khách hàng.',
      TeamOutlined,
    ],

    'menu-management': [
      'Quản lý thực đơn',
      'Quản lý món ăn, giá và trạng thái phục vụ.',
      UnorderedListOutlined,
    ],

    orders: [
      'Đơn hàng',
      'Theo dõi order và tiến độ phục vụ.',
      OrderedListOutlined,
    ],

    settings: [
      'Cài đặt',
      'Cấu hình thông tin vận hành của nhà hàng.',
      SettingOutlined,
    ],
  }

  const [
    title,
    description,
    Icon,
  ] = labels[page] || [
    'Chức năng',
    'Màn hình nghiệp vụ.',
    SettingOutlined,
  ]

  return (
    <section className="module-placeholder">
      <div className="placeholder-icon">
        <Icon />
      </div>

      <p className="eyebrow">
        MODULE
      </p>

      <h1>{title}</h1>

      <p>{description}</p>

      <span>
        Quyền truy cập đã được xác thực ở phía máy chủ.
      </span>
    </section>
  )
}
