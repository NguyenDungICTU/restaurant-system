import { api } from './api'

export async function getDishReport(fromDate, toDate) {
  const response = await api.get('/api/reports/dishes', {
    params: {
      from_date: fromDate,
      to_date: toDate,
    },
  })
  return response.data
}
