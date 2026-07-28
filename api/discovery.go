package api

import (
	"fmt"
	"log/slog"
	"strings"

	"go.mau.fi/whatsmeow/types"
)

type OnWhatsAppResult struct {
	Query         string  `json:"query"`
	JID           string  `json:"jid"`
	IsOnWhatsApp  bool    `json:"is_on_whatsapp"`
	VerifiedName  string  `json:"verified_name,omitempty"`
}

type UserInfoResult struct {
	JID          string   `json:"jid"`
	Status       string   `json:"status,omitempty"`
	PictureID    string   `json:"picture_id,omitempty"`
	Devices      []string `json:"devices,omitempty"`
	VerifiedName string   `json:"verified_name,omitempty"`
}

func (a *Api) IsOnWhatsApp(phoneNumbers []string) ([]OnWhatsAppResult, error) {
	if a.waClient.Store.ID == nil {
		return nil, fmt.Errorf("not logged in")
	}
	cleaned := make([]string, len(phoneNumbers))
	for i, p := range phoneNumbers {
		p = strings.TrimSpace(p)
		if !strings.HasPrefix(p, "+") {
			p = "+" + p
		}
		cleaned[i] = p
	}
	results, err := a.waClient.IsOnWhatsApp(a.ctx, cleaned)
	if err != nil {
		return nil, err
	}
	out := make([]OnWhatsAppResult, 0, len(results))
	for _, r := range results {
		res := OnWhatsAppResult{
			Query:        r.Query,
			JID:          r.JID.String(),
			IsOnWhatsApp: r.IsIn,
		}
		if r.VerifiedName != nil {
			res.VerifiedName = r.VerifiedName.Details.GetVerifiedName()
		}
		out = append(out, res)
	}
	slog.Info(fmt.Sprintf("Checked %d numbers on WhatsApp", len(results)), "source", "contacts")
	return out, nil
}

func (a *Api) GetUserInfo(jidStrs []string) ([]UserInfoResult, error) {
	if a.waClient.Store.ID == nil {
		return nil, fmt.Errorf("not logged in")
	}
	jids := make([]types.JID, len(jidStrs))
	for i, s := range jidStrs {
		jid, err := types.ParseJID(s)
		if err != nil {
			return nil, fmt.Errorf("invalid JID %s: %w", s, err)
		}
		jids[i] = jid.ToNonAD()
	}
	infoMap, err := a.waClient.GetUserInfo(a.ctx, jids)
	if err != nil {
		return nil, err
	}
	out := make([]UserInfoResult, 0, len(infoMap))
	for jid, info := range infoMap {
		res := UserInfoResult{
			JID:       jid.String(),
			Status:    info.Status,
			PictureID: info.PictureID,
		}
		if info.VerifiedName != nil {
			res.VerifiedName = info.VerifiedName.Details.GetVerifiedName()
		}
		for _, d := range info.Devices {
			res.Devices = append(res.Devices, d.String())
		}
		out = append(out, res)
	}
	return out, nil
}

func (a *Api) GetContactQRLink(revoke bool) (string, error) {
	if a.waClient.Store.ID == nil {
		return "", fmt.Errorf("not logged in")
	}
	return a.waClient.GetContactQRLink(a.ctx, revoke)
}
