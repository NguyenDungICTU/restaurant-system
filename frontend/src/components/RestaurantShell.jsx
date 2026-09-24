import { useEffect, useState } from 'react'
import {
  BellOutlined,
  CalendarOutlined,
  DashboardOutlined,


  DisconnectOutlined,
  LogoutOutlined,

  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SettingOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  UnorderedListOutlined,
  UserOutlined,
  WifiOutlined,
  DisconnectOutlined,
  LogoutOutlined,
  ApartmentOutlined,
} from '@ant-design/icons'

import { Button, Tooltip } from 'antd'
} from '@ant-design/icons'
import { Button, Tooltip } from 'antd'

import {
  createOrderSocket,
  getHealth,
  logout,
} from '../services/api'

import Employees from '../pages/Employees'
import KhuVuc from '../pages/KhuVuc'

import Menu from '../pages/Menu'

const navigation = [
  {
    key: 'dashboard',
    label: 'Tổng quan',
    icon: DashboardOutlined,
  },
  {
    key: 'bookings',
    label: 'Đặt bàn',
    icon: CalendarOutlined,
  },
  {
    key: 'customers',
    label: 'Khách hàng',
    icon: TeamOutlined,
  },
  {
    key: 'menu',
    label: 'Thực đơn',
    icon: UnorderedListOutlined,
  },
  {
    key: 'orders',
    label: 'Đơn hàng',
    icon: ShoppingCartOutlined,
  },

  // S1-02 - Nhân viên
  {
    key: 'employees',
    label: 'Nhân viên',
    icon: TeamOutlined,
  },

  // Chức năng Khu vực của nhánh Hoang
  {
    key: 'areas',
    label: 'Khu vực',
    icon: ApartmentOutlined,
  },
]


]

const secondary = [
  {
    key: 'settings',
    label: 'Cài đặt',
    icon: SettingOutlined,
  },
]


export default function RestaurantShell({
  user,
  onLogout,
}) {
  const [page, setPage] = useState('dashboard')
  const [collapsed, setCollapsed] = useState(false)
  const [health, setHealth] = useState('checking')
  const [socket, setSocket] = useState('connecting')
  const [events, setEvents] = useState([])

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


  useEffect(() => {
    let connection

    try {
      connection = createOrderSocket(
  useEffect(() => {
    let socketConnection

    try {
      socketConnection = createOrderSocket(
        (message) => {
          setEvents((current) => [
            {
              id: `${Date.now()}-${Math.random()}`,
              message,
            },
            ...current,
          ].slice(0, 5))
        },
        setSocket,
      )
    } catch {
      setSocket('error')
    }

    return () => {
      connection?.close()
    }
  }, [])


      socketConnection?.close()
    }
  }, [])

  async function signout() {
    try {
      await logout()
    } finally {
      onLogout()
    }
  }


  const label =
    [...navigation, ...secondary]
      .find((item) => item.key === page)
      ?.label || 'Tổng quan'


  return (
    <div className="app-shell">

  const currentPage =
    [...navigation, ...secondary].find(
      (item) => item.key === page,
    )

  const pageLabel =
    currentPage?.label || 'Tổng quan'

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
          <div className="brand-mark">R</div>

          {!collapsed && (
            <div>
              <strong>Resto</strong>
              <span>Management</span>
            </div>
          )}
        </div>


        <div className="nav-section">

        <div className="nav-section">
          {!collapsed && (
            <p className="nav-title">
              QUẢN LÝ
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
              onClick={() => setPage(key)}
              title={
                collapsed
                  ? text
                  : undefined
              }
            >
              <Icon />

              {!collapsed && (
                <span>
                  {text}
                </span>
              )}
            </button>
          ))}
        </div>


        <div className="sidebar-bottom">

          {navigation.map(
            ({
              key,
              label,
              icon: Icon,
            }) => (
              <button
                key={key}
                className={`nav-item ${
                  page === key ? 'active' : ''
                }`}
                onClick={() => setPage(key)}
                title={
                  collapsed
                    ? label
                    : undefined
                }
              >
                <Icon />

                {!collapsed && (
                  <span>{label}</span>
                )}
              </button>
            ),
          )}
        </div>

        <div className="sidebar-bottom">
          {!collapsed && (
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
              onClick={() => setPage(key)}
            >
              <Icon />

              {!collapsed && (
                <span>
                  {text}
                </span>
              )}
            </button>
          ))}

          {secondary.map(
            ({
              key,
              label,
              icon: Icon,
            }) => (
              <button
                key={key}
                className={`nav-item ${
                  page === key ? 'active' : ''
                }`}
                onClick={() => setPage(key)}
                title={
                  collapsed
                    ? label
                    : undefined
                }
              >
                <Icon />

                {!collapsed && (
                  <span>{label}</span>
                )}
              </button>
            ),
          )}

          <button
            className="nav-item logout-nav"
            onClick={signout}
            title={
              collapsed
                ? 'Đăng xuất'
                : undefined
            }
          >
            <LogoutOutlined />

            {!collapsed && (
              <span>
                Đăng xuất
              </span>
              <span>Đăng xuất</span>
            )}
          </button>
        </div>


        <div className="user-card">

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
                {user?.role || 'Nhân viên'}
                {user?.full_name ||
                  'Nhân viên'}
              </strong>

              <span>
                {user?.role ||
                  'Nhân viên'}
              </span>
            </div>
          )}
        </div>
      </aside>


      <main className="main-content">

        <header className="topbar">

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

              collapsed ? (
                <MenuUnfoldOutlined />
              ) : (
                <MenuFoldOutlined />
              )
            }
            onClick={() =>
              setCollapsed(
                (current) => !current,
              )
            }
          />

          <div className="breadcrumb">
            <span>Nhà hàng</span>
            <b>/</b>
            <strong>{pageLabel}</strong>
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


                API{' '}
                {health === 'online'
                  ? 'Online'
                  : health === 'offline'
                    ? 'Offline'
                    : 'Đang kiểm tra'}
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
            <div className="top-avatar">
              {(
                user?.full_name || 'A'
              )
                .slice(0, 1)
                .toUpperCase()}
            </div>
          </div>
        </header>


        <div className="page-content">

          {page === 'dashboard' ? (

        <div className="page-content">
          {page === 'dashboard' ? (
            <Dashboard
              health={health}
              socket={socket}
              events={events}
            />

          ) : page === 'employees' ? (

            <Employees />

          ) : page === 'areas' ? (

            <KhuVuc />

          ) : (

            <ModulePage page={page} />

          )}

          ) : page === 'menu' ? (
            <Menu />
          ) : (
            <ModulePage page={page} />
          )}
        </div>
      </main>
    </div>
  )
}


