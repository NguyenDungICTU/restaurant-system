import { useEffect, useState } from 'react'
import { getPublicCategories, getPublicDishes, getQrTableInfo } from '../services/api'

export default function TableMenu({ token }) {
  const [table, setTable] = useState(null)
  const [categories, setCategories] = useState([])
  const [dishes, setDishes] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      getQrTableInfo(token),
      getPublicCategories(),
      getPublicDishes(),
    ]).then(([tableInfo, categoryList, dishList]) => {
      setTable(tableInfo)
      setCategories(categoryList)
      setDishes(dishList)
    }).catch((requestError) => {
      setError(requestError.response?.data?.detail || 'Không tải được thực đơn.')
    })
  }, [token])

  return (
    <main className="public-menu-page">
      <header>
        <p className="eyebrow">RESTO · THỰC ĐƠN</p>
        <h1>{table ? `Bàn ${table.table_code}` : 'Đang tải bàn...'}</h1>
        {table && <p>{table.area_name} · Sức chứa {table.minimum_capacity}–{table.maximum_capacity} khách</p>}
      </header>
      {error ? <div className="login-error">{error}</div> : categories.map((category) => {
        const categoryDishes = dishes.filter((dish) => dish.nhom_mon_id === category.id)
        if (!categoryDishes.length) return null
        return (
          <section key={category.id}>
            <h2>{category.ten_nhom}</h2>
            {categoryDishes.map((dish) => (
              <article className="public-dish-row" key={dish.id}>
                <div><strong>{dish.ten_mon}</strong><p>{dish.mo_ta || ''}{dish.thoi_gian_che_bien_phut ? ` · ${dish.thoi_gian_che_bien_phut} phút` : ''}</p></div>
                <b>{new Intl.NumberFormat('vi-VN').format(dish.gia_ban)} ₫ / {dish.don_vi_tinh}</b>
              </article>
            ))}
          </section>
        )
      })}
      <p className="public-menu-help">Để gọi món hoặc cần hỗ trợ, vui lòng liên hệ nhân viên phục vụ.</p>
    </main>
  )
}
