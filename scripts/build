#!/bin/sh
cd systray
TRAY_BIN=whats4linux_tray
# Windows requires the .exe extension to launch the tray.
case "$(uname -s 2>/dev/null)" in
  MINGW*|MSYS*|CYGWIN*) TRAY_BIN=whats4linux_tray.exe ;;
esac
go build -o ../build/bin/$TRAY_BIN
cd ..
wails build $1