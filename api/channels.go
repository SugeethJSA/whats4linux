package api

import (
	"fmt"
	"log/slog"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types"
)

type NewsletterInfo struct {
	JID         string `json:"jid"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Picture     string `json:"picture,omitempty"`
	Subscriber  bool   `json:"subscriber"`
}

type NewsletterMessageItem struct {
	ServerID       int            `json:"server_id"`
	MessageID      string         `json:"message_id"`
	Type           string         `json:"type"`
	Timestamp      int64          `json:"timestamp"`
	ViewsCount     int            `json:"views_count"`
	ReactionCounts map[string]int `json:"reaction_counts"`
	Message        map[string]any `json:"message,omitempty"`
}

func (a *Api) GetNewsletterInfo(jidStr string) (*NewsletterInfo, error) {
	if a.waClient.Store.ID == nil {
		return nil, fmt.Errorf("not logged in")
	}
	jid, err := types.ParseJID(jidStr)
	if err != nil {
		return nil, err
	}
	meta, err := a.waClient.GetNewsletterInfo(a.ctx, jid)
	if err != nil {
		return nil, err
	}
	info := &NewsletterInfo{
		JID:  meta.ID.String(),
		Name: meta.ThreadMeta.Name.Text,
	}
	if meta.ViewerMeta != nil {
		info.Subscriber = meta.ViewerMeta.Role == types.NewsletterRoleSubscriber
	}
	if meta.ThreadMeta.Description.Text != "" {
		info.Description = meta.ThreadMeta.Description.Text
	}
	if meta.ThreadMeta.Picture != nil {
		info.Picture = meta.ThreadMeta.Picture.URL
	}
	return info, nil
}

func (a *Api) CreateNewsletter(name, description string) (string, error) {
	if a.waClient.Store.ID == nil {
		return "", fmt.Errorf("not logged in")
	}
	params := whatsmeow.CreateNewsletterParams{
		Name: name,
	}
	if description != "" {
		params.Description = description
	}
	meta, err := a.waClient.CreateNewsletter(a.ctx, params)
	if err != nil {
		return "", err
	}
	slog.Info(fmt.Sprintf("Created newsletter %s (%s)", name, meta.ID), "source", "channels")
	runtime.EventsEmit(a.ctx, "wa:chat_list_refresh")
	return meta.ID.String(), nil
}

func (a *Api) NewsletterSendReaction(jidStr string, serverID int, reaction string) error {
	if a.waClient.Store.ID == nil {
		return fmt.Errorf("not logged in")
	}
	jid, err := types.ParseJID(jidStr)
	if err != nil {
		return err
	}
	return a.waClient.NewsletterSendReaction(a.ctx, jid, serverID, reaction, "")
}

func (a *Api) NewsletterToggleMute(jidStr string, muted bool) error {
	if a.waClient.Store.ID == nil {
		return fmt.Errorf("not logged in")
	}
	jid, err := types.ParseJID(jidStr)
	if err != nil {
		return err
	}
	err = a.waClient.NewsletterToggleMute(a.ctx, jid, muted)
	if err != nil {
		return err
	}
	state := "muted"
	if !muted {
		state = "unmuted"
	}
	slog.Info(fmt.Sprintf("%s newsletter %s", state, jidStr), "source", "channels")
	return nil
}
