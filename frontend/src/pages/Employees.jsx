import { useEffect, useMemo, useState } from 'react'
import {
  TeamOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  UserDeleteOutlined,
  SearchOutlined,
  PlusOutlined,
  StopOutlined,
  ReloadOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  CloseOutlined,
  CopyOutlined,
  EyeInvisibleOutlined,
  PhoneOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  LeftOutlined,
  RightOutlined
} from '@ant-design/icons'
import {
  changeEmployeeStatus,
  checkEmployeePhone,
  checkEmployeeUsername,
  createEmployee,
  getEmployees
} from '../services/api'
const roles = {
  QUAN_LY: 'Quản lý',
  PHUC_VU: 'Phục vụ',
  BEP: 'Bếp',
  THU_NGAN: 'Thu ngân'
}
const statuses = {
  HOAT_DONG: 'Đang làm việc',
  DA_NGHI: 'Đã nghỉ việc'
}
const empty = {
  full_name: '',
  phone: '',
  username: '',
  role: 'PHUC_VU',
  status: 'HOAT_DONG'
}
function getErrorMessage(error, fallback) {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map(x => x.msg || JSON.stringify(x)).join('; ')
  }
  return (
    detail?.message ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  )
}
function FieldState({ state, checking, ok, bad }) {
  if (checking) {
    return <small className="field-state">Đang kiểm tra...</small>
  }
  if (state === true) {
    return <small className="field-state valid">✓ {ok}</small>
  }
  if (state === false) {
    return <small className="field-state invalid">✕ {bad}</small>
  }
  return null
}
// Chỉ lưu thay đổi hiển thị trên trình duyệt; không thay đổi database.
const LOCAL_KEY = 'restaurant_employee_frontend_changes_v1'
function readLocalChanges() {
  try {
    const saved = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}')
    return {
      edits: saved?.edits && typeof saved.edits === 'object' ? saved.edits : {},
      deleted: Array.isArray(saved?.deleted) ? saved.deleted.map(String) : []
    }
  } catch {
    return { edits: {}, deleted: [] }
  }
}
function saveLocalChanges(changes) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(changes))
}
function applyLocalChanges(employees) {
  const { edits, deleted } = readLocalChanges()
  return employees
    .filter(employee => !deleted.includes(String(employee.id)))
    .map(employee => ({ ...employee, ...(edits[String(employee.id)] || {}) }))
}
export default function Employees() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [role, setRole] = useState('ALL')
  const [status, setStatus] = useState('ALL')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ ...empty })
  const [checking, setChecking] = useState({})
  const [availability, setAvailability] = useState({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [created, setCreated] = useState(null)
  const [showPass, setShowPass] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [editForm, setEditForm] = useState({ ...empty })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [busyIds, setBusyIds] = useState([])
  const pageSize = 8
  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await getEmployees()
      setItems(applyLocalChanges(Array.isArray(data) ? data : []))
    } catch (e) {
      setError(
        getErrorMessage(e, 'Không tải được danh sách nhân viên.')
      )
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [])
  const stats = useMemo(() => ({
    total: items.length,
    active: items.filter(x => x.status === 'HOAT_DONG').length,
    other: items.filter(
      x => x.status !== 'HOAT_DONG' && x.status !== 'DA_NGHI'
    ).length,
    left: items.filter(x => x.status === 'DA_NGHI').length
  }), [items])
  const filtered = useMemo(() => {
    const search = q.trim().toLowerCase()
    return items.filter(x => {
      const matchSearch =
        !search ||
        [x.full_name, x.phone, x.username].some(value =>
          String(value ?? '').toLowerCase().includes(search)
        )
      return (
        matchSearch &&
        (role === 'ALL' || x.role === role) &&
        (status === 'ALL' || x.status === status)
      )
    })
  }, [items, q, role, status])
  const pageCount = Math.max(
    1,
    Math.ceil(filtered.length / pageSize)
  )
  const currentPage = Math.min(page, pageCount)
  const visible = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )
  function setField(key, value) {
    setForm(previous => ({
      ...previous,
      [key]: value
    }))
    if (key === 'phone' || key === 'username') {
      setAvailability(previous => ({
        ...previous,
        [key]: undefined
      }))
    }
  }
  async function verify(key) {
    const value = String(form[key] || '').trim()
    if (!value) return
    setChecking(previous => ({
      ...previous,
      [key]: true
    }))
    try {
      const result = key === 'phone'
        ? await checkEmployeePhone(value)
        : await checkEmployeeUsername(value)
      setAvailability(previous => ({
        ...previous,
        [key]: result.available
      }))
    } catch {
      setAvailability(previous => ({
        ...previous,
        [key]: undefined
      }))
    } finally {
      setChecking(previous => ({
        ...previous,
        [key]: false
      }))
    }
  }
  async function submit(event) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setFormError('')
    try {
      const result = await createEmployee({
        ...form,
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        username: form.username.trim()
      })
      setCreated(result)
      setShowPass(false)
      setOpen(false)
      setForm({ ...empty })
      setAvailability({})
      await load()
    } catch (e) {
      const detail = e?.response?.data?.detail
      if (detail?.field) {
        setAvailability(previous => ({
          ...previous,
          [detail.field]: false
        }))
      }
      setFormError(
        getErrorMessage(e, 'Không thể tạo tài khoản nhân viên.')
      )
    } finally {
      setSaving(false)
    }
  }
  async function toggle(emp) {
    if (busyIds.includes(emp.id)) return
    const nextStatus = emp.status === 'DA_NGHI'
      ? 'HOAT_DONG'
      : 'DA_NGHI'
    const action = nextStatus === 'HOAT_DONG'
      ? 'cho nhân viên làm lại'
      : 'cho nhân viên nghỉ việc'
    if (!window.confirm(
      `Bạn có chắc muốn ${action}: ${emp.full_name}?`
    )) return
    setBusyIds(previous => [...previous, emp.id])
    try {
      await changeEmployeeStatus(emp.id, nextStatus)
      const changes = readLocalChanges()
      const key = String(emp.id)
      if (changes.edits[key]) {
        delete changes.edits[key].status
        saveLocalChanges(changes)
      }
      await load()
    } catch (e) {
      alert(
        getErrorMessage(e, 'Không thể cập nhật trạng thái nhân viên.')
      )
    } finally {
      setBusyIds(previous =>
        previous.filter(id => id !== emp.id)
      )
    }
  }
  function openEdit(emp) {
    setEditingEmployee(emp)
    setEditForm({
      full_name: emp.full_name || '',
      phone: emp.phone || '',
      username: emp.username || '',
      role: emp.role || 'PHUC_VU',
      status: emp.status || 'HOAT_DONG'
    })
    setEditError('')
  }

  function saveEdit(event) {
    event.preventDefault()
    if (!editingEmployee || editSaving) return
    setEditError('')
    const updated = {
      full_name: editForm.full_name.trim().replace(/\s+/g, ' '),
      phone: editForm.phone.trim().replace(/[\s().-]/g, '').replace(/^\+84/, '0'),
      username: editForm.username.trim().toLowerCase(),
      role: editForm.role,
      status: editForm.status
    }
    if (updated.full_name.length < 2 || updated.full_name.length > 100) {
      setEditError('Họ tên phải từ 2 đến 100 ký tự.')
      return
    }
    if (!/^0\d{8,10}$/.test(updated.phone)) {
      setEditError('Số điện thoại không hợp lệ.')
      return
    }
    if (!/^[a-z0-9._-]{3,50}$/.test(updated.username)) {
      setEditError('Tên đăng nhập phải từ 3 đến 50 ký tự, chỉ dùng chữ thường không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.')
      return
    }
    if (items.some(x => x.id !== editingEmployee.id && x.username === updated.username)) {
      setEditError('Tên đăng nhập đã có trong danh sách.')
      return
    }
    if (items.some(x => x.id !== editingEmployee.id && x.phone === updated.phone)) {
      setEditError('Số điện thoại đã có trong danh sách.')
      return
    }
    try {
      const changes = readLocalChanges()
      const key = String(editingEmployee.id)
      changes.edits[key] = { ...(changes.edits[key] || {}), ...updated }
      saveLocalChanges(changes)
      setItems(previous => previous.map(x => x.id === editingEmployee.id ? { ...x, ...updated } : x))
      setEditingEmployee(null)
    } catch {
      setEditError('Không thể lưu trên trình duyệt. Hãy kiểm tra bộ nhớ trình duyệt.')
    }
  }

  function deleteEmployee(emp) {
    if (busyIds.includes(emp.id)) return
    if (!window.confirm(`Bạn có chắc muốn xóa "${emp.full_name}" khỏi danh sách trên trình duyệt này? Dữ liệu trên máy chủ sẽ KHÔNG bị xóa.`)) return
    try {
      const changes = readLocalChanges()
      const key = String(emp.id)
      if (!changes.deleted.includes(key)) changes.deleted.push(key)
      delete changes.edits[key]
      saveLocalChanges(changes)
      setItems(previous => previous.filter(x => x.id !== emp.id))
      setSelectedEmployee(previous => previous?.id === emp.id ? null : previous)
    } catch {
      alert('Không thể lưu thay đổi trên trình duyệt.')
    }
  }

  async function copy(value) {
    try {
      await navigator.clipboard.writeText(String(value ?? ''))
    } catch {
      alert('Không thể sao chép.')
    }
  }
  function openCreate() {
    setForm({ ...empty })
    setFormError('')
    setAvailability({})
    setOpen(true)
  }
  return (
    <>
      <style>{`
        .employee-dashboard {
          padding: 24px;
          min-height: 100%;
          background: #f6f8fc;
          color: #17233d;
          font-family: inherit;
        }
        .employee-dashboard * {
          box-sizing: border-box;
        }
        .employee-heading {
          display: flex;
          align-items: center;
          gap: 18px;
          margin-bottom: 24px;
        }
        .employee-title-icon {
          width: 62px;
          height: 62px;
          border-radius: 16px;
          background: #fff0f0;
          color: #ef4444;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          flex-shrink: 0;
        }
        .employee-heading h1 {
          font-size: 25px;
          font-weight: 750;
          color: #14213b;
          margin: 0 0 7px;
        }
        .employee-heading p {
          font-size: 13px;
          color: #8290a6;
          margin: 0;
        }
        .employee-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          background: #f0444b;
          color: white;
          border: none;
          border-radius: 9px;
          padding: 12px 19px;
          font-size: 13px;
          font-weight: 650;
          cursor: pointer;
          transition: .2s;
          white-space: nowrap;
        }
        .employee-primary:hover {
          background: #dc3038;
          transform: translateY(-1px);
          box-shadow: 0 5px 15px #f0444b30;
        }
        .employee-primary:disabled {
          opacity: .55;
          cursor: not-allowed;
          transform: none;
        }
        .employee-add-button {
          margin-left: auto;
        }
        .employee-dashboard-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }
        .employee-dashboard-card {
          background: #fff;
          border: 1px solid #edf0f5;
          border-radius: 14px;
          min-height: 111px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 15px;
          box-shadow: 0 5px 18px #1c315009;
        }
        .employee-dashboard-icon {
          width: 54px;
          height: 54px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 23px;
          flex-shrink: 0;
        }
        .employee-dashboard-card.total .employee-dashboard-icon {
          color: #ef4444;
          background: #fff0f1;
        }
        .employee-dashboard-card.active .employee-dashboard-icon {
          color: #0ba76c;
          background: #e5f8ef;
        }
        .employee-dashboard-card.other .employee-dashboard-icon {
          color: #f3a300;
          background: #fff5dd;
        }
        .employee-dashboard-card.inactive .employee-dashboard-icon {
          color: #ef4444;
          background: #fff0f1;
        }
        .employee-dashboard-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }
        .employee-dashboard-info span {
          font-size: 12px;
          color: #526078;
          font-weight: 550;
        }
        .employee-dashboard-info strong {
          font-size: 27px;
          line-height: 1.15;
          font-weight: 750;
          color: #17233d;
        }
        .employee-dashboard-info small {
          color: #99a5b7;
          font-size: 11px;
        }
        .employee-panel {
          background: white;
          border: 1px solid #edf0f5;
          border-radius: 15px;
          box-shadow: 0 5px 20px #20305009;
          overflow: hidden;
        }
        .employee-filters {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 17px 19px;
        }
        .employee-search {
          flex: 1;
          min-width: 180px;
          display: flex;
          align-items: center;
          gap: 10px;
          height: 43px;
          padding: 0 14px;
          border: 1px solid #e0e6ef;
          border-radius: 8px;
          color: #8c9bb2;
          background: #fff;
        }
        .employee-search:focus-within {
          border-color: #f07a7e;
          box-shadow: 0 0 0 3px #f0444b10;
        }
        .employee-search input {
          border: none;
          outline: none;
          background: transparent;
          width: 100%;
          font-size: 13px;
          color: #17233d;
        }
        .employee-search input::placeholder {
          color: #a3aec0;
        }
        .employee-filters select {
          height: 43px;
          min-width: 155px;
          padding: 0 13px;
          background: white;
          border: 1px solid #e0e6ef;
          border-radius: 8px;
          font-size: 12px;
          color: #33415b;
          cursor: pointer;
          outline: none;
        }
        .employee-filters select:focus {
          border-color: #f07a7e;
        }
        .employee-table-wrap {
          width: 100%;
          overflow-x: auto;
        }
        .employee-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          min-width: 850px;
        }
        .employee-table thead {
          background: #f8f9fc;
        }
        .employee-table th {
          padding: 17px 16px;
          color: #26334c;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
          border-top: 1px solid #edf0f5;
          border-bottom: 1px solid #edf0f5;
        }
        .employee-table td {
          padding: 15px 16px;
          font-size: 12.5px;
          color: #46546c;
          border-bottom: 1px solid #edf0f5;
          vertical-align: middle;
        }
        .employee-table tbody tr {
          transition: background .2s;
        }
        .employee-table tbody tr:hover {
          background: #fafbff;
        }
        .employee-table th:first-child,
        .employee-table td:first-child {
          width: 65px;
          text-align: center;
        }
        .employee-table th:last-child,
        .employee-table td:last-child {
          text-align: center;
          width: 190px;
        }
        .employee-name-cell {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .employee-initials {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #eaf0ff;
          color: #416ac5;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
          flex-shrink: 0;
        }
        .employee-name-text {
          font-weight: 650;
          color: #192840;
          font-size: 13px;
        }
        .employee-phone {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .employee-phone svg {
          color: #8b99ae;
        }
        .employee-username {
          color: #52627d;
        }
        .role-badge {
          display: inline-flex;
          align-items: center;
          padding: 7px 11px;
          border-radius: 7px;
          font-size: 11px;
          font-weight: 650;
          white-space: nowrap;
        }
        .role-quan_ly {
          background: #fff0f0;
          color: #ed444b;
        }
        .role-phuc_vu {
          background: #eaf2ff;
          color: #2874e7;
        }
        .role-thu_ngan {
          background: #f1eaff;
          color: #8652d6;
        }
        .role-bep {
          background: #e6f8ee;
          color: #16a269;
        }
        .work-status {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 7px;
          padding: 8px 11px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
        }
        .work-status i {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .work-status.working {
          background: #e8f9f1;
          color: #147c59;
        }
        .work-status.working i {
          background: #0db475;
        }
        .work-status.left {
          background: #fff0f0;
          color: #ba454b;
        }
        .work-status.left i {
          background: #f0444b;
        }
        .employee-action-buttons {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
        }
        .employee-action-btn {
          width: 33px;
          height: 33px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid transparent;
          border-radius: 8px;
          cursor: pointer;
          font-size: 15px;
          transition: .2s;
        }
        .employee-action-btn.stop {
          background: #fff0f2;
          color: #f04459;
          border-color: #ffdce2;
        }
        .employee-action-btn.enable {
          background: #e8f9ef;
          color: #0ca76c;
          border-color: #cef0df;
        }
        .employee-action-btn.view {
          background: #eaf5ff;
          color: #1684eb;
          border-color: #d7eaff;
        }
          .employee-action-btn.edit { background: #fff6e6; color: #d97706; border-color: #fde5b7; }
          .employee-action-btn.delete { background: #fff0f0; color: #e0444b; border-color: #ffd9dc; }
          .employee-table th, .employee-table td { font-size: 13px; }
        .employee-action-btn:hover {
          transform: translateY(-2px);
          filter: brightness(.97);
        }
        .employee-action-btn:disabled {
          opacity: .4;
          cursor: not-allowed;
        }
        .employee-pagination {
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          font-size: 12px;
          color: #8b98ad;
        }
        .employee-pagination-controls {
          display: flex;
          align-items: center;
          gap: 9px;
        }
        .employee-pagination-controls button {
          width: 32px;
          height: 32px;
          border-radius: 7px;
          border: 1px solid #e8ecf3;
          background: #fff;
          color: #68758d;
          cursor: pointer;
        }
        .employee-pagination-controls button:disabled {
          opacity: .35;
          cursor: not-allowed;
        }
        .employee-page-current {
          width: 32px;
          height: 32px;
          border-radius: 7px;
          background: #f0444b;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
        }
        .table-empty {
          text-align: center !important;
          padding: 45px !important;
          color: #9aa6b8 !important;
        }
        .employee-error {
          background: #fff1f2;
          border: 1px solid #ffd5da;
          color: #d72e41;
          padding: 11px 13px;
          border-radius: 8px;
          font-size: 12px;
          margin: 10px 0;
        }
        .employee-overlay {
          position: fixed;
          inset: 0;
          background: #11182799;
          backdrop-filter: blur(3px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 20px;
        }
        .employee-modal {
          background: #fff;
          width: 100%;
          max-width: 570px;
          max-height: 92vh;
          overflow-y: auto;
          border-radius: 17px;
          padding: 29px;
          position: relative;
          box-shadow: 0 20px 70px #101b3030;
        }
        .employee-modal h2 {
          font-size: 21px;
          color: #17233d;
          margin: 0 0 8px;
          font-weight: 750;
        }
        .employee-modal-subtitle {
          font-size: 12px;
          color: #8d9aaf;
          margin: 0 0 25px;
        }
        .modal-close {
          position: absolute;
          right: 20px;
          top: 20px;
          border: none;
          background: #f4f6fa;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          cursor: pointer;
          color: #68758d;
        }
        .employee-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
        }
        .employee-form-grid label {
          display: flex;
          flex-direction: column;
          gap: 8px;
          color: #33415b;
          font-size: 12px;
          font-weight: 650;
        }
        .employee-form-grid label em {
          color: #ef4444;
          font-style: normal;
        }
        .employee-form-grid input,
        .employee-form-grid select {
          width: 100%;
          height: 43px;
          border: 1px solid #dfe5ee;
          border-radius: 8px;
          padding: 0 12px;
          outline: none;
          font-size: 13px;
          background: #fff;
          color: #17233d;
        }
        .employee-form-grid input:focus,
        .employee-form-grid select:focus {
          border-color: #f0444b;
          box-shadow: 0 0 0 3px #f0444b12;
        }
        .employee-form-full {
          grid-column: 1 / -1;
        }
        .field-state {
          font-size: 11px;
          font-weight: 500;
          color: #8b98ad;
        }
        .field-state.valid {
          color: #0ca76c;
        }
        .field-state.invalid {
          color: #e0444b;
        }
        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 11px;
          border-top: 1px solid #edf0f5;
          margin-top: 26px;
          padding-top: 20px;
        }
        .employee-secondary {
          background: #f4f6fa;
          border: 1px solid #e6eaf0;
          border-radius: 8px;
          color: #526078;
          padding: 11px 20px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
        }
        .employee-detail-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 15px 0;
          border-bottom: 1px solid #edf0f5;
          font-size: 13px;
        }
        .employee-detail-row span {
          color: #8794a9;
        }
        .employee-detail-row strong {
          color: #25334b;
          font-weight: 650;
          text-align: right;
        }
        .employee-detail-heading {
          text-align: center;
          padding: 12px 0 20px;
          border-bottom: 1px solid #edf0f5;
          margin-bottom: 8px;
        }
        .employee-detail-heading h3 {
          margin: 0 0 7px;
          font-size: 20px;
          color: #17233d;
        }
        .employee-detail-heading p {
          margin: 0;
          font-size: 12px;
          color: #98a4b6;
        }
        .employee-detail-modal {
          max-width: 460px;
        }
        .confirm-password {
          width: 100%;
          margin-top: 22px;
        }
        .success-modal {
          max-width: 460px;
        }
        .success-big {
          font-size: 44px;
          color: #0ca76c;
          display: block;
          margin-bottom: 18px;
        }
        .credential-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 0;
          border-bottom: 1px solid #edf0f5;
          font-size: 12px;
        }
        .credential-row span {
          color: #8290a5;
          flex: 1;
        }
        .credential-row b {
          color: #17233d;
          overflow-wrap: anywhere;
        }
        .credential-row button {
          border: none;
          border-radius: 6px;
          padding: 7px;
          background: #eef4ff;
          color: #2874e7;
          cursor: pointer;
        }
        .password-warning {
          background: #fff8e8;
          color: #a56b16;
          padding: 13px;
          border-radius: 8px;
          margin-top: 16px;
          font-size: 12px;
          line-height: 1.7;
        }
        @media (max-width: 1100px) {
          .employee-dashboard-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .employee-filters {
            flex-wrap: wrap;
          }
        }
        @media (max-width: 650px) {
          .employee-dashboard {
            padding: 14px;
          }
          .employee-heading {
            flex-wrap: wrap;
          }
          .employee-heading h1 {
            font-size: 21px;
          }
          .employee-add-button {
            margin-left: 0;
            width: 100%;
          }
          .employee-dashboard-stats {
            gap: 10px;
          }
          .employee-dashboard-card {
            padding: 12px;
            gap: 10px;
          }
          .employee-dashboard-icon {
            width: 40px;
            height: 40px;
            font-size: 18px;
          }
          .employee-dashboard-info strong {
            font-size: 23px;
          }
          .employee-filters select {
            flex: 1;
            min-width: 130px;
          }
          .employee-search {
            flex-basis: 100%;
          }
          .employee-form-grid {
            grid-template-columns: 1fr;
          }
          .employee-pagination {
            flex-wrap: wrap;
          }
        }
      `}</style>
      <div className="employee-dashboard">
        {/* TIÊU ĐỀ */}
        <section className="employee-heading">
          <div className="employee-title-icon">
            <TeamOutlined />
          </div>
          <div>
            <h1>Quản lý nhân viên</h1>
            <p>
              Quản lý tài khoản, vai trò và trạng thái làm việc
              của nhân viên trong nhà hàng.
            </p>
          </div>
          <button
            type="button"
            className="employee-primary employee-add-button"
            onClick={openCreate}
          >
            <PlusOutlined />
            Thêm nhân viên
          </button>
        </section>
        {/* THỐNG KÊ */}
        <section className="employee-dashboard-stats">
          <div className="employee-dashboard-card total">
            <div className="employee-dashboard-icon">
              <TeamOutlined />
            </div>
            <div className="employee-dashboard-info">
              <span>Tổng nhân viên</span>
              <strong>{stats.total}</strong>
              <small>Tất cả nhân viên</small>
            </div>
          </div>
          <div className="employee-dashboard-card active">
            <div className="employee-dashboard-icon">
              <CheckCircleFilled />
            </div>
            <div className="employee-dashboard-info">
              <span>Đang làm việc</span>
              <strong>{stats.active}</strong>
              <small>Nhân viên đang hoạt động</small>
            </div>
          </div>
          <div className="employee-dashboard-card other">
            <div className="employee-dashboard-icon">
              <ClockCircleOutlined />
            </div>
            <div className="employee-dashboard-info">
              <span>Trạng thái khác</span>
              <strong>{stats.other}</strong>
              <small>Trạng thái chưa phân loại</small>
            </div>
          </div>
          <div className="employee-dashboard-card inactive">
            <div className="employee-dashboard-icon">
              <UserDeleteOutlined />
            </div>
            <div className="employee-dashboard-info">
              <span>Đã nghỉ việc</span>
              <strong>{stats.left}</strong>
              <small>Nhân viên đã nghỉ</small>
            </div>
          </div>
        </section>
        {/* DANH SÁCH NHÂN VIÊN */}
        <section className="employee-panel">
          <div className="employee-filters">
            <div className="employee-search">
              <SearchOutlined />
              <input
                value={q}
                onChange={e => {
                  setQ(e.target.value)
                  setPage(1)
                }}
                placeholder="Tìm theo họ tên, số điện thoại, tên đăng nhập..."
              />
            </div>
            <select
              value={role}
              onChange={e => {
                setRole(e.target.value)
                setPage(1)
              }}
            >
              <option value="ALL">Tất cả vai trò</option>
              {Object.entries(roles).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={e => {
                setStatus(e.target.value)
                setPage(1)
              }}
            >
              <option value="ALL">Tất cả trạng thái</option>
              {Object.entries(statuses).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          {error && (
            <div className="employee-error" style={{ margin: 18 }}>
              {error}
            </div>
          )}
          {/* BẢNG - KHÔNG ẢNH, KHÔNG NÚT XÓA */}
          <div className="employee-table-wrap">
            <table className="employee-table">
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Họ tên</th>
                  <th>Số điện thoại</th>
                  <th>Tên đăng nhập</th>
                  <th>Vai trò</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="table-empty">
                      Đang tải danh sách nhân viên...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="table-empty">
                      Không tìm thấy nhân viên phù hợp.
                    </td>
                  </tr>
                ) : (
                  visible.map((x, i) => (
                    <tr key={x.id}>
                      <td>
                        {(currentPage - 1) * pageSize + i + 1}
                      </td>
                      <td>
                        <span className="employee-name-text">
                          {x.full_name}
                        </span>
                      </td>
                      <td>
                        <span className="employee-phone">
                          <PhoneOutlined />
                          {x.phone}
                        </span>
                      </td>
                      <td>
                        <span className="employee-username">
                          {x.username}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`role-badge role-${String(
                            x.role
                          ).toLowerCase()}`}
                        >
                          {roles[x.role] || x.role}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`work-status ${
                            x.status === 'HOAT_DONG'
                              ? 'working'
                              : 'left'
                          }`}
                        >
                          <i />
                          {statuses[x.status] || 'Trạng thái khác'}
                        </span>
                      </td>
                                              {/* BỐN THAO TÁC */}
                      <td>
                                                  <div className="employee-action-buttons">
                            <button type="button" className="employee-action-btn edit"
                              title="Chỉnh sửa nhân viên" aria-label={`Chỉnh sửa ${x.full_name}`}
                              disabled={busyIds.includes(x.id)} onClick={() => openEdit(x)}>
                              <EditOutlined />
                            </button>
                            <button type="button" className="employee-action-btn delete"
                              title="Xóa nhân viên" aria-label={`Xóa ${x.full_name}`}
                              disabled={busyIds.includes(x.id)} onClick={() => deleteEmployee(x)}>
                              <DeleteOutlined />
                            </button>
                          <button
                            type="button"
                            className={
                              x.status === 'DA_NGHI'
                                ? 'employee-action-btn enable'
                                : 'employee-action-btn stop'
                            }
                            title={
                              x.status === 'DA_NGHI'
                                ? 'Cho nhân viên làm lại'
                                : 'Cho nhân viên nghỉ việc'
                            }
                            disabled={busyIds.includes(x.id)}
                            onClick={() => toggle(x)}
                          >
                            {x.status === 'DA_NGHI'
                              ? <ReloadOutlined />
                              : <StopOutlined />}
                          </button>
                          <button
                            type="button"
                            className="employee-action-btn view"
                            title="Xem chi tiết nhân viên"
                            onClick={() => setSelectedEmployee(x)}
                          >
                            <EyeOutlined />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* PHÂN TRANG */}
          <div className="employee-pagination">
            <span>
              Hiển thị{' '}
              {filtered.length
                ? (currentPage - 1) * pageSize + 1
                : 0}
              {' - '}
              {Math.min(currentPage * pageSize, filtered.length)}
              {' '}trong tổng số {filtered.length} nhân viên
            </span>
            <div className="employee-pagination-controls">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setPage(p => p - 1)}
              >
                <LeftOutlined />
              </button>
              <span className="employee-page-current">
                {currentPage}
              </span>
              <span>/ {pageCount}</span>
              <button
                type="button"
                disabled={currentPage === pageCount}
                onClick={() => setPage(p => p + 1)}
              >
                <RightOutlined />
              </button>
            </div>
          </div>
        </section>
      </div>
      {/* MODAL THÊM NHÂN VIÊN */}
      {open && (
        <div
          className="employee-overlay"
          onMouseDown={e => {
            if (e.target === e.currentTarget && !saving) {
              setOpen(false)
            }
          }}
        >
          <form className="employee-modal" onSubmit={submit}>
            <button
              type="button"
              className="modal-close"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              <CloseOutlined />
            </button>
            <h2>Thêm nhân viên mới</h2>
            <p className="employee-modal-subtitle">
              Điền thông tin để tạo tài khoản nhân viên nhà hàng.
            </p>
            {formError && (
              <div className="employee-error">{formError}</div>
            )}
            <div className="employee-form-grid">
              <label>
                Họ và tên <em>*</em>
                <input
                  required
                  minLength={2}
                  value={form.full_name}
                  onChange={e =>
                    setField('full_name', e.target.value)
                  }
                  placeholder="Nguyễn Văn An"
                />
              </label>
              <label>
                Vai trò <em>*</em>
                <select
                  value={form.role}
                  onChange={e =>
                    setField('role', e.target.value)
                  }
                >
                  {Object.entries(roles).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Số điện thoại <em>*</em>
                <input
                  required
                  value={form.phone}
                  onChange={e =>
                    setField('phone', e.target.value)
                  }
                  onBlur={() => verify('phone')}
                  placeholder="0987654321"
                />
                <FieldState
                  state={availability.phone}
                  checking={checking.phone}
                  ok="Số điện thoại có thể sử dụng"
                  bad="Số điện thoại đã được sử dụng"
                />
              </label>
              <label>
                Trạng thái <em>*</em>
                <select
                  value={form.status}
                  onChange={e =>
                    setField('status', e.target.value)
                  }
                >
                  {Object.entries(statuses).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="employee-form-full">
                Tên đăng nhập <em>*</em>
                <input
                  required
                  minLength={3}
                  value={form.username}
                  onChange={e =>
                    setField(
                      'username',
                      e.target.value.toLowerCase()
                    )
                  }
                  onBlur={() => verify('username')}
                  placeholder="nguyenvanan"
                />
                <FieldState
                  state={availability.username}
                  checking={checking.username}
                  ok="Tên đăng nhập có thể sử dụng"
                  bad="Tên đăng nhập đã được sử dụng"
                />
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="employee-secondary"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                Hủy
              </button>
              <button
                type="submit"
                className="employee-primary"
                disabled={
                  saving ||
                  availability.phone === false ||
                  availability.username === false
                }
              >
                <PlusOutlined />
                {saving ? 'Đang tạo...' : 'Tạo tài khoản'}
              </button>
            </div>
          </form>
        </div>
      )}
              {/* MODAL CHỈNH SỬA NHÂN VIÊN */}
        {editingEmployee && (
          <div className="employee-overlay" onMouseDown={e => {
            if (e.target === e.currentTarget && !editSaving) setEditingEmployee(null)
          }}>
            <form className="employee-modal" onSubmit={saveEdit}>
              <button type="button" className="modal-close" disabled={editSaving}
                onClick={() => setEditingEmployee(null)} aria-label="Đóng">
                <CloseOutlined />
              </button>
              <h2>Chỉnh sửa nhân viên</h2>
              <p className="employee-modal-subtitle">Chỉ cập nhật danh sách trên trình duyệt này, không thay đổi tài khoản trên máy chủ.</p>
              {editError && <div className="employee-error">{editError}</div>}
              <div className="employee-form-grid">
                <label>Họ và tên <em>*</em>
                  <input required minLength={2} value={editForm.full_name}
                    onChange={e => setEditForm(p => ({...p, full_name: e.target.value}))} />
                </label>
                <label>Vai trò <em>*</em>
                  <select value={editForm.role}
                    onChange={e => setEditForm(p => ({...p, role: e.target.value}))}>
                    {Object.entries(roles).map(([key, value]) =>
                      <option key={key} value={key}>{value}</option>)}
                  </select>
                </label>
                <label>Số điện thoại <em>*</em>
                  <input required value={editForm.phone}
                    onChange={e => setEditForm(p => ({...p, phone: e.target.value}))} />
                </label>
                <label>Trạng thái <em>*</em>
                  <select value={editForm.status}
                    onChange={e => setEditForm(p => ({...p, status: e.target.value}))}>
                    {Object.entries(statuses).map(([key, value]) =>
                      <option key={key} value={key}>{value}</option>)}
                  </select>
                </label>
                <label className="employee-form-full">Tên đăng nhập <em>*</em>
                  <input required minLength={3} value={editForm.username}
                    onChange={e => setEditForm(p => ({...p, username: e.target.value.toLowerCase()}))} />
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="employee-secondary" disabled={editSaving}
                  onClick={() => setEditingEmployee(null)}>Hủy</button>
                <button type="submit" className="employee-primary" disabled={editSaving}>
                  <EditOutlined /> {editSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        )}

{/* MODAL XEM CHI TIẾT */}
      {selectedEmployee && (
        <div
          className="employee-overlay"
          onMouseDown={e => {
            if (e.target === e.currentTarget) {
              setSelectedEmployee(null)
            }
          }}
        >
          <div className="employee-modal employee-detail-modal">
            <button
              type="button"
              className="modal-close"
              onClick={() => setSelectedEmployee(null)}
            >
              <CloseOutlined />
            </button>
            <h2>Thông tin nhân viên</h2>
            <p className="employee-modal-subtitle">
              Thông tin tài khoản và công việc của nhân viên.
            </p>
            <div className="employee-detail-heading">
              <h3>{selectedEmployee.full_name}</h3>
              <p>{roles[selectedEmployee.role] || selectedEmployee.role}</p>
            </div>
            <div className="employee-detail-row">
              <span>Họ và tên</span>
              <strong>{selectedEmployee.full_name}</strong>
            </div>
            <div className="employee-detail-row">
              <span>Số điện thoại</span>
              <strong>{selectedEmployee.phone}</strong>
            </div>
            <div className="employee-detail-row">
              <span>Tên đăng nhập</span>
              <strong>{selectedEmployee.username}</strong>
            </div>
            <div className="employee-detail-row">
              <span>Vai trò</span>
              <strong>
                {roles[selectedEmployee.role] || selectedEmployee.role}
              </strong>
            </div>
            <div className="employee-detail-row">
              <span>Trạng thái</span>
              <span
                className={`work-status ${
                  selectedEmployee.status === 'HOAT_DONG'
                    ? 'working'
                    : 'left'
                }`}
              >
                <i />
                {statuses[selectedEmployee.status] || 'Trạng thái khác'}
              </span>
            </div>
            <button
              type="button"
              className="employee-primary confirm-password"
              onClick={() => setSelectedEmployee(null)}
            >
              Đóng
            </button>
          </div>
        </div>
      )}
      {/* MODAL TÀI KHOẢN VỪA TẠO */}
      {created && (
        <div className="employee-overlay">
          <div className="employee-modal success-modal">
            <button
              type="button"
              className="modal-close"
              onClick={() => setCreated(null)}
            >
              <CloseOutlined />
            </button>
            <CheckCircleFilled className="success-big" />
            <h2>Tạo tài khoản thành công</h2>
            <p className="employee-modal-subtitle">
              Tài khoản đã được tạo. Hãy lưu lại thông tin đăng nhập
              và cung cấp trực tiếp cho nhân viên.
            </p>
            <div className="credential-row">
              <span>Tên đăng nhập</span>
              <b>{created.username}</b>
              <button
                type="button"
                title="Sao chép tên đăng nhập"
                onClick={() => copy(created.username)}
              >
                <CopyOutlined />
              </button>
            </div>
            <div className="credential-row">
              <span>Mật khẩu tạm</span>
              <b>
                {showPass
                  ? created.temporary_password
                  : '••••••••'}
              </b>
              <button
                type="button"
                title="Hiện hoặc ẩn mật khẩu"
                onClick={() => setShowPass(v => !v)}
              >
                {showPass
                  ? <EyeInvisibleOutlined />
                  : <EyeOutlined />}
              </button>
              <button
                type="button"
                title="Sao chép mật khẩu"
                onClick={() => copy(created.temporary_password)}
              >
                <CopyOutlined />
              </button>
            </div>
            <div className="password-warning">
              Mật khẩu tạm chỉ được hiển thị một lần.
              Hãy lưu lại và cung cấp riêng cho nhân viên.
            </div>
            <button
              type="button"
              className="employee-primary confirm-password"
              onClick={() => setCreated(null)}
            >
              Tôi đã lưu mật khẩu
            </button>
          </div>
        </div>
      )}
    </>
  )
}