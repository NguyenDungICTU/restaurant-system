export function formatAreaName(name) {
  const floorMatch = /^t(?:ầng)?\s*(\d+)$/i.exec(name.trim())

  return floorMatch ? `Tầng ${floorMatch[1]}` : name
}

export function formatTableName(areaName, tableCode) {
  return areaName
    ? `${formatAreaName(areaName)} · ${tableCode}`
    : tableCode
}
