import { useCallback, useEffect, useState } from 'react'
import {
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { App as AntdApp, Button, Modal, Segmented } from 'antd'

import {
  createCategory,
  deleteCategory,
  uploadCategoryImage,
  getCategories,
  reorderCategories,
  updateCategory,
  updateCategoryStatus,
  getDishes,
  createDish,
  updateDish,
  deleteDish,
  uploadDishImage,
} from '../services/api'

import CategoryFormModal from '../components/menu/CategoryFormModal'
import CategoryList from '../components/menu/CategoryList'
import DishFormModal from '../components/menu/DishFormModal'
import DishList from '../components/menu/DishList'

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

      if (dishModalMode === 'edit') {
        await updateDish(editingDish.id, {
          ...dishPayload,
          ...(clearImage ? { anh_url: '' } : {}),
        })

        if (imageFile) {
          await uploadDishImage(
            editingDish.id,
            imageFile,
          )
        }

        message.success('Đã cập nhật món ăn.')
      } else {
        const created = await createDish(dishPayload)

        if (imageFile) {
          await uploadDishImage(
            created.id,
            imageFile,
          )
        }

        message.success('Đã thêm món ăn vào nhóm.')
      }

      setDishModalOpen(false)
      setEditingDish(null)

      await loadDishes(false)
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
    <section className="menu-page">
      <div className="page-heading menu-page-heading">
        <div>
          <p className="eyebrow">RESTAURANT MENU</p>

          <h1>Thực đơn</h1>

          <p className="subheading">
            Quản lý nhóm món và các món ăn thuộc từng nhóm.
          </p>
        </div>

        <div className="menu-page-actions">
          {view === 'categories' && reorderDirty && (
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={handleSaveReorder}
            >
              Lưu thứ tự
            </Button>
          )}

          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={
              view === 'categories'
                ? openCreateCategory
                : openCreateDish
            }
          >
            {view === 'categories'
              ? 'Thêm nhóm món'
              : 'Thêm món ăn'}
          </Button>
        </div>
      </div>

      <div className="menu-summary-grid">
        <div className="menu-summary-card">
          <span>Tổng nhóm món</span>
          <strong>{categories.length}</strong>
        </div>

        <div className="menu-summary-card">
          <span>Đang sử dụng</span>
          <strong>{activeCount}</strong>
        </div>

        <div className="menu-summary-card">
          <span>Tổng món ăn</span>
          <strong>{dishes.length}</strong>
        </div>
      </div>

      <div className="panel menu-management-panel">
        <div className="menu-toolbar">
          <div>
            <div className="menu-toolbar-title">
              <UnorderedListOutlined /> Thực đơn
            </div>

            <p>
              Luồng dữ liệu: Nhóm món → Món ăn thuộc nhóm.
            </p>
          </div>

          <div className="menu-toolbar-actions">
            <Segmented
              options={[
                {
                  label: 'Nhóm món',
                  value: 'categories',
                },
                {
                  label: 'Món ăn',
                  value: 'dishes',
                },
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
          </div>
        </div>

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

        {view === 'categories' && (
          <div className="menu-filter-row">
            <span>Lọc nhóm:</span>

            <Segmented
              options={FILTER_OPTIONS}
              value={filter}
              onChange={setFilter}
            />
          </div>
        )}
      </div>

      <div className="implementation-note">
        <div className="note-icon">i</div>

        <div>
          <strong>
            Mỗi món ăn bắt buộc thuộc một nhóm món
          </strong>

          <p>
            Backend lưu{' '}
            <code>mon_an.nhom_mon_id</code> làm khóa ngoại tới
            <code> nhom_mon.id</code>. Vì vậy không thể tạo món
            ăn mà không chọn nhóm.
          </p>
        </div>
      </div>

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
        <p>
          Bạn có chắc muốn xóa nhóm{' '}
          <strong>{deleteTarget?.ten_nhom}</strong>?
        </p>

        <p className="delete-warning">
          Nếu nhóm đang chứa món ăn, hệ thống sẽ không cho phép
          xóa. Hãy chuyển hoặc xóa các món trong nhóm trước.
        </p>
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
        <p>
          Bạn có chắc muốn xóa món{' '}
          <strong>{deleteDishTarget?.ten_mon}</strong>?
        </p>
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

