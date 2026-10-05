export const statuses = {
  TRONG: 'Trống',
  DA_DAT: 'Đã đặt trước',
  DANG_SU_DUNG: 'Đang phục vụ',
  DANG_DON: 'Đang dọn',
  NGUNG_SU_DUNG: 'Ngừng sử dụng',
}

export const statusColors = {
  TRONG: {
    background: '#edf8ef',
    border: '#328449',
    text: '#246536',
  },
  DA_DAT: {
    background: '#fff7df',
    border: '#b88714',
    text: '#805d0a',
  },
  DANG_SU_DUNG: {
    background: '#fff0ed',
    border: '#b6372d',
    text: '#972c24',
  },
  DANG_DON: {
    background: '#edf4ff',
    border: '#3974bd',
    text: '#285b99',
  },
}

export const unconfiguredColors = {
  background: '#f2f3f5',
  border: '#8c8c8c',
  text: '#595959',
}

export function getTableStatusPresentation(table) {
  if (!table.da_cau_hinh) {
    return {
      label: 'Chưa cấu hình',
      colors: unconfiguredColors,
    }
  }

  if (table.trang_thai === 'NGUNG_SU_DUNG') {
    return {
      label: statuses.NGUNG_SU_DUNG,
      colors: unconfiguredColors,
    }
  }

  const colors = statusColors[table.trang_thai]
  if (colors) {
    return {
      label: statuses[table.trang_thai],
      colors,
    }
  }

  return {
    label: table.trang_thai || 'Chưa có trạng thái',
    colors: unconfiguredColors,
  }
}
