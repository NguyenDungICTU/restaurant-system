import { useCallback, useEffect, useState } from 'react'
import {
  DeleteOutlined,
  EditOutlined,
  HolderOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  SearchOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { App as AntdApp, Button, Image, Modal, Segmented, Switch, Tag } from 'antd'

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
  getMediaUrl,
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
  const [searchTerm, setSearchTerm] = useState('')
  const [dishStatusFilter, setDishStatusFilter] = useState('all')
  const [dishPage, setDishPage] = useState(1)
  const DISHES_PER_PAGE = 10

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

  const normalizedSearch = searchTerm.trim().toLowerCase()
  const visibleCategories = categories.filter((category) => {
    if (filter === 'active' && !category.dang_su_dung) return false
    if (filter === 'inactive' && category.dang_su_dung) return false
    if (!normalizedSearch) return true
    return category.ten_nhom?.toLowerCase().includes(normalizedSearch)
  })

  const visibleDishes = dishes.filter((dish) => {
    if (dishStatusFilter !== 'all' && dish.trang_thai !== dishStatusFilter) return false
    if (!normalizedSearch) return true
    const categoryName = categories.find((category) => category.id === dish.nhom_mon_id)?.ten_nhom || ''
    return [dish.ten_mon, dish.mo_ta_ngan, dish.nhom_mon_ten, categoryName]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch))
  })
  const dishPageCount = Math.max(1, Math.ceil(visibleDishes.length / DISHES_PER_PAGE))
  const paginatedDishes = visibleDishes.slice((dishPage - 1) * DISHES_PER_PAGE, dishPage * DISHES_PER_PAGE)

  useEffect(() => {
    setDishPage(1)
  }, [view, searchTerm, dishStatusFilter])

  useEffect(() => {
    if (dishPage > dishPageCount) setDishPage(dishPageCount)
  }, [dishPage, dishPageCount])

  const handleCategoryDragStart = (event, categoryId) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('application/x-category-id', String(categoryId))
  }

  const handleCategoryDrop = (event, targetIndex) => {
    event.preventDefault()
    const categoryId = Number(event.dataTransfer.getData('application/x-category-id'))
    if (!categoryId) return
    const sourceIndex = categories.findIndex((category) => category.id === categoryId)
    if (sourceIndex === -1 || sourceIndex === targetIndex) return
    const next = [...categories]
    const [moved] = next.splice(sourceIndex, 1)
    next.splice(targetIndex, 0, moved)
    setCategories(next.map((category, index) => ({ ...category, thu_tu: index + 1 })))
    setReorderDirty(true)
  }

  const moveCategory = (index, direction) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= categories.length) return
    const next = [...categories]
    const [moved] = next.splice(index, 1)
    next.splice(targetIndex, 0, moved)
    setCategories(next.map((category, itemIndex) => ({ ...category, thu_tu: itemIndex + 1 })))
    setReorderDirty(true)
  }

  return (
    <section className="menu-page menu-redesign">
      <div className="menu-hero">
        <div className="menu-hero-copy">
          <div className="menu-breadcrumb"><span>Nhà hàng</span><b>/</b><strong>Thực đơn</strong></div>
          <p className="eyebrow">RESTAURANT MENU</p>
          <h1>Thực đơn</h1>
          <p className="subheading">Quản lý nhóm món và các món ăn thuộc từng nhóm.</p>
        </div>

        <div className="menu-hero-right">
          <div className="menu-hero-actions">
            {reorderDirty && view === 'categories' && (
              <Button icon={<SaveOutlined />} onClick={handleSaveReorder} loading={saving}>Lưu thứ tự</Button>
            )}
            <Button type="primary" icon={<PlusOutlined />} onClick={view === 'categories' ? openCreateCategory : openCreateDish}>
              {view === 'categories' ? 'Thêm nhóm món' : 'Thêm món ăn'}
            </Button>
          </div>
          <div className="menu-summary-strip">
        <div className="menu-summary-item menu-summary-item-category">
          <span className="menu-summary-dot" />
          <div><small>Tổng nhóm món</small><strong>{categories.length}</strong></div>
        </div>
            <div className="menu-summary-divider" />
            <div className="menu-summary-item menu-summary-item-dish">
              <span className="menu-summary-dot" />
              <div><small>Tổng món ăn</small><strong>{dishes.length}</strong></div>
            </div>
          </div>
        </div>
      </div>

      <div className="menu-workspace">
        <div className="menu-workspace-head">
          <div>
            <div className="menu-workspace-title"><UnorderedListOutlined /> Thực đơn</div>
            <p>Quản lý trực quan nhóm món và các món ăn trong nhà hàng.</p>
          </div>
          <Segmented
            options={[{ label: 'Nhóm món', value: 'categories' }, { label: 'Món ăn', value: 'dishes' }]}
            value={view}
            onChange={setView}
          />
        </div>

        <div className="menu-tools">
          <div className="menu-search-box">
            <SearchOutlined />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Tìm kiếm món ăn..." />
            {searchTerm && <button type="button" onClick={() => setSearchTerm('')}>×</button>}
          </div>

          {view === 'categories' ? (
            <Segmented
              options={FILTER_OPTIONS}
              value={filter}
              onChange={setFilter}
            />
          ) : (
            <Segmented
              options={[
                { label: 'Tất cả', value: 'all' },
                { label: 'Đang bán', value: 'DANG_BAN' },
                { label: 'Tạm hết', value: 'TAM_HET' },
                { label: 'Ngừng bán', value: 'NGUNG_BAN' },
              ]}
              value={dishStatusFilter}
              onChange={setDishStatusFilter}
            />
          )}

          <Button className="menu-refresh-button" icon={<ReloadOutlined />} loading={view === 'categories' ? loading : dishesLoading} onClick={() => view === 'categories' ? loadCategories() : loadDishes()}>
            Làm mới
          </Button>
        </div>

        {view === 'categories' ? (
          loading ? (
            <div className="menu-card-grid">{[1, 2, 3].map((item) => <div className="menu-card-skeleton" key={item} />)}</div>
          ) : visibleCategories.length === 0 ? (
            <div className="menu-empty-modern">Không tìm thấy nhóm món phù hợp.</div>
          ) : (
            <div className="menu-card-grid">
              {visibleCategories.map((category) => {
                const actualIndex = categories.findIndex((item) => item.id === category.id)
                const categoryDishes = dishes.filter((dish) => dish.nhom_mon_id === category.id)
                const active = category.dang_su_dung
                return (
                  <article
                    className="menu-category-card"
                    key={category.id}
                    draggable
                    onDragStart={(event) => handleCategoryDragStart(event, category.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => handleCategoryDrop(event, actualIndex)}
                  >
                    <div className="menu-card-image-wrap">
                      <Image className="menu-card-image" src={getMediaUrl(category.anh_url)} alt={category.ten_nhom} preview />
                      <span className="menu-order-badge">{String(category.thu_tu).padStart(2, '0')}</span>
                      <span className="menu-drag-badge"><HolderOutlined /></span>
                    </div>

                    <div className="menu-card-body">
                      <div className="menu-card-title-row">
                        <div>
                          <h3>{category.ten_nhom}</h3>
                          <p>{categoryDishes.length} món ăn</p>
                        </div>
                        <span className={`menu-status-pill ${active ? 'active' : 'inactive'}`}>{active ? 'Đang sử dụng' : 'Đã tắt'}</span>
                      </div>

                      <div className="menu-card-actions-row">
                        <label className={`menu-switch-label ${active ? 'is-on' : 'is-off'}`}>
                          <Switch size="small" checked={active} loading={updatingStatusId === category.id} onChange={(checked) => handleStatusChange(category, checked)} />
                          <span className="menu-switch-state">{active ? 'Đã bật' : 'Đã tắt'}</span>
                        </label>
                        <div className="menu-action-buttons">
                          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEditCategory(category)} />
                          <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => setDeleteTarget(category)} />
                        </div>
                      </div>

                      <div className="menu-card-dishes">
                        <span className="menu-card-dishes-label">MÓN TRONG NHÓM</span>
                        {categoryDishes.length ? (
                          <div className="menu-mini-dishes">
                            {categoryDishes.slice(0, 5).map((dish) => (
                              <div className="menu-mini-dish" key={dish.id}>
                                <Image src={getMediaUrl(dish.anh_url)} alt={dish.ten_mon} preview />
                                <span>{dish.ten_mon}</span>
                              </div>
                            ))}
                            {categoryDishes.length > 5 && <span className="menu-more-dishes">+{categoryDishes.length - 5} món</span>}
                          </div>
                        ) : (
                          <span className="menu-no-dishes">Chưa có món ăn</span>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )
        ) : (
          dishesLoading ? (
            <div className="menu-card-grid dish-card-grid">{[1, 2, 3].map((item) => <div className="menu-card-skeleton" key={item} />)}</div>
          ) : visibleDishes.length === 0 ? (
            <div className="menu-empty-modern">Không tìm thấy món ăn phù hợp.</div>
          ) : (
            <div className="menu-card-grid dish-card-grid">
              {paginatedDishes.map((dish) => {
                const categoryName = dish.nhom_mon_ten || categories.find((category) => category.id === dish.nhom_mon_id)?.ten_nhom || 'Không rõ nhóm'
                const statusLabel = dish.trang_thai === 'DANG_BAN' ? 'Đang bán' : dish.trang_thai === 'TAM_HET' ? 'Tạm hết' : dish.trang_thai === 'NGUNG_BAN' ? 'Ngừng bán' : 'Tạm ngừng'
                return (
                  <article className="menu-dish-card" key={dish.id}>
                    <div className="menu-dish-image-wrap">
                      <Image src={getMediaUrl(dish.anh_url)} alt={dish.ten_mon} preview />
                      <Tag color={dish.trang_thai === 'DANG_BAN' ? 'green' : dish.trang_thai === 'TAM_HET' ? 'orange' : 'default'}>{statusLabel}</Tag>
                    </div>
                    <div className="menu-dish-body">
                      <p className="menu-dish-category">{categoryName}</p>
                      <h3>{dish.ten_mon}</h3>
                      {dish.mo_ta_ngan && <p className="menu-dish-description">{dish.mo_ta_ngan}</p>}
                      <div className="menu-dish-bottom">
                        <strong>{Number(dish.gia || 0).toLocaleString('vi-VN')} đ</strong>
                        <div>
                          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEditDish(dish)} />
                          <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => setDeleteDishTarget(dish)} />
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )
        )}

        {view === 'dishes' && !dishesLoading && visibleDishes.length > 0 && (
          <div className="menu-pagination" aria-label="Phân trang món ăn">
            <span>Hiển thị {(dishPage - 1) * DISHES_PER_PAGE + 1}–{Math.min(dishPage * DISHES_PER_PAGE, visibleDishes.length)} / {visibleDishes.length} món</span>
            <div className="menu-pagination-controls">
              <button type="button" disabled={dishPage === 1} onClick={() => setDishPage((page) => Math.max(1, page - 1))}>Trước</button>
              {Array.from({ length: dishPageCount }, (_, index) => index + 1).map((page) => (
                <button type="button" key={page} className={page === dishPage ? 'is-current' : ''} aria-current={page === dishPage ? 'page' : undefined} onClick={() => setDishPage(page)}>{page}</button>
              ))}
              <button type="button" disabled={dishPage === dishPageCount} onClick={() => setDishPage((page) => Math.min(dishPageCount, page + 1))}>Sau</button>
            </div>
          </div>
        )}
      </div>

      <div className="implementation-note">
        <div className="note-icon">i</div>
        <div>
          <strong>Mỗi món ăn bắt buộc thuộc một nhóm món</strong>
          <p>Backend lưu <code>mon_an.nhom_mon_id</code> làm khóa ngoại tới <code>nhom_mon.id</code>. Giao diện này chỉ thay đổi cách hiển thị, không thay đổi API hay dữ liệu backend.</p>
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
        onCancel={() => !deleting && setDeleteTarget(null)}
        onOk={handleDeleteCategory}
        centered
      >
        <p>Bạn có chắc muốn xóa nhóm <strong>{deleteTarget?.ten_nhom}</strong>?</p>
        <p className="delete-warning">Nếu nhóm đang chứa món ăn, hệ thống sẽ không cho phép xóa. Hãy chuyển hoặc xóa các món trong nhóm trước.</p>
      </Modal>

      <Modal
        open={Boolean(deleteDishTarget)}
        title="Xóa món ăn?"
        okText="Xóa món"
        cancelText="Hủy"
        okButtonProps={{ danger: true }}
        confirmLoading={deletingDish}
        onCancel={() => !deletingDish && setDeleteDishTarget(null)}
        onOk={handleDeleteDish}
        centered
      >
        <p>Bạn có chắc muốn xóa món <strong>{deleteDishTarget?.ten_mon}</strong>?</p>
      </Modal>
    </section>
  )}

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

