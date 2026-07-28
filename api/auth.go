package api

import (
	"fmt"
	"log/slog"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"go.mau.fi/whatsmeow"
)

// minPhoneLen is the minimum length for a phone number (country code + number).
const minPhoneLen = 7

// PairPhone generates an 8-digit pairing code for linking a phone without
// scanning a QR code. Returns the pairing code string on success.
//
// The client must be connected first (call Login or wait for Connected event).
// WhatsApp validates the client display name; common browser+OS combos only.
func (a *Api) PairPhone(phone string) (string, error) {
	if a.waClient.Store.ID != nil {
		return "", fmt.Errorf("already logged in")
	}
	if !a.waClient.IsConnected() {
		return "", fmt.Errorf("client not connected — call Login first")
	}
	phone = strings.TrimSpace(phone)
	if len(phone) < minPhoneLen {
		return "", fmt.Errorf("phone number too short (min %d digits)", minPhoneLen)
	}
	code, err := a.waClient.PairPhone(a.ctx, phone, true, whatsmeow.PairClientChrome, "Chrome (Windows)")
	if err != nil {
		slog.Error(fmt.Sprintf("PairPhone failed for %s: %v", phone, err), "source", "auth")
		return "", fmt.Errorf("pairing failed: %w", err)
	}
	slog.Info(fmt.Sprintf("PairPhone code generated for %s", phone), "source", "auth")
	runtime.EventsEmit(a.ctx, "wa:status", string(code))
	return code, nil
}

func (a *Api) Logout() error {
	if a.waClient.Store.ID == nil {
		return fmt.Errorf("not logged in")
	}
	slog.Info("Logging out", "source", "auth")
	a.waClient.Disconnect()
	if err := a.waClient.Store.Delete(a.ctx); err != nil {
		slog.Error(fmt.Sprintf("Logout Delete failed: %v", err), "source", "auth")
		return fmt.Errorf("logout delete failed: %w", err)
	}
	slog.Info("Logged out successfully", "source", "auth")
	runtime.EventsEmit(a.ctx, "wa:status", "logged_out")
	return nil
}
