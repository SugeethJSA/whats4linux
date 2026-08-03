package misc

import (
	"fmt"
	"os"
	"path/filepath"
)

const AppName = "whats4linux"
const AppID = "net.lugvitc.whats4linux"

var ConfigDir = defaultConfigDir()

func GetSQLiteAddress(dbName string) string {
	path := filepath.Join(ConfigDir, dbName)
	return fmt.Sprintf("file:%s?_foreign_keys=on&_busy_timeout=5000", path)
}

func defaultConfigDir() string {
	cdr, err := os.UserConfigDir()
	if err != nil {
		panic(err)
	}
	cdr = filepath.Join(cdr, AppName)
	if !dirExists(cdr) {
		err = os.MkdirAll(cdr, os.ModePerm)
		if err != nil {
			panic(err)
		}
	}
	return cdr
}

func dirExists(name string) bool {
	_, err := os.ReadDir(name)
	return !os.IsNotExist(err)
}
