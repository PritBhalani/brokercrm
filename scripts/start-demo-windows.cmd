@echo off
REM Double-click or run from Task Scheduler at logon.
REM Edit PROJECT_ROOT to your repo folder (no trailing backslash).

set PROJECT_ROOT=F:\New folder (3)
set NGROK_CMD=ngrok

cd /d "%PROJECT_ROOT%"

REM 1) API + Vite (adjust if you use production: NODE_ENV=production npm run start)
start "BrokerCRM server" cmd /k "npm run dev"

REM Wait for port 3000 to listen (rough delay; increase if needed)
timeout /t 8 /nobreak >nul

REM 2) Public tunnel — requires ngrok on PATH and authtoken configured once
start "Ngrok tunnel" cmd /k "%NGROK_CMD% http 3000"

echo Started server + ngrok. Keep both windows open. Close them to stop.
