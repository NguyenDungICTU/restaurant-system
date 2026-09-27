import {
  ArrowLeftOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'

import './RoleAccess.css'


export default function Forbidden({
  message = 'Bạn không có quyền truy cập chức năng này.',
  onBack,
}) {
  return (
    <section className="forbidden-page">
      <div className="forbidden-card">
        <div className="forbidden-code">403</div>

        <div className="forbidden-icon">
          <LockOutlined />
        </div>

        <p className="role-eyebrow">
          <SafetyCertificateOutlined />
          ACCESS DENIED
        </p>

        <h1>Không có quyền truy cập</h1>

        <p className="forbidden-message">
          {message}
        </p>

        <div className="forbidden-note">
          Quyền truy cập được kiểm tra ở phía máy chủ.
          Việc nhập trực tiếp đường dẫn không thể bỏ qua phân quyền.
        </div>

        <button
          type="button"
          className="forbidden-back"
          onClick={onBack}
        >
          <ArrowLeftOutlined />
          Quay lại màn hình được phép
        </button>
      </div>
    </section>
  )
}
