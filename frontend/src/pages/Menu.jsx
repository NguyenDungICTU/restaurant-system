import { useCallback, useEffect, useState } from 'react'
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  FilterOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import {
  App as AntdApp,
  Button,
  Card,
  Col,
  Modal,
  Radio,
  Row,
  Segmented,
  Space,
  Typography,
} from 'antd'

import {
  createCategory,
  createDish,
  deleteCategory,
  deleteDish,
  getCategories,
  getDishes,
  reorderCategories,
  updateCategory,
  updateCategoryStatus,
  updateDish,
  uploadCategoryImage,
  uploadDishImage,
} from '../services/api'

import CategoryFormModal from '../components/menu/CategoryFormModal'
import CategoryList from '../components/menu/CategoryList'
import DishFormModal from '../components/menu/DishFormModal'
import DishList from '../components/menu/DishList'

const { Title, Text, Paragraph } = Typography

const FILTER_OPTIONS = [
  { label: 'Tất cả', value: 'all' },
  { label: 'Đang sử dụng', value: 'active' },
  { label: 'Đang tắt', value: 'inactive' },
]

export default function Menu() {
  const { message } = AntdApp.useApp()

  const [categories, setCategories] = useState([])
  const [dishes, setDishes] = useState([])
  const [loading, setLoading] = useState(true)
  const [dishesLoading, setDishesLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [view, setView] = useState('categories')

  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [categoryModalMode, setCategoryModalMode] = useState('create')
  const [editingCategory, setEditingCategory] = useState(null)

  const [dishModalOpen, setDishModalOpen] = useState(false)
  const [dishModalMode, setDishModalMode] = useState('create')
  const [editingDish, setEditingDish] = useState(null)

  const [saving, setSaving] = useState(false)
  const [updatingStatusId, setUpdatingStatusId] = useState(null)
  const [reorderDirty, setReorderDirty] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteDishTarget, setDeleteDishTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deletingDish, setDeletingDish] = useState(false)

  const loadCategories = useCallback(
    async (showLoading = true) => {
      try {
        if (showLoading) setLoading(true)

        const data = await getCategories()

        const sorted = [...data].sort(
          (a, b) => a.thu_tu - b.thu_tu || a.id - b.id,
        )

        setCategories(sorted)
        setReorderDirty(false)
      } catch (error) {
        message.error(
          getErrorMessage(
            error,
            'Không thể tải danh sách nhóm món.',
          ),
        )
      } finally {
        if (showLoading) setLoading(false)
      }
    },
    [message],
  )

  const loadDishes = useCallback(
    async (showLoading = true) => {
      try {
        if (showLoading) setDishesLoading(true)

        setDishes(await getDishes())
      } catch (error) {
        message.error(
          getErrorMessage(
            error,
            'Không thể tải danh sách món ăn.',
          ),
        )
      } finally {
        if (showLoading) setDishesLoading(false)
      }
    },
    [message],
  )

  useEffect(() => {
    loadCategories()
    loadDishes()
  }, [loadCategories, loadDishes])

  const openCreateCategory = () => {
    setCategoryModalMode('create')
    setEditingCategory(null)
    setCategoryModalOpen(true)
  }

  const openEditCategory = (category) => {
    setCategoryModalMode('edit')
    setEditingCategory(category)
    setCategoryModalOpen(true)
  }

  const openCreateDish = () => {
    if (!categories.length) {
      message.warning(
        'Hãy tạo ít nhất một nhóm món trước khi thêm món ăn.',
      )
      setView('categories')
      return
    }

    setDishModalMode('create')
    setEditingDish(null)
    setDishModalOpen(true)
  }

  const openEditDish = (dish) => {
    setDishModalMode('edit')
    setEditingDish(dish)
    setDishModalOpen(true)
  }

  const handleCategorySubmit = async ({
    ten_nhom,
    imageFile,
    clearImage,
  }) => {
    try {
      setSaving(true)

      if (categoryModalMode === 'edit') {
        await updateCategory(editingCategory.id, {
          ten_nhom,
          ...(clearImage ? { anh_url: '' } : {}),
        })

        if (imageFile) {
          await uploadCategoryImage(
            editingCategory.id,
            imageFile,
          )
        }

        message.success('Đã cập nhật nhóm món.')
      } else {
        const created = await createCategory({ ten_nhom })

        if (imageFile) {
          await uploadCategoryImage(created.id, imageFile)
        }

        message.success('Đã tạo nhóm món.')
      }

      setCategoryModalOpen(false)
      setEditingCategory(null)

      await loadCategories(false)
    } catch (error) {
      message.error(
        getErrorMessage(
          error,
          'Không thể lưu nhóm món.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDishSubmit = async (payload) => {
    try {
      setSaving(true)

      const {
        imageFile,
        clearImage,
        ...dishPayload
      } = payload

      let imageUploadError = null

      if (dishModalMode === 'edit') {
        await updateDish(editingDish.id, {
          ...dishPayload,
          ...(clearImage ? { anh_url: '' } : {}),
        })

        if (imageFile) {
          try {
            await uploadDishImage(editingDish.id, imageFile)
          } catch (error) {
            imageUploadError = error
          }
        }

        message.success('Đã cập nhật món ăn.')
      } else {
        const created = await createDish(dishPayload)

        if (imageFile) {
          try {
            await uploadDishImage(created.id, imageFile)
          } catch (error) {
            imageUploadError = error
          }
        }

        message.success('Đã thêm món ăn.')
      }

      await loadDishes(false)
      setDishModalOpen(false)
      setEditingDish(null)

      if (imageUploadError) {
        message.warning(`Món đã được lưu nhưng ảnh chưa tải lên: ${getErrorMessage(imageUploadError, 'kiểm tra định dạng ảnh')}`)
      }
    } catch (error) {
      message.error(
        getErrorMessage(
          error,
          'Không thể lưu món ăn.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (category, active) => {
    const previousCategories = categories

    setUpdatingStatusId(category.id)

    setCategories((current) =>
      current.map((item) =>
        item.id === category.id
          ? { ...item, dang_su_dung: active }
          : item,
      ),
    )

    try {
      await updateCategoryStatus(
        category.id,
        active,
      )

      message.success(
        active
          ? `Đã bật "${category.ten_nhom}".`
          : `Đã tắt "${category.ten_nhom}".`,
      )
    } catch (error) {
      setCategories(previousCategories)

      message.error(
        getErrorMessage(
          error,
          'Không thể thay đổi trạng thái nhóm món.',
        ),
      )
    } finally {
      setUpdatingStatusId(null)
    }
  }

  const handleSaveReorder = async () => {
    if (!reorderDirty) return

    try {
      setSaving(true)

      await reorderCategories(
        categories.map((category, index) => ({
          id: category.id,
          thu_tu: index + 1,
        })),
      )

      message.success('Đã lưu thứ tự nhóm món.')

      await loadCategories(false)
    } catch (error) {
      message.error(
        getErrorMessage(
          error,
          'Không thể lưu thứ tự nhóm món.',
        ),
      )

      await loadCategories(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCategory = async () => {
    if (!deleteTarget) return

    try {
      setDeleting(true)

      await deleteCategory(deleteTarget.id)

      message.success(
        `Đã xóa nhóm "${deleteTarget.ten_nhom}".`,
      )

      setDeleteTarget(null)

      await Promise.all([
        loadCategories(false),
        loadDishes(false),
      ])
    } catch (error) {
      message.error(
        getErrorMessage(
          error,
          'Không thể xóa nhóm món.',
        ),
      )
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteDish = async () => {
    if (!deleteDishTarget) return

    try {
      setDeletingDish(true)

      await deleteDish(deleteDishTarget.id)

      message.success(
        `Đã xóa món "${deleteDishTarget.ten_mon}".`,
      )

      setDeleteDishTarget(null)

      await loadDishes(false)
    } catch (error) {
      message.error(
        getErrorMessage(
          error,
          'Không thể xóa món ăn.',
        ),
      )
    } finally {
      setDeletingDish(false)
    }
  }

  const activeCount = categories.filter(
    (category) => category.dang_su_dung,
  ).length

  return (
    <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px' }}>
      {/* Header trang */}
      <Row justify="space-between" align="middle" style={{ marginBottom: '20px' }}>
        <Col>
          <Text type="danger" style={{ fontWeight: 700, fontSize: '11px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            RESTAURANT MENU
          </Text>
          <Title level={2} style={{ margin: 0, color: '#0f172a' }}>Thực đơn</Title>
          <Text type="secondary" style={{ fontSize: '13px' }}>
            Quản lý nhóm món và các món ăn thuộc từng nhóm.
          </Text>
        </Col>

        <Col>
          <Space size="middle" wrap>
            {view === 'categories' && reorderDirty && (
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={saving}
                onClick={handleSaveReorder}
                style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
              >
                Lưu thứ tự
              </Button>
            )}

            <Button
              type="primary"
              size="large"
              icon={<PlusOutlined />}
              onClick={
                view === 'categories'
                  ? openCreateCategory
                  : openCreateDish
              }
              style={{ backgroundColor: '#c2410c', borderColor: '#c2410c', borderRadius: '8px' }}
            >
              {view === 'categories'
                ? 'Thêm nhóm món'
                : 'Thêm món ăn'}
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Thẻ thống kê */}
      <Row gutter={[16, 16]} style={{ marginBottom: '20px' }}>
        <Col xs={24} sm={8}>
          <Card bordered style={{ borderRadius: '12px', borderColor: '#e2e8f0' }} bodyStyle={{ padding: '16px' }}>
            <Row justify="space-between" align="middle">
              <Col>
                <Text type="secondary" style={{ fontSize: '13px' }}>Tổng nhóm món</Text>
                <Title level={3} style={{ margin: 0, marginTop: '4px' }}>{categories.length}</Title>
              </Col>
              <Col style={{ backgroundColor: '#fff7ed', padding: '12px', borderRadius: '10px', color: '#c2410c' }}>
                <AppstoreOutlined style={{ fontSize: '22px' }} />
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} sm={8}>
          <Card bordered style={{ borderRadius: '12px', borderColor: '#e2e8f0' }} bodyStyle={{ padding: '16px' }}>
            <Row justify="space-between" align="middle">
              <Col>
                <Text type="secondary" style={{ fontSize: '13px' }}>Đang sử dụng</Text>
                <Title level={3} style={{ margin: 0, marginTop: '4px', color: '#16a34a' }}>{activeCount}</Title>
              </Col>
              <Col style={{ backgroundColor: '#f0fdf4', padding: '12px', borderRadius: '10px', color: '#16a34a' }}>
                <CheckCircleOutlined style={{ fontSize: '22px' }} />
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} sm={8}>
          <Card bordered style={{ borderRadius: '12px', borderColor: '#e2e8f0' }} bodyStyle={{ padding: '16px' }}>
            <Row justify="space-between" align="middle">
              <Col>
                <Text type="secondary" style={{ fontSize: '13px' }}>Tổng món ăn</Text>
                <Title level={3} style={{ margin: 0, marginTop: '4px' }}>{dishes.length}</Title>
              </Col>
              <Col style={{ backgroundColor: '#eff6ff', padding: '12px', borderRadius: '10px', color: '#2563eb' }}>
                <UnorderedListOutlined style={{ fontSize: '22px' }} />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Panel quản lý chính */}
      <Card
        bordered
        style={{ borderRadius: '12px', borderColor: '#e2e8f0', marginBottom: '20px' }}
        bodyStyle={{ padding: '20px' }}
        title={
          <Space direction="vertical" size={2}>
            <Space align="center">
              <UnorderedListOutlined style={{ color: '#c2410c' }} />
              <Text bold style={{ fontSize: '16px', color: '#0f172a' }}>Thực đơn</Text>
            </Space>
            <Text type="secondary" style={{ fontSize: '12px', fontWeight: 'normal' }}>
              Luồng dữ liệu: Nhóm món → Món ăn thuộc nhóm.
            </Text>
          </Space>
        }
        extra={
          <Space size="middle" wrap>
            <Segmented
              options={[
                { label: 'Nhóm món', value: 'categories' },
                { label: 'Món ăn', value: 'dishes' },
              ]}
              value={view}
              onChange={setView}
            />

            <Button
              type="text"
              icon={<ReloadOutlined />}
              loading={
                view === 'categories'
                  ? loading
                  : dishesLoading
              }
              onClick={() =>
                view === 'categories'
                  ? loadCategories()
                  : loadDishes()
              }
            >
              Làm mới
            </Button>
          </Space>
        }
      >
        {/* Bộ lọc nhóm món */}
        {view === 'categories' && (
          <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <Space align="center" size="small">
              <FilterOutlined style={{ color: '#64748b' }} />
              <Text style={{ fontSize: '13px', color: '#475569' }}>Lọc nhóm:</Text>
            </Space>

            <Segmented
              options={FILTER_OPTIONS}
              value={filter}
              onChange={setFilter}
            />
          </div>
        )}

        {view === 'categories' ? (
          <CategoryList
            categories={categories}
            loading={loading}
            filter={filter}
            reorderDirty={reorderDirty}
            updatingStatusId={updatingStatusId}
            onEdit={openEditCategory}
            onDelete={setDeleteTarget}
            onStatusChange={handleStatusChange}
            dishes={dishes}
            onReorder={(next) => {
              setCategories(next)
              setReorderDirty(true)
            }}
          />
        ) : (
          <DishList
            dishes={dishes}
            loading={dishesLoading}
            categories={categories}
            onEdit={openEditDish}
            onDelete={setDeleteDishTarget}
          />
        )}
      </Card>

      {/* Lưu ý hệ thống */}
      <Card
        style={{ backgroundColor: '#fffbebe6', borderColor: '#fef3c7', borderRadius: '12px' }}
        bodyStyle={{ padding: '14px 18px' }}
      >
        <Space align="start" size="middle">
          <InfoCircleOutlined style={{ fontSize: '18px', color: '#b45309', marginTop: '2px' }} />
          <div>
            <Text bold style={{ color: '#78350f', display: 'block', fontSize: '13px' }}>
              Mỗi món ăn bắt buộc thuộc một nhóm món
            </Text>
            <Text style={{ color: '#92400e', fontSize: '12px' }}>
              Backend lưu <code>mon_an.nhom_mon_id</code> làm khóa ngoại tới <code>nhom_mon.id</code>. Vì vậy không thể tạo món ăn mà không chọn nhóm.
            </Text>
          </div>
        </Space>
      </Card>

      {/* Modals Form & Delete */}
      <CategoryFormModal
        open={categoryModalOpen}
        mode={categoryModalMode}
        category={editingCategory}
        loading={saving}
        onCancel={() => setCategoryModalOpen(false)}
        onSubmit={handleCategorySubmit}
      />

      <DishFormModal
        open={dishModalOpen}
        mode={dishModalMode}
        dish={editingDish}
        categories={categories}
        loading={saving}
        onCancel={() => setDishModalOpen(false)}
        onSubmit={handleDishSubmit}
      />

      <Modal
        open={Boolean(deleteTarget)}
        title="Xóa nhóm món?"
        okText="Xóa nhóm món"
        cancelText="Hủy"
        okButtonProps={{ danger: true }}
        confirmLoading={deleting}
        onCancel={() =>
          !deleting && setDeleteTarget(null)
        }
        onOk={handleDeleteCategory}
        centered
      >
        <Paragraph style={{ margin: 0 }}>
          Bạn có chắc muốn xóa nhóm <strong>{deleteTarget?.ten_nhom}</strong>?
        </Paragraph>
        <div style={{ color: '#e11d48', backgroundColor: '#fff1f2', padding: '12px', borderRadius: '8px', border: '1px solid #ffe4e6', fontSize: '13px', marginTop: '12px' }}>
          Nếu nhóm đang chứa món ăn, hệ thống sẽ không cho phép xóa. Hãy chuyển hoặc xóa các món trong nhóm trước.
        </div>
      </Modal>

      <Modal
        open={Boolean(deleteDishTarget)}
        title="Xóa món ăn?"
        okText="Xóa món"
        cancelText="Hủy"
        okButtonProps={{ danger: true }}
        confirmLoading={deletingDish}
        onCancel={() =>
          !deletingDish && setDeleteDishTarget(null)
        }
        onOk={handleDeleteDish}
        centered
      >
        <Paragraph style={{ margin: 0 }}>
          Bạn có chắc muốn xóa món <strong>{deleteDishTarget?.ten_mon}</strong>?
        </Paragraph>
      </Modal>
    </section>
  )
}

function getErrorMessage(error, fallback) {
  const status = error?.response?.status
  const detail = error?.response?.data?.detail

  if (status === 401) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
  }

  if (status === 403) {
    return 'Bạn không có quyền thực hiện thao tác này.'
  }

  if (status === 409 || status === 422) {
    return detail || 'Dữ liệu chưa hợp lệ.'
  }

  return typeof detail === 'string'
    ? detail
    : fallback
}