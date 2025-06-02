@echo off
title Meeting Audio Capture Dashboard Launcher

echo 🎤 Meeting Audio Capture Dashboard Launcher
echo ==============================================

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed!
    echo 💡 Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Change to script directory
cd /d "%~dp0"
echo 📁 Working directory: %cd%

REM Check if dependencies are installed
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Check for command line arguments
if "%1"=="--auto" (
    echo 🚀 Starting dashboard in auto mode...
    node launcher.js --start
) else if "%1"=="-a" (
    echo 🚀 Starting dashboard in auto mode...
    node launcher.js --start
) else (
    echo 🎯 Starting interactive launcher...
    node launcher.js
)

pause