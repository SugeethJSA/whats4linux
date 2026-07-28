package api

import (
	"fmt"
	"log/slog"
)

type StatusPrivacyEntry struct {
	Type      string   `json:"type"`
	JIDs      []string `json:"jids,omitempty"`
	IsDefault bool     `json:"is_default"`
}

func (a *Api) SetStatusMessage(text string) error {
	if a.waClient.Store.ID == nil {
		return fmt.Errorf("not logged in")
	}
	err := a.waClient.SetStatusMessage(a.ctx, text)
	if err != nil {
		return err
	}
	slog.Info(fmt.Sprintf("Set status message to %q", text), "source", "profile")
	return nil
}

func (a *Api) GetStatusPrivacy() ([]StatusPrivacyEntry, error) {
	if a.waClient.Store.ID == nil {
		return nil, fmt.Errorf("not logged in")
	}
	entries, err := a.waClient.GetStatusPrivacy(a.ctx)
	if err != nil {
		return nil, err
	}
	out := make([]StatusPrivacyEntry, 0, len(entries))
	for _, e := range entries {
		jids := make([]string, len(e.List))
		for i, j := range e.List {
			jids[i] = j.String()
		}
		out = append(out, StatusPrivacyEntry{
			Type:      string(e.Type),
			JIDs:      jids,
			IsDefault: e.IsDefault,
		})
	}
	return out, nil
}