function Dashboard({
  health,
  socket,
  events,
}) {

  const cards = [
    [
      'Đặt bàn hôm nay',
      '—',
      'Chưa có API đặt bàn',
    ],
    [
      'Khách hàng',
      '—',
      'Chưa có API khách hàng',
    ],
    [
      'Đơn hàng',
      '—',
      'Dữ liệu realtime qua WebSocket',
    ],
    [
      'Doanh thu',
      '—',
      'Chưa có API báo cáo',
    ],
  ]


  return (
    <>
      <section className="page-heading">

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">
            RESTAURANT MANAGEMENT
          </p>

          <h1>
            Tổng quan hoạt động
          </h1>

          <p className="subheading">
            Theo dõi nhanh tình trạng hệ thống
            và các nghiệp vụ nhà hàng.
          </p>
        </div>


        <div className="live-pill">

        <div className="live-pill">
          <span
            className={`status-dot ${
              socket === 'connected'
                ? 'success'
                : 'warning'
            }`}
          />

          <WifiOutlined />

          WebSocket {
            socket === 'connected'
              ? 'đã kết nối'
              : 'chưa kết nối'
          }
        </div>
      </section>


      <section className="stats-grid">

        {cards.map(([title, value, note]) => (
          <article
            className="stat-card"
            key={title}
          >
            <div className="stat-label">
              {title}
            </div>

            <div className="stat-value">
              {value}
            </div>

            <div className="stat-note">
              {note}
            </div>
          </article>
        ))}
      </section>


      <section className="content-grid">

        <article className="panel">

          <div className="panel-heading">

          WebSocket{' '}
          {socket === 'connected'
            ? 'đã kết nối'
            : 'chưa kết nối'}
        </div>
      </section>

      <section className="stats-grid">
        {cards.map(
          ([title, value, note]) => (
            <article
              className="stat-card"
              key={title}
            >
              <div className="stat-label">
                {title}
              </div>

              <div className="stat-value">
                {value}
              </div>

              <div className="stat-note">
                {note}
              </div>
            </article>
          ),
        )}
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>
                Trạng thái hệ thống
              </h2>

              <p>
                Các kết nối hiện có trong backend.
                Các kết nối hiện có trong
                backend.
              </p>
            </div>

            <WifiOutlined className="panel-icon" />
          </div>


          <div className="system-list">

          <div className="system-list">
            <div>
              <span>
                <span
                  className={`status-dot ${
                    health === 'online'
                      ? 'success'
                      : 'danger'
                  }`}
                />

                API Health
              </span>

              <strong
                className={
                  health === 'online'
                    ? 'text-success'
                    : 'text-danger'
                }
              >
                {
                  health === 'online'
                    ? 'Đang hoạt động'
                    : 'Cần kiểm tra'
                }
              </strong>
            </div>


                {health === 'online'
                  ? 'Đang hoạt động'
                  : 'Cần kiểm tra'}
              </strong>
            </div>

            <div>
              <span>
                <span
                  className={`status-dot ${
                    socket === 'connected'
                      ? 'success'
                      : 'warning'
                  }`}
                />

                WebSocket /ws/orders
              </span>

              <strong>
                {socketLabel(socket)}
              </strong>
            </div>


            <div>
              <span>
                <span className="status-dot warning" />
            <div>
              <span>
                <span className="status-dot warning" />

                CRUD nghiệp vụ
              </span>

              <strong className="text-muted">
                Chưa có endpoint
              </strong>
            </div>
          </div>
        </article>


        <article className="panel">

          <div className="panel-heading">

        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>
                Order realtime
              </h2>

              <p>
                Sự kiện nhận từ WebSocket.
              </p>
            </div>

            <ShoppingCartOutlined className="panel-icon" />
          </div>


          {events.length ? (

            <div className="event-list">

          {events.length ? (
            <div className="event-list">
              {events.map((event) => (
                <div
                  className="event-item"
                  key={event.id}
                >
                  <span>
                    {event.message}
                  </span>

                  <small>
                    vừa nhận
                  </small>
                </div>
              ))}

            </div>

          ) : (

            <div className="empty-state">

            </div>
          ) : (
            <div className="empty-state">
              <DisconnectOutlined />

              <strong>
                Chưa có sự kiện
              </strong>

              <span>
                Khi backend broadcast order update,
                dữ liệu sẽ xuất hiện tại đây.
              </span>
            </div>
          )}

        </article>
      </section>


      <section className="implementation-note">

                Khi backend broadcast order
                update, dữ liệu sẽ xuất hiện
                tại đây.
              </span>
            </div>
          )}
        </article>
      </section>

      <section className="implementation-note">
        <div className="note-icon">
          i
        </div>

        <div>
          <strong>
            Frontend đang bám đúng API backend hiện có
            Frontend đang bám đúng API backend
            hiện có
          </strong>

          <p>
            Đăng nhập thật qua{' '}
            <code>/api/auth/login</code>,
            kiểm tra phiên qua{' '}
            <code>/api/auth/me</code>,
            đăng xuất qua{' '}
            <code>/api/auth/logout</code>
            {' '}và realtime order qua{' '}
            <code>/ws/orders</code>.
            <code>/api/auth/login</code>, kiểm tra
            phiên qua{' '}
            <code>/api/auth/me</code>, đăng xuất
            qua{' '}
            <code>/api/auth/logout</code> và
            realtime order qua{' '}
            <code>/ws/orders</code>. Các module
            còn lại chưa gọi API giả.
          </p>
        </div>
      </section>
    </>
  )
}


