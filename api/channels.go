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

func (a *Api) GetNewsletterMessages(jidStr string, count int, beforeServerID int) ([]NewsletterMessageItem, error) {
	if a.waClient.Store.ID == nil {
		return nil, fmt.Errorf("not logged in")
	}
	jid, err := types.ParseJID(jidStr)
	if err != nil {
		return nil, err
	}
	params := &whatsmeow.GetNewsletterMessagesParams{
		Count: count,
	}
	if beforeServerID > 0 {
		params.Before = types.MessageServerID(beforeServerID)
	}
	msgs, err := a.waClient.GetNewsletterMessages(a.ctx, jid, params)
	if err != nil {
		return nil, err
	}
	out := make([]NewsletterMessageItem, 0, len(msgs))
	for _, m := range msgs {
		item := NewsletterMessageItem{
			ServerID:       int(m.MessageServerID),
			MessageID:      string(m.MessageID),
			Type:           m.Type,
			Timestamp:      m.Timestamp.Unix(),
			ViewsCount:     m.ViewsCount,
			ReactionCounts: m.ReactionCounts,
		}
		out = append(out, item)
	}
	return out, nil
}

func (a *Api) GetNewsletterMessageUpdates(jidStr string, count int, afterServerID int) ([]NewsletterMessageItem, error) {
	if a.waClient.Store.ID == nil {
		return nil, fmt.Errorf("not logged in")
	}
	jid, err := types.ParseJID(jidStr)
	if err != nil {
		return nil, err
	}
	params := &whatsmeow.GetNewsletterUpdatesParams{
		Count: count,
	}
	if afterServerID > 0 {
		params.After = types.MessageServerID(afterServerID)
	}
	msgs, err := a.waClient.GetNewsletterMessageUpdates(a.ctx, jid, params)
	if err != nil {
		return nil, err
	}
	out := make([]NewsletterMessageItem, 0, len(msgs))
	for _, m := range msgs {
		out = append(out, NewsletterMessageItem{
			ServerID:       int(m.MessageServerID),
			MessageID:      string(m.MessageID),
			Type:           m.Type,
			Timestamp:      m.Timestamp.Unix(),
			ViewsCount:     m.ViewsCount,
			ReactionCounts: m.ReactionCounts,
		})
	}
	return out, nil
}

func (a *Api) GetSubscribedNewsletters() ([]NewsletterInfo, error) {
	if a.waClient.Store.ID == nil {
		return nil, fmt.Errorf("not logged in")
	}
	metas, err := a.waClient.GetSubscribedNewsletters(a.ctx)
	if err != nil {
		return nil, err
	}
	out := make([]NewsletterInfo, 0, len(metas))
	for _, meta := range metas {
		info := NewsletterInfo{
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
		out = append(out, info)
	}
	return out, nil
}

func (a *Api) NewsletterSubscribeLiveUpdates(jidStr string) (int64, error) {
	if a.waClient.Store.ID == nil {
		return 0, fmt.Errorf("not logged in")
	}
	jid, err := types.ParseJID(jidStr)
	if err != nil {
		return 0, err
	}
	dur, err := a.waClient.NewsletterSubscribeLiveUpdates(a.ctx, jid)
	if err != nil {
		return 0, err
	}
	return int64(dur.Seconds()), nil
}

func (a *Api) NewsletterMarkViewed(jidStr string, serverIDs []int) error {
	if a.waClient.Store.ID == nil {
		return fmt.Errorf("not logged in")
	}
	jid, err := types.ParseJID(jidStr)
	if err != nil {
		return err
	}
	ids := make([]types.MessageServerID, len(serverIDs))
	for i, id := range serverIDs {
		ids[i] = types.MessageServerID(id)
	}
	return a.waClient.NewsletterMarkViewed(a.ctx, jid, ids)
}

func (a *Api) NewsletterSendReaction(jidStr string, serverID int, reaction string) error {
	if a.waClient.Store.ID == nil {
		return fmt.Errorf("not logged in")
	}
	jid, err := types.ParseJID(jidStr)
	if err != nil {
		return err
	}
	return a.waClient.NewsletterSendReaction(a.ctx, jid, types.MessageServerID(serverID), reaction, "")
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

func (a *Api) GetNewsletterByInvite(inviteCode string) (*NewsletterInfo, error) {
	if a.waClient.Store.ID == nil {
		return nil, fmt.Errorf("not logged in")
	}
	meta, err := a.waClient.GetNewsletterInfoWithInvite(a.ctx, inviteCode)
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
