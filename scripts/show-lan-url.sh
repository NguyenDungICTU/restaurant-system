#!/usr/bin/env bash
set -euo pipefail

echo "===== Active LAN IPv4 ====="
powershell.exe -NoProfile -Command '
Get-NetIPConfiguration |
  Where-Object {
    $_.NetAdapter.Status -eq "Up" -and
    $_.IPv4Address -and
    $_.IPv4DefaultGateway
  } |
  ForEach-Object {
    $ip = $_.IPv4Address.IPAddress
    $gw = $_.IPv4DefaultGateway.NextHop
    Write-Output ("{0}  ->  http://{1}:5173" -f $ip,$ip)
  }
'
echo
echo "Mở đúng URL http://<IPv4>:5173 trên điện thoại."
echo "Điện thoại và laptop phải ở cùng mạng LAN/Wi-Fi và mạng không chặn client-to-client traffic."
