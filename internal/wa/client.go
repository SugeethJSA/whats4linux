package wa

import (
	"context"
	"fmt"
	"strings"

	"github.com/lugvitc/whats4linux/internal/settings"
	_ "github.com/mattn/go-sqlite3"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store/sqlstore"
	waLog "go.mau.fi/whatsmeow/util/log"
)

func NewClient(ctx context.Context, container *sqlstore.Container) (*whatsmeow.Client, error) {
	deviceStore, err := container.GetFirstDevice(ctx)
	if err != nil {
		return nil, fmt.Errorf("get device store: %w", err)
	}
	clientLog := waLog.Stdout("Client", settings.GetLogLevel(), true)
	cli := whatsmeow.NewClient(deviceStore, clientLog)
	cli.EmitAppStateEventsOnFullSync = true
	// Reconnect automatically on transient failures (network blips, server
	// restarts). The app-level reconnectLoop in the API layer handles the
	// cases where whatsmeow gives up.
	cli.EnableAutoReconnect = true
	// Trust identity changes without user confirmation, like WhatsApp Web
	// does for paired devices. Avoids a hard failure when a contact changes
	// their security code.
	cli.AutoTrustIdentity = true
	// Send privacy tokens alongside media and message requests so contacts
	// with privacy settings enabled can still interact normally.
	cli.SendReportingTokens = true
	// Tune the built-in auto-reconnect: keep retrying on network errors, but
	// give up on auth/version failures that a reconnect can never fix.
	cli.AutoReconnectHook = func(err error) bool {
		if err == nil {
			return true
		}
		msg := err.Error()
		for _, fatal := range []string{"401", "403", "conflict", "old version", "version", "logout"} {
			if strings.Contains(strings.ToLower(msg), fatal) {
				return false
			}
		}
		return true
	}
	return cli, nil
}
