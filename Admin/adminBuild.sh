#!/bin/bash

# Resolve current script directory (portable: Linux / macOS / Windows Git Bash)
BTRADELOC="$(cd "$(dirname "$0")" && pwd)"

BUILDLOC=prod
if [ "$1" = "dev" ]; then
   echo "Uploading to AI Template development Environment"
   TARGETSERVER=jayeesha@183.82.0.28
elif [ "$1" = "test" ]; then
   echo "Uploading to AI Template test Environment."
   TARGETSERVER=jayeesha@183.82.0.28
elif [ "$1" = "live" ]; then
   echo "Uploading to AI Template live Environment."
   TARGETSERVER=jayeesha@183.82.0.28
elif [ "$1" = "-h" ]; then
   echo "Usage : adminbuild.sh [test|live]"
   exit
else
   echo "Invalid argument"
   exit 1
fi

DATE=$(date +%Y-%m-%d-%H-%M)

# Move to Admin directory safely
cd "$BTRADELOC" || {
   echo "❌ Failed to change directory to $BTRADELOC"
   exit 1
}

echo "Build Started .....🏗️🏗️🏗️🏗️🏗️🏗️🏗️🏗️🏗️🏗️🏗️🏗️🏗️🏗️🏗️🏗️🏗️"
npm run build || {
   echo "❌ Build command failed"
   exit 1
}

if [ -d "$BTRADELOC/dist" ]; then
   cd "$BTRADELOC/dist"

   echo "Creating tar.."
   tar -cvf ~/Downloads/ai_temp_admin.tar.xz *
   echo "Started Coping to Server................!©️©🗼🗼🗼🗼🗼🗼🗼🗼🗼🗼🗼🗼🗼🗼"

   if [ "$1" = "dev" ]; then
      scp ~/Downloads/ai_temp_admin.tar.xz $TARGETSERVER:
      echo "Extracting tar in server.."
      ssh $TARGETSERVER "cd /var/www/html/forewarnclienttest.dosystemsinc.com/public_html && sudo -S tar -xvf ~/ai_temp_admin.tar.xz"
      echo "Successfully uploaded to AI Template Dev"
   elif [ "$1" = "test" ]; then
      scp ~/Downloads/ai_temp_admin.tar.xz $TARGETSERVER:
      echo "Extracting tar File in server..  ✨✨✨✨✨✨✨✨✨✨✨✨"
      ssh $TARGETSERVER "cd /var/www/html/forewarnclienttest.dosystemsinc.com/public_html && sudo -S tar -xvf ~/ai_temp_admin.tar.xz"
      echo "Successfully Uploaded the AI Template Test 🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀"
   elif [ "$1" = "live" ]; then
      scp ~/Downloads/ai_temp_admin.tar.xz $TARGETSERVER:
      echo "Extracting tar File in server..  ✨✨✨✨✨✨✨✨✨✨✨✨"
      ssh $TARGETSERVER "cd /var/www/html/forewarnclienttest.dosystemsinc.com/public_html && sudo -S tar -xvf ~/ai_temp_admin.tar.xz"
      echo "Successfully Uploaded the AI Template Live 🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀"

   fi
else
   echo "❌ Build folder not found — build failed"
   exit 1
fi