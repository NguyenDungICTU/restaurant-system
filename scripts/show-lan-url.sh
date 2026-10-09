#!/usr/bin/env bash
set -euo pipefail

echo "===== Active IPv4 ====="

powershell.exe -NoProfile -Command '
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object {
    $_.AddressState -eq "Preferred" -and
    $_.IPAddress -notlike "127.*" -and
    $_.IPAddress -notlike "169.254.*"
  } |
  ForEach-Object {
    $adapter = Get-NetAdapter -InterfaceIndex $_.InterfaceIndex -ErrorAction SilentlyContinue
    if ($adapter -and $adapter.Status -eq "Up") {
      Write-Output ("{0} | {1} | http://{1}:5173" -f $adapter.Name, $_.IPAddress)
    }
  }
'

echo
echo "Ưu tiên IPv4 của Wi-Fi đang kết nối."
echo "Điện thoại phải truy cập được laptop qua mạng đó."
