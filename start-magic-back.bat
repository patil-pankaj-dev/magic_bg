@echo off
title Magic back - AI Background Remover
cd /d "%~dp0"
echo ========================================================
echo         Starting Magic back AI Web Application
echo ========================================================
echo.
echo Launching local development server at http://localhost:5173 ...
echo Press Ctrl+C in this window anytime to stop the server.
echo.

start "" "http://localhost:5173"
call npm.cmd run dev
pause
