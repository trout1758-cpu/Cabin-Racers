@echo off
rem Double-click to play Cabin Racers on Windows.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-game.ps1"
pause
