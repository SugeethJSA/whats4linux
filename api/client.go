package api

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"go.mau.fi/whatsmeow/types"
)

// IsLoggedIn returns true if the WhatsApp client is connected and authenticated.
func (a *Api) IsLoggedIn() bool {
	if a.waClient == nil {
		return false
	}
	return a.waClient.IsLoggedIn()
}

// ResetConnection disconnects from the WhatsApp WebSocket and forces an
// immediate reconnect. Useful when the connection is stuck or unresponsive.
func (a *Api) ResetConnection() {
	if a.waClient == nil {
		return
	}
	a.waClient.ResetConnection()
	slog.Info("Connection reset requested", "source", "auth")
}

// GenerateMessageID generates a random message ID suitable for use with
// SendMessage or other message-building APIs.
func (a *Api) GenerateMessageID() string {
	if a.waClient == nil {
		return ""
	}
	return string(a.waClient.GenerateMessageID())
}

// RemoveEventHandlers removes all registered event handlers.
func (a *Api) RemoveEventHandlers() {
	if a.waClient == nil {
		return
	}
	a.waClient.RemoveEventHandlers()
	slog.Info("All event handlers removed", "source", "auth")
}

// SetForceActiveDeliveryReceipts forces delivery receipts to be sent for
// all messages, even if the contact has disabled read receipts.
func (a *Api) SetForceActiveDeliveryReceipts(active bool) {
	if a.waClient == nil {
		return
	}
	a.waClient.SetForceActiveDeliveryReceipts(active)
	slog.Info(fmt.Sprintf("Force active delivery receipts set to %t", active), "source", "auth")
}

// WaitForConnection blocks until the client is connected or the timeout
// elapses. Returns true if the client connected successfully.
func (a *Api) WaitForConnection(timeoutSeconds int) bool {
	if a.waClient == nil {
		return false
	}
	return a.waClient.WaitForConnection(time.Duration(timeoutSeconds) * time.Second)
}

// GetBotList fetches the list of available bots from WhatsApp.
func (a *Api) GetBotList() ([]types.BotListInfo, error) {
	if a.waClient == nil {
		return nil, fmt.Errorf("WhatsApp client is not ready")
	}
	return a.waClient.GetBotListV2(a.ctx)
}

// GetBotProfiles fetches detailed profiles for the given bot list entries.
func (a *Api) GetBotProfiles(botList []types.BotListInfo) ([]types.BotProfileInfo, error) {
	if a.waClient == nil {
		return nil, fmt.Errorf("WhatsApp client is not ready")
	}
	return a.waClient.GetBotProfiles(a.ctx, botList)
}

// ConnectWithContext connects to WhatsApp using the provided context.
// This allows the caller to cancel the connection attempt.
func (a *Api) ConnectWithContext(ctx context.Context) error {
	if a.waClient == nil {
		return fmt.Errorf("WhatsApp client is not ready")
	}
	return a.waClient.ConnectContext(ctx)
}

// StoreLIDPNMapping stores a mapping between a phone number (PN) and a
// Login ID (LID) on the server.
func (a *Api) StoreLIDPNMapping(firstJID, secondJID string) error {
	if a.waClient == nil {
		return fmt.Errorf("WhatsApp client is not ready")
	}
	first, err := types.ParseJID(firstJID)
	if err != nil {
		return err
	}
	second, err := types.ParseJID(secondJID)
	if err != nil {
		return err
	}
	a.waClient.StoreLIDPNMapping(a.ctx, first, second)
	return nil
}
