@echo off
title Remove-back v2 - AI Background Remover
cd /d "%~dp0"
echo ========================================================
echo       Starting Remove-back v2 AI Web Application
echo ========================================================
echo.
echo Launching local development server at http://localhost:5173 ...
echo Press Ctrl+C in this window anytime to stop the server.
echo.

start "" "http://localhost:5173"
call npm.cmd run dev
pause
