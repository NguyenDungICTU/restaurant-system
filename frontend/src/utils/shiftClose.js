export const CASH_VARIANCE_EXPLANATION_THRESHOLD = 50000

export function calculateCashDifference(systemCash, countedCash) {
  if (systemCash == null || countedCash == null || systemCash < 0 || countedCash < 0) return null
  return Number(countedCash) - Number(systemCash)
}

export function needsVarianceExplanation(difference) {
  return difference != null && Math.abs(Number(difference)) > CASH_VARIANCE_EXPLANATION_THRESHOLD
}
