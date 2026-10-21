@echo off
where node >nul 2>nul || (echo Install Node.js 20+ first.&pause&exit /b 1)
copy /Y server\.env.example server\.env >nul
copy /Y client\.env.example client\.env >nul
call npm install
call npm run seed
echo Setup complete. Run start.bat
pause
