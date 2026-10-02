import { useEffect, useState } from 'react'
import { AppstoreOutlined, CheckCircleOutlined, ClockCircleOutlined, TeamOutlined, PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, FilePdfOutlined } from '@ant-design/icons'
import './RestaurantManagement.css'
import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Table,
  Tag,
} from 'antd'

import {
  checkTableCode,
  createTable,
  deleteTable,
  downloadQR,
  getAreas,
  getTables,
  regenerateQR,
  updateTable,
} from '../services/api'

function QRActionIcon({ rotate = false }) {
  return (
    <svg className="management-qr-icon" viewBox="0 0 28 28" fill="none" aria-hidden="true" focusable="false">
      <g stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
        <path d="M2 2h8v8H2zM15 2h8v8h-8zM2 15h8v8H2z" />
        <path d="M5 5h2v2H5zM18 5h2v2h-2zM5 18h2v2H5z" fill="currentColor" stroke="none" />
        <path d="M12 2v3m0 3v5H7m-5 0h2m9 3v-3h4m3 0h3M12 20v3" />
      </g>
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {rotate ? (
          <><path d="M16 19a5 5 0 0 1 8.5-2L26 19m0-4v4h-4" /><path d="M26 22a5 5 0 0 1-8.5 3L16 23m0 4v-4h4" /></>
        ) : (
          <><path d="M21 15v8m-3-3 3 3 3-3" /><path d="M16 24v3h10v-3" /></>
        )}
      </g>
    </svg>
  )
}

const statuses = {
  TRONG: 'Trống',
  DANG_SU_DUNG: 'Đang sử dụng',
  DA_DAT: 'Đã đặt',
  NGUNG_SU_DUNG: 'Ngừng sử dụng',
}

const types = {
  THUONG: 'Thường',
  PHONG_RIENG: 'Phòng riêng',
}

const options = values =>
  Object.entries(values).map(([value, label]) => ({
    value,
    label,
  }))

const defaults = {
  suc_chua_toi_thieu: 1,
  suc_chua_toi_da: 4,
  loai_ban: 'THUONG',
  trang_thai: 'TRONG',
}

function errorText(error) {
  const detail = error.response?.data?.detail

  return typeof detail === 'string'
    ? detail
    : 'Không thể thực hiện. Kiểm tra dữ liệu và thử lại.'
}

