package api

import (
	"fmt"
	"log/slog"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

func (a *Api) SendPollVote(chatJID, pollMessageID string, selectedOptions []string) (string, error) {
	if a.waClient.Store.ID == nil {
		return "", fmt.Errorf("not logged in")
	}
	chat, err := types.ParseJID(chatJID)
	if err != nil {
		return "", err
	}
	original, err := a.messageStore.GetDecodedMessage(chatJID, pollMessageID)
	if err != nil {
		return "", fmt.Errorf("poll message not found: %w", err)
	}
	senderJID, err := types.ParseJID(original.Info.Sender)
	if err != nil {
		return "", fmt.Errorf("invalid poll sender JID: %w", err)
	}
	pollTS, err := time.Parse(time.RFC3339, original.Info.Timestamp)
	if err != nil {
		pollTS = time.Now()
	}
	pollInfo := &types.MessageInfo{
		MessageSource: types.MessageSource{
			Chat:     chat,
			Sender:   senderJID.ToNonAD(),
			IsFromMe: original.Info.IsFromMe,
		},
		ID:        pollMessageID,
		PushName:  "",
		Timestamp: pollTS,
	}
	voteMsg, err := a.waClient.BuildPollVote(a.ctx, pollInfo, selectedOptions)
	if err != nil {
		return "", fmt.Errorf("failed to build poll vote: %w", err)
	}
	resp, err := a.waClient.SendMessage(a.ctx, chat, voteMsg)
	if err != nil {
		return "", err
	}
	slog.Info(fmt.Sprintf("Voted in poll %s in %s (%d options selected)", pollMessageID, chatJID, len(selectedOptions)), "source", "messages")
	runtime.EventsEmit(a.ctx, "wa:poll_vote_submitted", map[string]any{
		"chatId":    chatJID,
		"messageID": pollMessageID,
		"options":   selectedOptions,
	})
	runtime.EventsEmit(a.ctx, "wa:new_message", map[string]any{
		"chatId":    chatJID,
		"pollVote":  true,
		"messageID": resp.ID,
		"timestamp": resp.Timestamp.Unix(),
		"sender":    "You",
		"isFromMe":  true,
	})
	return resp.ID, nil
}

func (a *Api) handlePollVoteEvent(v *events.Message) {
	chat := v.Info.Chat.String()
	senderName := a.contactNameForJID(v.Info.Sender)
	text := "[system] " + senderName + " voted"
	msgID := fmt.Sprintf("pollvote_%s_%s", chat, v.Info.ID)
	if err := a.messageStore.InsertSystemMessage(chat, msgID, text, v.Info.Timestamp.Unix()); err != nil {
		slog.Warn(fmt.Sprintf("Failed to store poll vote system message: %v", err), "source", "polls")
	}

	var msg any
	if dm, err := a.messageStore.GetDecodedMessage(chat, msgID); err == nil {
		msg = dm
	}
	if msg == nil {
		// must not be nil — use a generic object as fallback
		msg = struct {
			Info struct {
				ID string `json:"ID"`
			} `json:"Info"`
		}{Info: struct {
			ID string `json:"ID"`
		}{ID: msgID}}
	}

	runtime.EventsEmit(a.ctx, "wa:new_message", map[string]any{
		"chatId":      chat,
		"message":     msg,
		"messageText": text,
		"timestamp":   v.Info.Timestamp.Unix(),
		"sender":      senderName,
		"pollVote":    true,
	})
	runtime.EventsEmit(a.ctx, "wa:chat_list_refresh")
}
