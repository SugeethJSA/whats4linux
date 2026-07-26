package api

import (
	"fmt"
	"strings"

	"github.com/lugvitc/whats4linux/internal/logcat"
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
		a.logcatLog(logcat.LevelError, "auth", "PairPhone failed for %s: %v", phone, err)
		return "", fmt.Errorf("pairing failed: %w", err)
	}
	a.logcatLog(logcat.LevelInfo, "auth", "PairPhone code generated for %s", phone)
	runtime.EventsEmit(a.ctx, "wa:status", string(code))
	return code, nil
}

// Logout disconnects the client, clears the stored credentials, and
// disposes the session so a fresh login (QR or pairing) is required.
func (a *Api) Logout() error {
	if a.waClient.Store.ID == nil {
		return fmt.Errorf("not logged in")
	}
	a.logcatLog(logcat.LevelInfo, "auth", "Logging out")
	// Disconnect first so the server sees a clean departure.
	a.waClient.Disconnect()
	// Delete the stored session (Store.ID + credentials).
	if err := a.waClient.Store.Delete(a.ctx); err != nil {
		a.logcatLog(logcat.LevelError, "auth", "Logout Delete failed: %v", err)
		return fmt.Errorf("logout delete failed: %w", err)
	}
	a.logcatLog(logcat.LevelInfo, "auth", "Logged out successfully")
	runtime.EventsEmit(a.ctx, "wa:status", "logged_out")
	return nil
}
