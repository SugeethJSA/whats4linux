package api

import (
	"encoding/base64"
	"errors"
	"fmt"
	"mime"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// PickedFile is a file selected through the native picker, delivered as
// base64 so the webview can attach it like a <input type="file"> result.
type PickedFile struct {
	Name     string `json:"name"`
	Mimetype string `json:"mimetype"`
	Base64   string `json:"base64"`
}

// PickAttachmentFile opens the native GTK file chooser with no MIME filter
// (the webview's accept="*/*" input is unreliable on some desktops and ends
// up allowing no files at all), reads the chosen file and returns it to the
// frontend. An empty result means the dialog was cancelled.
func (a *Api) PickAttachmentFile() (*PickedFile, error) {
	if a.ctx == nil {
		return nil, errors.New("app not ready")
	}
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select a file",
	})
	if err != nil {
		return nil, fmt.Errorf("open file dialog: %w", err)
	}
	if path == "" {
		return nil, nil
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read file: %w", err)
	}
	mimetype := mime.TypeByExtension(filepath.Ext(path))
	if mimetype == "" {
		mimetype = "application/octet-stream"
	}
	return &PickedFile{
		Name:     filepath.Base(path),
		Mimetype: mimetype,
		Base64:   base64.StdEncoding.EncodeToString(data),
	}, nil
}
