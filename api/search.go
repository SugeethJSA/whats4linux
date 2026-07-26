package api

import (
	"strings"

	"go.mau.fi/whatsmeow/types"
)

type SearchResult struct {
	ChatJID   string `json:"chat_jid"`
	MessageID string `json:"message_id"`
	SenderJID string `json:"sender_jid"`
	Timestamp int64  `json:"timestamp"`
	Text      string `json:"text"`
	IsFromMe  bool   `json:"is_from_me"`
	HasMedia  bool   `json:"has_media"`
	MediaType int    `json:"media_type"`
	Edited    bool   `json:"edited"`
	Forwarded bool   `json:"forwarded"`
	ChatName  string `json:"chat_name"`
}

type SearchParams struct {
	Query     string `json:"query"`
	Type      string `json:"type,omitempty"`
	SenderJID string `json:"sender_jid,omitempty"`
	Limit     int    `json:"limit,omitempty"`
	Offset    int    `json:"offset,omitempty"`
}

func (a *Api) SearchMessages(params SearchParams) ([]SearchResult, error) {
	if params.Query == "" {
		return nil, nil
	}
	limit := params.Limit
	if limit <= 0 {
		limit = 50
	}
	offset := params.Offset
	if offset < 0 {
		offset = 0
	}

	results, err := a.messageStore.SearchMessages(params.Query, params.Type, params.SenderJID, limit, offset)
	if err != nil {
		return nil, err
	}

	out := make([]SearchResult, len(results))
	for i, r := range results {
		out[i] = SearchResult{
			ChatJID:   r.ChatJID,
			MessageID: r.MessageID,
			SenderJID: r.SenderJID,
			Timestamp: r.Timestamp,
			Text:      r.Text,
			IsFromMe:  r.IsFromMe,
			HasMedia:  r.HasMedia,
			MediaType: r.MediaType,
			Edited:    r.Edited,
			Forwarded: r.Forwarded,
			ChatName:  a.resolveChatName(r.ChatJID),
		}
	}
	return out, nil
}

func (a *Api) GetSearchSuggestions(query string, limit int) ([]string, error) {
	if query == "" || limit <= 0 {
		return nil, nil
	}
	jids, err := a.messageStore.SearchSuggestions(query, limit)
	if err != nil {
		return nil, err
	}
	names := make([]string, 0, len(jids))
	seen := make(map[string]struct{}, len(jids))
	for _, jid := range jids {
		name := a.resolveChatName(jid)
		if name == "" {
			if idx := strings.IndexByte(jid, '@'); idx > 0 {
				name = jid[:idx]
			} else {
				name = jid
			}
		}
		if _, ok := seen[name]; ok {
			continue
		}
		seen[name] = struct{}{}
		names = append(names, name)
	}
	return names, nil
}

func (a *Api) resolveChatName(chatJID string) string {
	jid, err := types.ParseJID(chatJID)
	if err != nil {
		if idx := strings.IndexByte(chatJID, '@'); idx > 0 {
			return chatJID[:idx]
		}
		return chatJID
	}

	switch jid.Server {
	case types.GroupServer:
		if g, err := a.cw.FetchGroup(jid.String()); err == nil && g.Name != "" {
			return g.Name
		}
	default:
		contact, err := a.waClient.Store.Contacts.GetContact(a.ctx, jid.ToNonAD())
		if err == nil {
			name := contact.FullName
			if name == "" {
				name = contact.PushName
			}
			if name == "" {
				name = contact.FirstName
			}
			if name != "" {
				return name
			}
		}
	}

	return jid.User
}