export default function Ban() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState()
  const [tables, setTables] = useState([])
  const [areas, setAreas] = useState([])
  const [areaId, setAreaId] = useState()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(null)
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState(null)

  const [form] = Form.useForm()

  const activeAreas = areas.filter(
    area => area.trang_thai === 'HOAT_DONG'
  )

  const currentInactiveArea =
    editing &&
    areas.find(
      area =>
        area.id === editing.khu_vuc_id &&
        area.trang_thai !== 'HOAT_DONG'
    )

  const formAreaOptions = areas.map(area => {
    const inactive = area.trang_thai !== 'HOAT_DONG'

    return {
      value: area.id,
      label: `${area.ten_khu_vuc}${
        inactive ? ' (ngừng sử dụng)' : ''
      }`,
      disabled: inactive,
      style: inactive
        ? { color: '#8c8c8c' }
        : undefined,
    }
  })

  useEffect(() => {
    let active = true

    Promise.all([
      getTables(),
      getAreas(),
    ])
      .then(([rows, regions]) => {
        if (active) {
          setTables(rows)
          setAreas(regions)
        }
      })
      .catch(error => {
        if (active) {
          setNotice({
            type: 'error',
            title: errorText(error),
          })
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  async function run(
    action,
    success,
    reload = true,
  ) {
    setBusy(true)
    setNotice(null)

    try {
      await action()

      if (reload) {
        setTables(await getTables())
      }

      setNotice({
        type: 'success',
        title: success,
      })
    } catch (error) {
      setNotice({
        type: 'error',
        title: errorText(error),
      })
    } finally {
      setBusy(false)
    }
  }

  function edit(row = null) {
    setNotice(null)
    setEditing(row)

    form.resetFields()

    form.setFieldsValue(
      row || {
        ...defaults,
        khu_vuc_id: activeAreas.some(
          area => area.id === areaId
        )
          ? areaId
          : undefined,
      }
    )

    setOpen(true)
  }

  async function save(values) {
    await run(
      async () => {
        if (editing) {
          await updateTable(
            editing.id,
            values
          )
        } else {
          await createTable(values)
        }

        setOpen(false)
        setEditing(null)
        form.resetFields()
      },
      editing
        ? 'Đã cập nhật bàn.'
        : 'Đã thêm bàn và sinh QR.'
    )
  }

  function remove(row) {
    Modal.confirm({
      title: `Xóa bàn ${row.ma_ban}?`,
      content:
        'Bàn sẽ bị xóa vĩnh viễn và các mã QR của bàn không còn sử dụng được.',
      okText: 'Xóa bàn',
      cancelText: 'Hủy',
      okButtonProps: {
        danger: true,
      },
      onOk: () =>
        run(
          async () => {
            await deleteTable(row.id)

            setTables(current =>
              current.filter(
                table => table.id !== row.id
              )
            )

            if (editing?.id === row.id) {
              setOpen(false)
              setEditing(null)
              form.resetFields()
            }
          },
          'Đã xóa bàn.',
          false
        ),
    })
  }

  function rotate(row) {
    Modal.confirm({
      title: `Sinh lại QR cho ${row.ma_ban}?`,
      content:
        'QR cũ sẽ ngừng hiệu lực ngay. Ảnh QR mới sẽ tự tải về để bạn in lại.',
      okText: 'Sinh lại QR',
      cancelText: 'Hủy',
      onOk: async () => {
        setBusy(true)
        setNotice(null)

        let regenerated = false

        try {
          const updated = await regenerateQR(
            row.id
          )

          regenerated = true

          setTables(current =>
            current.map(table =>
              table.id === row.id
                ? updated
                : table
            )
          )

          await downloadQR(
            `/api/ban/${row.id}/qr.png`,
            `ban-${row.id}-qr.png`
          )

          setNotice({
            type: 'success',
            title: 'Đã sinh và tải QR mới',
          })
        } catch (error) {
          setNotice({
            type: 'error',
            title: regenerated
              ? `QR đã được sinh lại và QR cũ đã vô hiệu, nhưng tải PNG thất bại. ${errorText(
                  error
                )} Bấm “Tải PNG” để tải lại QR hiện tại.`
              : `Không thể sinh QR mới. ${errorText(
                  error
                )}`,
          })
        } finally {
          setBusy(false)
        }
      },
    })
  }

  const columns = [
    {
      title: 'Mã bàn',
      dataIndex: 'ma_ban',
      render: value => <strong className="management-table-code">{value}</strong>,
    },
    {
      title: 'Khu vực',
      dataIndex: 'khu_vuc_id',
      render: id =>
        <span className="management-table-area"><AppstoreOutlined /><span>{areas.find(
          area => area.id === id
        )?.ten_khu_vuc || id}</span></span>,
    },
    {
      title: 'Sức chứa',
      render: (_, row) =>
        <span className="management-capacity"><TeamOutlined /><span>{row.suc_chua_toi_thieu}–{row.suc_chua_toi_da} <small>khách</small></span></span>,
    },
    {
      title: 'Loại',
      dataIndex: 'loai_ban',
      render: value => types[value],
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      render: value => (
        <Tag className="management-status" color={{ TRONG: 'green', DA_DAT: 'gold', DANG_SU_DUNG: 'blue', NGUNG_SU_DUNG: 'default' }[value]}>{statuses[value]}</Tag>
      ),
    },
    {
      title: 'Thao tác',
      render: (_, row) => (
        <div className="management-table-actions">
          <div className="management-qr-actions" role="group" aria-label={`Thao tác QR · ${row.ma_ban}`}>
          <Button
            className="management-qr-download"
            disabled={busy}
            onClick={() =>
              run(
                () =>
                  downloadQR(
                    `/api/ban/${row.id}/qr.png`,
                    `ban-${row.id}-qr.png`
                  ),
                'Đã tải PNG.',
                false
              )
            }
            title="Tải mã QR định dạng PNG"
            aria-label={`Tải QR PNG · ${row.ma_ban}`}
            icon={<QRActionIcon />}
          >Tải QR</Button>

          <Button
            className="management-qr-rotate"
            disabled={busy}
            onClick={() => rotate(row)}
            title="Đổi QR: sinh mã QR mới và vô hiệu hóa mã cũ"
            aria-label={`Sinh lại QR · ${row.ma_ban}`}
            icon={<QRActionIcon rotate />}
          >Đổi QR</Button>
          </div>
          <div className="management-record-actions" role="group" aria-label={`Thông tin bàn · ${row.ma_ban}`}>
          <Button
            disabled={busy}
            onClick={() => edit(row)}
            title="Sửa thông tin bàn"
            aria-label={`Sửa · ${row.ma_ban}`}
            icon={<EditOutlined />}
          />
          <Button
            danger
            disabled={busy}
            onClick={() => remove(row)}
            title="Xóa bàn"
            aria-label={`Xóa · ${row.ma_ban}`}
            icon={<DeleteOutlined />}
          />
          </div>
        </div>
      ),
    },
  ]

  return (
    <section className="management-page tables-page">
      <div className="page-heading">
        <div>
          <nav className="management-breadcrumb" aria-label="Đường dẫn">Nhà hàng <span>/</span> Bàn</nav>
          <h1>Quản lý bàn</h1>
          <p className="subheading">
            Khai báo bàn, sức chứa và quản lý mã QR.
          </p>
        </div>

        <Button
          className="management-add"
          icon={<PlusOutlined />}
          type="primary"
          disabled={
            loading ||
            busy ||
            !activeAreas.length
          }
          onClick={() => edit()}
        >
          Thêm bàn
        </Button>
      </div>

      <div className="management-stats" aria-label="Thống kê bàn">
        {[
          ['Tổng bàn', tables.length, <AppstoreOutlined />, 'wine', 'Toàn bộ bàn trong nhà hàng'],
          ['Bàn trống', tables.filter(row => row.trang_thai === 'TRONG').length, <CheckCircleOutlined />, 'green', 'Sẵn sàng đón khách'],
          ['Đã đặt trước', tables.filter(row => row.trang_thai === 'DA_DAT').length, <ClockCircleOutlined />, 'amber', 'Đang giữ chỗ cho khách'],
          ['Đang phục vụ', tables.filter(row => row.trang_thai === 'DANG_SU_DUNG').length, <TeamOutlined />, 'blue', 'Khách đang sử dụng bàn'],
        ].map(([label, count, icon, tone, description]) => (
          <article className={`management-stat tone-${tone}`} key={label}>
            <span className={`management-stat-icon ${tone}`}>{icon}</span>
            <div><span>{label}</span><strong>{loading ? '—' : count}</strong><small>{description}</small></div>
          </article>
        ))}
      </div>

      {notice && (
        <Alert
          {...notice}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {!loading && !activeAreas.length && (
        <Alert
          title="Hãy tạo hoặc kích hoạt khu vực trước khi thêm bàn."
          type="info"
          style={{ marginBottom: 16 }}
        />
      )}

      <article className="management-list-card">
      <div className="management-list-heading"><div><h2>Danh sách bàn</h2><p>Theo dõi không gian phục vụ và quản lý mã QR của từng bàn.</p></div><span className="management-count-label">{loading ? 'Đang tải…' : `${tables.length} bàn`}</span></div>
      <div className="management-toolbar">
        <Input aria-label="Tìm mã bàn" placeholder="Tìm mã bàn…" prefix={<SearchOutlined />} allowClear value={search} onChange={e => setSearch(e.target.value)} />
        <Select
          aria-label="Lọc khu vực"
          placeholder="Tất cả khu vực"
          allowClear
          value={areaId}
          onChange={setAreaId}
          className="management-filter"
          options={areas.map(area => ({
            value: area.id,
            label: area.ten_khu_vuc,
          }))}
        />

        <Select aria-label="Lọc trạng thái bàn" placeholder="Tất cả trạng thái" allowClear value={statusFilter} onChange={setStatusFilter} options={options(statuses)} className="management-filter" />
        <Button
          icon={<FilePdfOutlined />}
          title="Chọn khu vực để tải PDF QR"
          disabled={!areaId || busy}
          onClick={() =>
            run(
              () =>
                downloadQR(
                  `/api/ban/khu-vuc/${areaId}/qr.pdf`,
                  `khu-vuc-${areaId}-qr.pdf`
                ),
              'Đã tải PDF QR của khu vực.',
              false
            )
          }
        >
          Tải PDF khu vực
        </Button>
      </div>

      <Table
        className="management-operational-table"
        rowKey="id"
        loading={{ spinning: loading, description: 'Đang tải danh sách bàn…' }}
        dataSource={tables.filter(
          row =>
            (!areaId || row.khu_vuc_id === areaId) &&
            (!statusFilter || row.trang_thai === statusFilter) &&
            row.ma_ban.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'))
        )}
        columns={columns}
        scroll={{ x: 950 }}
        locale={{
          emptyText: <div className="management-empty"><AppstoreOutlined /><strong>{tables.length ? 'Không tìm thấy bàn phù hợp' : 'Chưa có bàn nào'}</strong><span>{tables.length ? 'Thử mã bàn, khu vực hoặc trạng thái khác.' : 'Thêm bàn để bắt đầu quản lý không gian phục vụ.'}</span></div>,
        }}
      />
      </article>

      <Modal
        className="management-modal"
        title={editing ? 'Sửa bàn' : 'Thêm bàn'}
        open={open}
        onCancel={() => {
          if (!busy) {
            setOpen(false)
          }
        }}
        footer={null}
        forceRender
      >
        {notice?.type === 'error' && (
          <Alert
            {...notice}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Form
          form={form}
          layout="vertical"
          initialValues={defaults}
          onFinish={save}
        >
          <Form.Item
            name="ma_ban"
            label="Mã bàn"
            validateDebounce={400}
            rules={[
              {
                required: true,
                whitespace: true,
                message: 'Nhập mã bàn.',
              },
              {
                max: 50,
                message:
                  'Mã bàn tối đa 50 ký tự.',
              },
              {
                validator: async (_, value) => {
                  const normalized =
                    value?.trim()

                  if (!normalized) {
                    return
                  }

                  try {
                    const result =
                      await checkTableCode(
                        normalized,
                        editing?.id
                      )

                    if (!result.available) {
                      throw new Error(
                        'Mã bàn đã tồn tại.'
                      )
                    }
                  } catch (error) {
                    if (
                      error?.message ===
                      'Mã bàn đã tồn tại.'
                    ) {
                      throw error
                    }

                    throw new Error(
                      'Không thể kiểm tra mã bàn. Vui lòng thử lại.'
                    )
                  }
                },
              },
            ]}
          >
            <Input maxLength={50} />
          </Form.Item>

          <Form.Item
            name="khu_vuc_id"
            label="Khu vực"
            extra={
              currentInactiveArea
                ? 'Khu vực hiện tại đã ngừng sử dụng. Bạn có thể giữ nguyên hoặc chuyển sang khu vực đang hoạt động.'
                : undefined
            }
            rules={[
              {
                required: true,
                message: 'Chọn khu vực.',
              },
              {
                validator: (_, value) =>
                  value == null ||
                  (editing &&
                    value ===
                      editing.khu_vuc_id) ||
                  activeAreas.some(
                    area => area.id === value
                  )
                    ? Promise.resolve()
                    : Promise.reject(
                        new Error(
                          'Khu vực đã ngừng sử dụng. Vui lòng chọn khu vực đang hoạt động.'
                        )
                      ),
              },
            ]}
          >
            <Select
              options={formAreaOptions}
              labelRender={({
                value,
                label,
              }) =>
                currentInactiveArea &&
                value ===
                  currentInactiveArea.id ? (
                  <span
                    style={{
                      color: '#8c8c8c',
                    }}
                  >
                    {
                      currentInactiveArea.ten_khu_vuc
                    }{' '}
                    (ngừng sử dụng)
                  </span>
                ) : (
                  label ?? value
                )
              }
            />
          </Form.Item>

          <Form.Item
            name="suc_chua_toi_thieu"
            label="Sức chứa tối thiểu"
            rules={[
              {
                required: true,
                message:
                  'Nhập sức chứa tối thiểu.',
              },
            ]}
          >
            <InputNumber
              min={1}
              max={2147483647}
              precision={0}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="suc_chua_toi_da"
            label="Sức chứa tối đa"
            dependencies={[
              'suc_chua_toi_thieu',
            ]}
            rules={[
              {
                required: true,
                message:
                  'Nhập sức chứa tối đa.',
              },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const minimum =
                    getFieldValue(
                      'suc_chua_toi_thieu'
                    )

                  if (
                    value == null ||
                    minimum == null ||
                    value >= minimum
                  ) {
                    return Promise.resolve()
                  }

                  return Promise.reject(
                    new Error(
                      'Tối đa phải lớn hơn hoặc bằng tối thiểu.'
                    )
                  )
                },
              }),
            ]}
          >
            <InputNumber
              min={1}
              max={2147483647}
              precision={0}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="loai_ban"
            label="Loại bàn"
          >
            <Select
              options={options(types)}
            />
          </Form.Item>

          <Form.Item
            name="trang_thai"
            label="Trạng thái"
          >
            <Select
              options={options(statuses)}
            />
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            loading={busy}
          >
            Lưu bàn
          </Button>
        </Form>
      </Modal>
    </section>
  )
}
