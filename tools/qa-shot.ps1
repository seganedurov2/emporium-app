$ErrorActionPreference = 'Stop'
$chrome = Join-Path $env:LOCALAPPDATA 'ms-playwright\chromium-1243\chrome-win64\chrome.exe'
$shot = 'E:\emporium\app\tools\qa-menu.png'
if (Test-Path $shot) { Remove-Item $shot }
$proc = Start-Process -FilePath $chrome -ArgumentList @(
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--window-size=1440,900',
  "--screenshot=$shot",
  '--virtual-time-budget=8000',
  'http://localhost:4180/'
) -PassThru -WindowStyle Hidden
$proc.WaitForExit(60000) | Out-Null
if (Test-Path $shot) { "OK $((Get-Item $shot).Length) bytes" } else { "NO SCREENSHOT" }
