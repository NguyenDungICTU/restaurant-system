import { useCallback, useEffect, useState } from 'react'
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { App as AntdApp, Button, Modal, Segmented } from 'antd'

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

      // Always reload the complete dish list, even when the optional image
      // upload fails. The dish record must never disappear from the dish tab.
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
    <section className="menu-page p-6 bg-slate-50 min-h-screen">
      {/* Header Page */}
      <div className="page-heading menu-page-heading flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <p className="eyebrow text-xs font-bold text-amber-700 tracking-wider uppercase mb-1">
            RESTAURANT MENU
          </p>

          <h1 className="text-2xl font-bold text-slate-800 m-0">Thực đơn</h1>

          <p className="subheading text-sm text-slate-500 mt-1 mb-0">
            Quản lý nhóm món và các món ăn thuộc từng nhóm.
          </p>
        </div>

        <div className="menu-page-actions flex items-center gap-3">
          {view === 'categories' && reorderDirty && (
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={handleSaveReorder}
              className="bg-emerald-600 hover:bg-emerald-700 border-none shadow-sm"
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
            className="bg-amber-700 hover:bg-amber-800 border-none shadow-sm h-10 px-4 font-medium"
          >
            {view === 'categories'
              ? 'Thêm nhóm món'
              : 'Thêm món ăn'}
          </Button>
        </div>
      </div>

      {/* Summary Grid Cards */}
      <div className="menu-summary-grid grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="menu-summary-card bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-slate-500">Tổng nhóm món</span>
            <strong className="text-2xl font-bold text-slate-800 mt-1">{categories.length}</strong>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <AppstoreOutlined className="text-xl" />
          </div>
        </div>

        <div className="menu-summary-card bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-slate-500">Đang sử dụng</span>
            <strong className="text-2xl font-bold text-emerald-600 mt-1">{activeCount}</strong>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircleOutlined className="text-xl" />
          </div>
        </div>

        <div className="menu-summary-card bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-slate-500">Tổng món ăn</span>
            <strong className="text-2xl font-bold text-slate-800 mt-1">{dishes.length}</strong>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <UnorderedListOutlined className="text-xl" />
          </div>
        </div>
      </div>

      {/* Main Panel */}
      <div className="panel menu-management-panel bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        <div className="menu-toolbar p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          <div>
            <div className="menu-toolbar-title font-semibold text-slate-800 text-base flex items-center gap-2">
              <UnorderedListOutlined className="text-amber-600" /> Thực đơn
            </div>

            <p className="text-xs text-slate-500 mt-1 mb-0">
              Luồng dữ liệu: Nhóm món → Món ăn thuộc nhóm.
            </p>
          </div>

          <div className="menu-toolbar-actions flex items-center gap-3 flex-wrap">
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
              className="text-slate-600 hover:text-slate-800"
            >
              Làm mới
            </Button>
          </div>
        </div>

        <div className="p-5">
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
        </div>

        {view === 'categories' && (
          <div className="menu-filter-row p-4 border-t border-slate-100 bg-slate-50/30 flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500">Lọc nhóm:</span>

            <Segmented
              options={FILTER_OPTIONS}
              value={filter}
              onChange={setFilter}
            />
          </div>
        )}
      </div>

      {/* Info Banner */}
      <div className="implementation-note bg-amber-50/60 border border-amber-200/80 rounded-xl p-4 flex gap-3 text-amber-900">
        <div className="note-icon bg-amber-200 text-amber-800 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
          <InfoCircleOutlined />
        </div>

        <div className="text-xs">
          <strong className="block font-semibold text-amber-900 mb-0.5">
            Mỗi món ăn bắt buộc thuộc một nhóm món
          </strong>

          <p className="m-0 text-amber-800/80 leading-relaxed">
            Backend lưu{' '}
            <code className="bg-amber-100/80 px-1.5 py-0.5 rounded font-mono text-amber-900">
              mon_an.nhom_mon_id
            </code>{' '}
            làm khóa ngoại tới
            <code className="bg-amber-100/80 px-1.5 py-0.5 rounded font-mono text-amber-900">
              {' '}
              nhom_mon.id
            </code>
            . Vì vậy không thể tạo món ăn mà không chọn nhóm.
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

        <p className="delete-warning text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-100 mt-2">
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