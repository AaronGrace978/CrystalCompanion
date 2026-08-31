@echo off
setlocal
set "NODE_DIR=%LOCALAPPDATA%\Programs\node-portable\node-v22.20.0-win-x64"
if exist "%NODE_DIR%\node.exe" set "PATH=%NODE_DIR%;%PATH%"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js not found. Install Node 18+ or update start.bat with your node path.
  pause
  exit /b 1
)
cd /d "%~dp0"
if not exist "node_modules\electron" call npm install
call npm start
