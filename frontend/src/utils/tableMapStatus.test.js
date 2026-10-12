import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getCurrentTableStatusPresentation,
  getTableStatusPresentation,
  statusColors,
  statuses,
  unconfiguredColors,
} from './tableMapStatus.js'

test('current table statuses keep the required distinct label and color mapping', () => {
  const expected = {
    TRONG: {
      label: 'Trống',
      colors: {
        background: '#edf8ef',
        border: '#328449',
        text: '#246536',
      },
    },
    DA_DAT: {
      label: 'Đã đặt trước',
      colors: {
        background: '#fff7df',
        border: '#b88714',
        text: '#805d0a',
      },
    },
    DANG_SU_DUNG: {
      label: 'Đang phục vụ',
      colors: {
        background: '#fff0ed',
        border: '#b6372d',
        text: '#972c24',
      },
    },
    DANG_DON: {
      label: 'Đang dọn',
      colors: {
        background: '#edf4ff',
        border: '#3974bd',
        text: '#285b99',
      },
    },
  }

  for (const [status, presentation] of Object.entries(expected)) {
    assert.equal(statuses[status], presentation.label)
    assert.deepEqual(statusColors[status], presentation.colors)
    assert.deepEqual(
      getTableStatusPresentation({
        da_cau_hinh: true,
        trang_thai: status,
      }),
      {
        label: presentation.label,
        colors: statusColors[status],
      }
    )
  }

  assert.equal(
    new Set(Object.values(expected).map(item => item.colors.border)).size,
    4
  )
})

test('unconfigured and inactive tables never receive the empty-table presentation', () => {
  assert.deepEqual(
    getTableStatusPresentation({
      da_cau_hinh: false,
      trang_thai: 'TRONG',
    }),
    {
      label: 'Chưa cấu hình',
      colors: unconfiguredColors,
    }
  )
  assert.deepEqual(
    getTableStatusPresentation({
      da_cau_hinh: true,
      trang_thai: 'NGUNG_SU_DUNG',
    }),
    {
      label: 'Ngừng sử dụng',
      colors: unconfiguredColors,
    }
  )
})


test('a table with a future confirmed booking is shown as empty on the live map', () => {
  const now = new Date('2026-10-12T09:00:00+07:00')
  const table = {
    da_cau_hinh: true,
    trang_thai: 'DA_DAT',
    dat_ban_sap_toi: {
      thoi_gian_den_at: '2026-10-13T09:00:00+07:00',
    },
  }

  assert.deepEqual(getCurrentTableStatusPresentation(table, now), {
    label: 'Trống',
    colors: statusColors.TRONG,
  })
  // Invalid/old booking timestamps should not accidentally mark the table empty.
  assert.equal(
    getCurrentTableStatusPresentation({
      ...table,
      dat_ban_sap_toi: { thoi_gian_den_at: 'invalid' },
    }, now).label,
    'Đã đặt trước',
  )
})

test('a reservation whose start time has arrived remains reserved', () => {
  const now = new Date('2026-10-12T09:00:00+07:00')
  assert.equal(
    getCurrentTableStatusPresentation({
      da_cau_hinh: true,
      trang_thai: 'DA_DAT',
      dat_ban_sap_toi: {
        thoi_gian_den_at: '2026-10-12T08:59:00+07:00',
      },
    }, now).label,
    'Đã đặt trước',
  )
})
