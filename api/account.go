package api

import (
	"fmt"
	"log/slog"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/appstate"
	"go.mau.fi/whatsmeow/types"
)

type StickerPackResult struct {
	PackID      string            `json:"pack_id"`
	Name        string            `json:"name"`
	Publisher   string            `json:"publisher"`
	Description string            `json:"description,omitempty"`
	Stickers    []StickerPackItem `json:"stickers,omitempty"`
}

type StickerPackItem struct {
	ID       string `json:"id"`
	Emoji    string `json:"emoji,omitempty"`
	Mimetype string `json:"mimetype,omitempty"`
	Height   int    `json:"height,omitempty"`
	Width    int    `json:"width,omitempty"`
}

type BusinessLinkResult struct {
	JID          string `json:"jid"`
	PushName     string `json:"push_name"`
	VerifiedName string `json:"verified_name,omitempty"`
	Message      string `json:"message,omitempty"`
}

type ContactQRLinkResult struct {
	JID      string `json:"jid"`
	PushName string `json:"push_name,omitempty"`
	Type     string `json:"type,omitempty"`
}

func (a *Api) SetProxy(proxyURL string) error {
	if a.waClient == nil {
		return fmt.Errorf("client not ready")
	}
	return a.waClient.SetProxyAddress(proxyURL)
}

func (a *Api) FetchStickerPack(packID string) (*StickerPackResult, error) {
	if a.waClient.Store.ID == nil {
		return nil, fmt.Errorf("not logged in")
	}
	pack, err := a.waClient.FetchStickerPack(a.ctx, packID)
	if err != nil {
		return nil, err
	}
	res := &StickerPackResult{
		PackID:      pack.StickerPackID,
		Name:        pack.Name,
		Publisher:   pack.Publisher,
		Description: pack.Description,
	}
	for _, s := range pack.Stickers {
		var emoji string
		if len(s.Emojis) > 0 {
			emoji = s.Emojis[0]
		}
		res.Stickers = append(res.Stickers, StickerPackItem{
			Emoji:    emoji,
			Mimetype: s.MimeType,
			Height:   s.Height,
			Width:    s.Width,
		})
	}
	return res, nil
}

func (a *Api) ResolveBusinessMessageLink(code string) (*BusinessLinkResult, error) {
	if a.waClient.Store.ID == nil {
		return nil, fmt.Errorf("not logged in")
	}
	target, err := a.waClient.ResolveBusinessMessageLink(a.ctx, code)
	if err != nil {
		return nil, err
	}
	res := &BusinessLinkResult{
		JID:      target.JID.String(),
		PushName: target.PushName,
		Message:  target.Message,
	}
	if target.VerifiedName != "" {
		res.VerifiedName = target.VerifiedName
	}
	return res, nil
}

func (a *Api) ResolveContactQRLink(code string) (*ContactQRLinkResult, error) {
	if a.waClient.Store.ID == nil {
		return nil, fmt.Errorf("not logged in")
	}
	target, err := a.waClient.ResolveContactQRLink(a.ctx, code)
	if err != nil {
		return nil, err
	}
	return &ContactQRLinkResult{
		JID:      target.JID.String(),
		PushName: target.PushName,
		Type:     target.Type,
	}, nil
}

func (a *Api) DeleteMedia(directPath, _, fileEncSHA256, _ string) error {
	if a.waClient.Store.ID == nil {
		return fmt.Errorf("not logged in")
	}
	return a.waClient.DeleteMedia(a.ctx, whatsmeow.MediaLinkThumbnail, directPath, []byte(fileEncSHA256), "")
}

func (a *Api) ToggleChatLabel(jidStr, labelID string, labeled bool) error {
	if a.waClient.Store.ID == nil {
		return fmt.Errorf("not logged in")
	}
	jid, err := types.ParseJID(jidStr)
	if err != nil {
		return err
	}
	if err := a.waClient.SendAppState(a.ctx, appstate.BuildLabelChat(jid, labelID, labeled)); err != nil {
		return err
	}
	slog.Info(fmt.Sprintf("Label %s on %s: %v", labelID, jidStr, labeled), "source", "chats")
	runtime.EventsEmit(a.ctx, "wa:chat_list_refresh")
	return nil
}

func (a *Api) EditLabel(labelID, name string, color int32, deleted bool) error {
	if a.waClient.Store.ID == nil {
		return fmt.Errorf("not logged in")
	}
	if err := a.waClient.SendAppState(a.ctx, appstate.BuildLabelEdit(labelID, name, color, deleted)); err != nil {
		return err
	}
	slog.Info(fmt.Sprintf("Label %s edited", labelID), "source", "chats")
	runtime.EventsEmit(a.ctx, "wa:chat_list_refresh")
	return nil
}

func (a *Api) ToggleMessageLabel(jidStr, messageID, labelID string, labeled bool) error {
	if a.waClient.Store.ID == nil {
		return fmt.Errorf("not logged in")
	}
	jid, err := types.ParseJID(jidStr)
	if err != nil {
		return err
	}
	if err := a.waClient.SendAppState(a.ctx, appstate.BuildLabelMessage(jid, labelID, messageID, labeled)); err != nil {
		return err
	}
	slog.Info(fmt.Sprintf("Label %s on message %s in %s: %v", labelID, messageID, jidStr, labeled), "source", "chats")
	return nil
}

func (a *Api) SetPushName(name string) error {
	if a.waClient.Store.ID == nil {
		return fmt.Errorf("not logged in")
	}
	if err := a.waClient.SendAppState(a.ctx, appstate.BuildSettingPushName(name)); err != nil {
		return err
	}
	slog.Info(fmt.Sprintf("Set push name to %q", name), "source", "profile")
	runtime.EventsEmit(a.ctx, "wa:chat_list_refresh")
	return nil
}
