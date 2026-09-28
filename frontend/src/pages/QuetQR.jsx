import { useEffect, useState } from 'react'
import { Alert, Card, Spin } from 'antd'
import { scanQR } from '../services/api'

export default function QuetQR({ token }) {
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    scanQR(token).then(data => { if (active) setResult(data) }).catch(err => {
      if (active) setError(err.response?.data?.detail || 'Không thể kiểm tra QR. Vui lòng thử lại.')
    })
    return () => { active = false }
  }, [token])
  return <main style={{ maxWidth: 560, margin: '60px auto', padding: 20 }}>
    <Card title="Thông tin bàn">
      {error ? <Alert type="error" title={error} showIcon /> : result ? <>
        <h1>Bàn {result.ma_ban}</h1>
        <p>Sức chứa: {result.suc_chua_toi_thieu}–{result.suc_chua_toi_da} khách</p>
        <p>{result.loai_ban === 'PHONG_RIENG' ? 'Phòng riêng' : 'Bàn thường'}</p>
        <Alert type="success" title="Mã QR hợp lệ." showIcon />
      </> : <Spin tip="Đang kiểm tra QR..."><div style={{ height: 80 }} /></Spin>}
    </Card>
  </main>
}
