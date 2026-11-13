@echo off
title Remove-back v2 Production Preview
cd /d "%~dp0"
echo ========================================================
echo       Starting Remove-back v2 Production Preview
echo ========================================================
echo.
echo Launching production preview at http://localhost:4173 ...
echo Press Ctrl+C in this window anytime to stop the server.
echo.

start "" "http://localhost:4173"
call npm.cmd run preview
pause
