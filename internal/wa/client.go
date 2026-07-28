package wa

import (
	"context"
	"fmt"

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
	return cli, nil
}
