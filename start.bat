@echo off
setlocal

rem Always run from the folder that contains this batch file.
cd /d "%~dp0"

if not exist package.json (
  echo ERROR: package.json was not found in %CD%
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing frontend dependencies...
  call npm install
  if errorlevel 1 (
    echo ERROR: npm install failed.
    pause
    exit /b 1
  )
)

echo Starting RandP frontend at http://localhost:5173/login
call npm run dev

if errorlevel 1 (
  echo.
  echo The frontend could not start. Port 5173 may already be in use.
  echo Close the old Node/Vite process and try again.
)

pause
endlocal
