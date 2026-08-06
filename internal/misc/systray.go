package misc

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

func StartSystray() error {
	var baseDir string

	if appDir := os.Getenv("APPDIR"); appDir != "" {
		baseDir = filepath.Join(appDir, "usr", "bin")
	} else {
		exePath, err := os.Executable()
		if err != nil {
			return err
		}
		baseDir = filepath.Dir(exePath)
	}

	// Windows executables carry the .exe extension. Fall back to the raw name
	// so binaries built by older scripts still launch.
	trayPath := filepath.Join(baseDir, "whats4linux_tray")
	if runtime.GOOS == "windows" {
		if _, err := os.Stat(trayPath); err != nil {
			trayPath += ".exe"
		}
	}

	cmd := exec.Command(trayPath)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	return cmd.Start()
}
