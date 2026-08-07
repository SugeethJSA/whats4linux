package store

import (
	"sync"
	"testing"

	"github.com/lugvitc/whats4linux/internal/misc"
)

// freshSettings points the settings singleton at a brand-new config dir and
// reloads it, isolating each test from the package-level state.
func freshSettings(t *testing.T) {
	t.Helper()
	oldConfigDir := misc.ConfigDir
	misc.ConfigDir = t.TempDir()
	t.Cleanup(func() {
		_ = CloseSettings()
		misc.ConfigDir = oldConfigDir
	})
	if err := CloseSettings(); err != nil {
		t.Fatal(err)
	}
	LoadSettings()
}

func TestSettingsRoundTrip(t *testing.T) {
	freshSettings(t)

	settings := map[string]any{"theme": "dark", "language": "es"}
	if err := SaveSettings(settings); err != nil {
		t.Fatal(err)
	}
	if got := GetSettings(); got["theme"] != "dark" || got["language"] != "es" {
		t.Fatalf("GetSettings() = %v, want saved values", got)
	}
	if err := SetNotificationsEnabled(false); err != nil {
		t.Fatal(err)
	}
	if GetNotificationsEnabled() {
		t.Fatal("notifications should be disabled")
	}

	// Reload from disk and verify persistence.
	if err := CloseSettings(); err != nil {
		t.Fatal(err)
	}
	LoadSettings()
	if got := GetSettings(); got["theme"] != "dark" {
		t.Fatalf("settings after reload = %v, want theme persisted", got)
	}
	if GetNotificationsEnabled() {
		t.Fatal("notification switch should survive a reload")
	}
}

func TestSettingsNotificationsCarryOver(t *testing.T) {
	freshSettings(t)

	if err := SetNotificationsEnabled(false); err != nil {
		t.Fatal(err)
	}
	// A frontend snapshot save without the backend-owned key must not
	// clobber the switch.
	if err := SaveSettings(map[string]any{"language": "fr"}); err != nil {
		t.Fatal(err)
	}
	if GetNotificationsEnabled() {
		t.Fatal("carry-over failed: notifications re-enabled")
	}
	if v, ok := GetSettings()[notificationsKey]; !ok || v != false {
		t.Fatalf("settings = %v, want notifications_enabled=false present", GetSettings())
	}
}

func TestSettingsConcurrent(t *testing.T) {
	freshSettings(t)

	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_ = SetNotificationsEnabled(i%2 == 0)
			_ = GetNotificationsEnabled()
			_ = GetSettings()
		}(i)
	}
	wg.Wait()
}