function socketLabel(status) {

  return status === 'connected'
    ? 'Đã kết nối'
    : status === 'error'
      ? 'Lỗi kết nối'
      : 'Đang kết nối'
}


function ModulePage({
  page,
}) {

  const labels = {

function socketLabel(socket) {
  if (socket === 'connected') {
    return 'Đã kết nối'
  }

  if (socket === 'error') {
    return 'Lỗi kết nối'
  }

  return 'Đang kết nối'
}

function ModulePage({ page }) {
  const labels = {
    bookings: [
      'Đặt bàn',
      'Quản lý lịch đặt bàn, khung giờ nhận khách và trạng thái bàn.',
    ],

    customers: [
      'Khách hàng',
      'Quản lý hồ sơ, thông tin liên hệ và lịch sử khách hàng.',
    ],

    menu: [
      'Thực đơn',
      'Quản lý nhóm món, món ăn, giá và trạng thái còn/hết trong ngày.',
    ],

    orders: [
      'Đơn hàng',
      'Theo dõi order theo bàn và tiến độ phục vụ.',
    ],

    settings: [
      'Cài đặt',
      'Cấu hình các thông tin vận hành của nhà hàng.',
    ],
  }


  const [title, description] =
    labels[page] || [
      'Tổng quan',
      '',
    ]


  return (
    <section className="module-placeholder">

      <div className="placeholder-icon">
        <SettingOutlined />
  const icons = {
    bookings: CalendarOutlined,
    customers: TeamOutlined,
    orders: ShoppingCartOutlined,
    settings: SettingOutlined,
  }

  const Icon =
    icons[page] || SettingOutlined

  return (
    <section className="module-placeholder">
      <div className="placeholder-icon">
        <Icon />
      </div>

      <p className="eyebrow">
        MODULE
      </p>

      <h1>
        {title}
      </h1>

      <p>
        {description}
      </p>

      <span>
        UI đã sẵn sàng · Chờ backend cung cấp endpoint nghiệp vụ.
      </span>

      <h1>{title}</h1>

      <p>{description}</p>

      <span>
        UI đã sẵn sàng · Chờ backend cung cấp
        endpoint nghiệp vụ.
      </span>
    </section>
  )
}