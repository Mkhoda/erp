#!/bin/bash

# Script to generate APK from PWA using Bubblewrap
# Make sure you have Java 8+ and Android SDK installed

echo "🚀 Generating APK for سامانه جامع ارزش..."

# Check if bubblewrap is installed
if ! command -v bubblewrap &> /dev/null; then
    echo "Installing Bubblewrap..."
    npm install -g @bubblewrap/cli
fi

# Initialize TWA project if not exists
if [ ! -d "./twa-project" ]; then
    echo "Initializing TWA project..."
    bubblewrap init --manifest ./twa-manifest.json
fi

# Build APK
echo "Building APK..."
cd twa-project
bubblewrap build

echo "✅ APK generated successfully!"
echo "📱 APK location: ./twa-project/app/build/outputs/apk/release/app-release.apk"

# Optional: Sign the APK (uncomment if you have signing keys)
# echo "Signing APK..."
# bubblewrap build --skipPwaValidation

echo "🎉 Your سامانه جامع ارزش Android app is ready!"
