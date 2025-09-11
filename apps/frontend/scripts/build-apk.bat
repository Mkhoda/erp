@echo off
REM Script to generate APK from PWA using Bubblewrap for Windows
REM Make sure you have Java 8+ and Android SDK installed

echo 🚀 Generating APK for Arzesh ERP...

REM Check if bubblewrap is installed
where bubblewrap >nul 2>nul
if %errorlevel% neq 0 (
    echo Installing Bubblewrap...
    npm install -g @bubblewrap/cli
)

REM Initialize TWA project if not exists
if not exist "twa-project" (
    echo Initializing TWA project...
    bubblewrap init --manifest twa-manifest.json
)

REM Build APK
echo Building APK...
cd twa-project
bubblewrap build

echo ✅ APK generated successfully!
echo 📱 APK location: ./twa-project/app/build/outputs/apk/release/app-release.apk

REM Optional: Sign the APK (uncomment if you have signing keys)
REM echo Signing APK...
REM bubblewrap build --skipPwaValidation

echo 🎉 Your Arzesh ERP Android app is ready!
pause
