import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  ConfigProvider,
  DatePicker,
  Empty,
  Segmented,
  Spin,
  Table,
  Tag,
} from 'antd'
import {
  DownloadOutlined,
  ReloadOutlined,
  StopOutlined,
  TrophyOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { getDishReport } from '../services/reportsApi'
import './Reports.css'

const { RangePicker } = DatePicker

const REPORT_THEME = {
  token: {
    colorPrimary: '#9f2f27',
    colorText: '#27231f',
    colorTextSecondary: '#766e66',
    colorBorder: '#ebe7e1',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorBgLayout: '#f7f5f2',
    colorInfo: '#9f2f27',
    colorInfoBg: '#fbf6ef',
    colorInfoBorder: '#eadfce',
    colorSuccess: '#2d8a56',
    colorWarning: '#c8841b',
    colorError: '#c8473d',
  },
}

function formatVnd(value) {
  return `${new Intl.NumberFormat('vi-VN').format(Number(value || 0))} ₫`
}

function isoDate(value) {
  return value.format('YYYY-MM-DD')
}

function escapeCsv(value) {
  const text = String(value ?? '')
  return `"${text.replaceAll('"', '""')}"`
}

function currentStatusLabel(item) {
  return item.ngung_ban ? 'Ngừng bán' : 'Đang kinh doanh'
}

function DishName({ item }) {
  return (
    <div className="report-dish-name">
      <strong>{item.ten_mon}</strong>
      {item.ngung_ban && <Tag color="default">Ngừng bán</Tag>}
    </div>
  )
}

export default function Reports() {
  const initialRange = useMemo(
    () => [dayjs().subtract(6, 'day'), dayjs()],
    [],
  )

  const [draftRange, setDraftRange] = useState(initialRange)
  const [appliedRange, setAppliedRange] = useState(initialRange)
  const [rankingMode, setRankingMode] = useState('quantity')
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadReport = useCallback(async (range) => {
    if (!range?.[0] || !range?.[1]) {
      setError('Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.')
      return
    }

    if (range[0].isAfter(range[1], 'day')) {
      setError('Ngày bắt đầu không được lớn hơn ngày kết thúc.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const data = await getDishReport(
        isoDate(range[0]),
        isoDate(range[1]),
      )
      setReport(data)
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Không thể tải báo cáo. Vui lòng thử lại.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReport(appliedRange)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [appliedRange, loadReport])

  const rankingRows = useMemo(() => {
    if (!report) return []
    return rankingMode === 'quantity'
      ? report.top_by_quantity
      : report.top_by_revenue
  }, [rankingMode, report])

  function applyRange() {
    if (!draftRange?.[0] || !draftRange?.[1]) {
      setError('Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.')
      return
    }

    if (draftRange[0].isAfter(draftRange[1], 'day')) {
      setError('Ngày bắt đầu không được lớn hơn ngày kết thúc.')
      return
    }

    setError('')
    setAppliedRange([
      draftRange[0].startOf('day'),
      draftRange[1].startOf('day'),
    ])
  }

  function exportCsv() {
    if (!report) return

    const rangeText = `${report.from_date}_den_${report.to_date}`
    const rows = [
      ['BÁO CÁO MÓN BÁN CHẠY VÀ MÓN BỊ HUỶ'],
      ['Từ ngày', report.from_date],
      ['Đến ngày', report.to_date],
      [],
      ['TOP 10 MÓN BÁN CHẠY THEO SỐ LƯỢNG'],
      ['Hạng', 'Tên món', 'Trạng thái hiện tại', 'Số lượng bán', 'Doanh thu (VND)'],
      ...(report.top_by_quantity || []).map((item) => [
        item.rank, item.ten_mon, currentStatusLabel(item), item.so_luong_ban,
        Number(item.doanh_thu || 0),
      ]),
      [],
      ['TOP 10 MÓN BÁN CHẠY THEO DOANH THU'],
      ['Hạng', 'Tên món', 'Trạng thái hiện tại', 'Số lượng bán', 'Doanh thu (VND)'],
      ...(report.top_by_revenue || []).map((item) => [
        item.rank, item.ten_mon, currentStatusLabel(item), item.so_luong_ban,
        Number(item.doanh_thu || 0),
      ]),
      [],
      ['MÓN BỊ HUỶ NHIỀU NHẤT'],
      ['Hạng', 'Tên món', 'Trạng thái hiện tại', 'Số lượng bị huỷ', 'Lý do huỷ phổ biến nhất'],
      ...(report.cancelled_items || []).map((item) => [
        item.rank, item.ten_mon, currentStatusLabel(item), item.so_luong_huy,
        item.ly_do_pho_bien,
      ]),
    ]

    const csv = rows
      .map((row) => row.map(escapeCsv).join(';'))
      .join(String.fromCharCode(13, 10))
    // UTF-8 BOM helps Excel detect Vietnamese characters correctly.
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `bao-cao-mon_${rangeText}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const rankingColumns = [
    {
      title: 'Hạng',
      dataIndex: 'rank',
      width: 86,
      render: (value) => (
        <span className={`report-rank report-rank-${value}`}>
          #{value}
        </span>
      ),
    },
    {
      title: 'Tên món',
      key: 'dish',
      render: (_, item) => <DishName item={item} />,
    },
    {
      title: 'Số lượng bán',
      dataIndex: 'so_luong_ban',
      width: 160,
      align: 'right',
      render: (value) => (
        <strong>{Number(value || 0).toLocaleString('vi-VN')}</strong>
      ),
    },
    {
      title: 'Doanh thu',
      dataIndex: 'doanh_thu',
      width: 190,
      align: 'right',
      render: (value) => (
        <strong className="report-money">{formatVnd(value)}</strong>
      ),
    },
  ]

  const cancelledColumns = [
    {
      title: 'Hạng',
      dataIndex: 'rank',
      width: 86,
      render: (value) => (
        <span className="report-rank report-rank-cancelled">
          #{value}
        </span>
      ),
    },
    {
      title: 'Tên món',
      key: 'dish',
      render: (_, item) => <DishName item={item} />,
    },
    {
      title: 'Số lượng bị huỷ',
      dataIndex: 'so_luong_huy',
      width: 170,
      align: 'right',
      render: (value) => (
        <strong>{Number(value || 0).toLocaleString('vi-VN')}</strong>
      ),
    },
    {
      title: 'Lý do huỷ phổ biến nhất',
      dataIndex: 'ly_do_pho_bien',
      render: (value, item) => (
        <div className="report-reason">
          <span>{value || 'Không ghi lý do'}</span>
          {item.ly_do_dong_hang?.length > 1 && (
            <Tag color="orange">Đồng hạng lý do</Tag>
          )}
        </div>
      ),
    },
  ]

  return (
    <ConfigProvider theme={REPORT_THEME}>
    <div className="reports-page">
      <section className="reports-hero">
        <div>
          <span className="reports-kicker">BÁO CÁO QUẢN LÝ</span>
          <h1>Món bán chạy & món bị huỷ</h1>
          <p>
            Xem Top 10 theo số lượng hoặc doanh thu, theo dõi món bị huỷ
            nhiều và xuất CSV mở đúng tiếng Việt trên Excel.
          </p>
        </div>

        <Button
          icon={<DownloadOutlined />}
          onClick={exportCsv}
          disabled={!report || loading}
        >
          Xuất CSV
        </Button>
      </section>

      <Card className="reports-filter-card" bordered={false}>
        <div className="reports-filter-grid">
          <div>
            <label>Khoảng ngày báo cáo</label>
            <RangePicker
              value={draftRange}
              format="DD/MM/YYYY"
              allowClear={false}
              onChange={(value) => setDraftRange(value)}
            />
          </div>

          <div>
            <label>Xếp hạng bán chạy</label>
            <Segmented
              block
              value={rankingMode}
              options={[
                {
                  label: 'Theo số lượng',
                  value: 'quantity',
                },
                {
                  label: 'Theo doanh thu',
                  value: 'revenue',
                },
              ]}
              onChange={setRankingMode}
            />
          </div>

          <div className="reports-filter-action">
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={applyRange}
            >
              Xem báo cáo
            </Button>
          </div>
        </div>
      </Card>

      {error && (
        <Alert
          className="reports-alert"
          type="error"
          showIcon
          message={error}
        />
      )}

      {loading && !report ? (
        <div className="reports-loading">
          <Spin size="large" tip="Đang tổng hợp báo cáo..." />
        </div>
      ) : report ? (
        <>
          <section className="reports-summary">
            <Card bordered={false}>
              <span>Tổng số lượng đã bán</span>
              <strong>
                {Number(
                  report.summary?.tong_so_luong_ban || 0,
                ).toLocaleString('vi-VN')}
              </strong>
            </Card>

            <Card bordered={false}>
              <span>Tổng doanh thu món</span>
              <strong>
                {formatVnd(report.summary?.tong_doanh_thu)}
              </strong>
            </Card>

            <Card bordered={false}>
              <span>Tổng số lượng bị huỷ</span>
              <strong className="reports-danger">
                {Number(
                  report.summary?.tong_so_luong_huy || 0,
                ).toLocaleString('vi-VN')}
              </strong>
            </Card>
          </section>

          <Card
            className="reports-table-card"
            bordered={false}
            title={
              <div className="reports-card-title">
                <TrophyOutlined />
                <div>
                  <strong>
                    {rankingMode === 'quantity'
                      ? 'Top 10 món bán chạy theo số lượng'
                      : 'Top 10 món bán chạy theo doanh thu'}
                  </strong>
                  <span>
                    {report.from_date} → {report.to_date}
                  </span>
                </div>
              </div>
            }
          >
            <Table
              rowKey="mon_an_id"
              columns={rankingColumns}
              dataSource={rankingRows}
              pagination={false}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Khoảng ngày này chưa phát sinh món bán hoàn tất."
                  />
                ),
              }}
            />
          </Card>

          <Card
            className="reports-table-card reports-cancelled-card"
            bordered={false}
            title={
              <div className="reports-card-title">
                <StopOutlined />
                <div>
                  <strong>Món bị huỷ nhiều nhất</strong>
                  <span>
                    Sắp xếp theo tổng số lượng bị huỷ giảm dần
                  </span>
                </div>
              </div>
            }
          >
            <Table
              rowKey="mon_an_id"
              columns={cancelledColumns}
              dataSource={report.cancelled_items || []}
              pagination={false}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Khoảng ngày này không phát sinh món bị huỷ."
                  />
                ),
              }}
            />
          </Card>
        </>
      ) : null}
    </div>
    </ConfigProvider>
  )
}
