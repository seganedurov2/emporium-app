@echo off
cd /d "%~dp0"
echo Запуск Emporium на http://localhost:5174
npm run dev -- --port 5174 --host
pause
