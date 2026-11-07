@echo off
setlocal
cd /d "%~dp0"

set "PORT=5174"
set "URL=http://localhost:%PORT%"

echo Запуск Emporium на %URL%
echo (Ctrl+C — остановить сервер)
echo.

start "" "%URL%"
call npm run dev -- --port %PORT% --host

echo.
echo Сервер остановлен.
pause
