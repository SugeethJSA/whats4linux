package api

import (
	"context"
	"encoding/base64"
	"fmt"
	"log"
	"log/slog"
	"strings"
	"time"

	"github.com/lugvitc/whats4linux/internal/markdown"
	"github.com/lugvitc/whats4linux/internal/store"
	mtypes "github.com/lugvitc/whats4linux/internal/types"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waCommon"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	"google.golang.org/protobuf/proto"
)

type MessageContent struct {
	Type            string   `json:"type"`
	Text            string   `json:"text,omitempty"`
	Base64Data      string   `json:"base64Data,omitempty"`
	Mimetype        string   `json:"mimetype,omitempty"`
	FileName        string   `json:"fileName,omitempty"`
	QuotedMessageID string   `json:"quotedMessageId,omitempty"`
	Mentions        []string `json:"mentions,omitempty"`
	ClientTempID    string   `json:"clientTempId,omitempty"`
	Forwarded       bool     `json:"forwarded,omitempty"`
	// GifPlayback marks a video message as an animated GIF (whatsmeow's GIF
	// format: a video upload with the gifPlayback flag set).
	GifPlayback bool `json:"gifPlayback,omitempty"`
}

// uploadWithRetry wraps a.waClient.Upload with retries for transient network
// failures (whatsmeow's Upload performs a single HTTP request with no retry).
func (a *Api) uploadWithRetry(ctx context.Context, data []byte, appInfo whatsmeow.MediaType) (whatsmeow.UploadResponse, error) {
	const maxAttempts = 3
	var lastErr error
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		uploaded, err := a.waClient.Upload(ctx, data, appInfo)
		if err == nil {
			return uploaded, nil
		}
		lastErr = err
		if attempt < maxAttempts {
			slog.Warn(fmt.Sprintf("Media upload attempt %d/%d failed: %v", attempt, maxAttempts, err), "source", "media")
			select {
			case <-ctx.Done():
				return whatsmeow.UploadResponse{}, ctx.Err()
			case <-time.After(time.Duration(attempt) * time.Second):
			}
		}
	}
	return whatsmeow.UploadResponse{}, lastErr
}

func (a *Api) processMessageText(msg *waE2E.Message) string {
	if msg == nil {
		return ""
	}
	var text string
	var mentionedJIDs []string

	if msg.GetConversation() != "" {
		text = msg.GetConversation()
	} else if msg.GetExtendedTextMessage() != nil {
		text = msg.GetExtendedTextMessage().GetText()
		if msg.GetExtendedTextMessage().GetContextInfo() != nil {
			mentionedJIDs = msg.GetExtendedTextMessage().GetContextInfo().GetMentionedJID()
		}
	} else {
		switch {
		case msg.GetImageMessage() != nil:
			text = msg.GetImageMessage().GetCaption()
			if msg.GetImageMessage().GetContextInfo() != nil {
				mentionedJIDs = msg.GetImageMessage().GetContextInfo().GetMentionedJID()
			}
		case msg.GetVideoMessage() != nil:
			text = msg.GetVideoMessage().GetCaption()
			if msg.GetVideoMessage().GetContextInfo() != nil {
				mentionedJIDs = msg.GetVideoMessage().GetContextInfo().GetMentionedJID()
			}
		case msg.GetDocumentMessage() != nil:
			text = msg.GetDocumentMessage().GetCaption()
			if msg.GetDocumentMessage().GetContextInfo() != nil {
				mentionedJIDs = msg.GetDocumentMessage().GetContextInfo().GetMentionedJID()
			}
		}
	}

	if text == "" {
		return ""
	}

	// First convert Markdown to HTML (which handles escaping)
	htmlText := markdown.MarkdownLinesToHTML(text)

	// Then replace mentions in the HTML
	if len(mentionedJIDs) > 0 {
		htmlText = replaceMentions(htmlText, mentionedJIDs, a)
	}

	return htmlText
}

func (a *Api) FetchMessagesPaged(jid string, limit int, beforeTimestamp int64, beforeMessageID string) ([]store.DecodedMessage, error) {
	messages, err := a.messageStore.GetDecodedMessagesPaged(jid, beforeTimestamp, beforeMessageID, limit)
	if err != nil {
		return nil, err
	}
	return messages, nil
}

func buildQuotedMessage(msg *store.ExtendedMessage) *waE2E.Message {
	if msg == nil {
		return nil
	}
	var quotedMessage waE2E.Message
	if msg.ReplyToMessageID == "" {
		quotedMessage.Conversation = proto.String(msg.Text)
	} else {
		quotedMessage.ExtendedTextMessage = &waE2E.ExtendedTextMessage{
			Text: proto.String(msg.Text),
		}
	}

	if msg.Media == nil {
		return &quotedMessage
	}

	switch msg.Media.GetMediaGeneralType() {
	case mtypes.MediaTypeImage:
		width, height := msg.Media.GetDimensions()
		quotedMessage.ImageMessage = &waE2E.ImageMessage{
			URL:           proto.String(msg.Media.GetURL()),
			Mimetype:      proto.String(msg.Media.GetMimetype()),
			Caption:       proto.String(msg.Text),
			FileSHA256:    msg.Media.GetFileSHA256(),
			Width:         proto.Uint32(uint32(width)),
			Height:        proto.Uint32(uint32(height)),
			FileEncSHA256: msg.Media.GetFileEncSHA256(),
			DirectPath:    proto.String(msg.Media.GetDirectPath()),
		}
	case mtypes.MediaTypeVideo:
		quotedMessage.VideoMessage = &waE2E.VideoMessage{
			URL:           proto.String(msg.Media.GetURL()),
			Mimetype:      proto.String(msg.Media.GetMimetype()),
			Caption:       proto.String(msg.Text),
			FileSHA256:    msg.Media.GetFileSHA256(),
			FileEncSHA256: msg.Media.GetFileEncSHA256(),
			DirectPath:    proto.String(msg.Media.GetDirectPath()),
		}
	case mtypes.MediaTypeAudio:
		quotedMessage.AudioMessage = &waE2E.AudioMessage{
			URL:           proto.String(msg.Media.GetURL()),
			Mimetype:      proto.String(msg.Media.GetMimetype()),
			FileSHA256:    msg.Media.GetFileSHA256(),
			FileEncSHA256: msg.Media.GetFileEncSHA256(),
			DirectPath:    proto.String(msg.Media.GetDirectPath()),
		}
	case mtypes.MediaTypeDocument:
		quotedMessage.DocumentMessage = &waE2E.DocumentMessage{
			URL:           proto.String(msg.Media.GetURL()),
			Mimetype:      proto.String(msg.Media.GetMimetype()),
			Caption:       proto.String(msg.Text),
			FileSHA256:    msg.Media.GetFileSHA256(),
			FileEncSHA256: msg.Media.GetFileEncSHA256(),
			DirectPath:    proto.String(msg.Media.GetDirectPath()),
		}
	case mtypes.MediaTypeSticker:
		quotedMessage.StickerMessage = &waE2E.StickerMessage{
			URL:           proto.String(msg.Media.GetURL()),
			Mimetype:      proto.String(msg.Media.GetMimetype()),
			FileSHA256:    msg.Media.GetFileSHA256(),
			FileEncSHA256: msg.Media.GetFileEncSHA256(),
			DirectPath:    proto.String(msg.Media.GetDirectPath()),
		}
	default:
		break
	}

	return &quotedMessage
}

func (a *Api) buildQuotedContext(chatJID types.JID, quotedMessageID string) (*waE2E.ContextInfo, error) {
	if quotedMessageID == "" {
		return nil, nil
	}

	msg, err := a.messageStore.GetMessageWithMedia(chatJID.String(), quotedMessageID)
	if err != nil {
		return nil, fmt.Errorf("quoted message not found")
	}

	quotedMessage := buildQuotedMessage(msg)

	if quotedMessage == nil {
		return nil, fmt.Errorf("failed to build quoted message")
	}

	stanzaID := quotedMessageID
	contextInfo := &waE2E.ContextInfo{
		StanzaID:      &stanzaID,
		QuotedMessage: quotedMessage,
	}

	if msg.Info.Sender.User != "" {
		participantJID := msg.Info.Sender.ToNonAD().String()
		contextInfo.Participant = proto.String(participantJID)
	}

	return contextInfo, nil
}

// SendReaction reacts to a message with an emoji (empty emoji removes the
// reaction). senderJID is the original message's sender; empty means our own.
func (a *Api) SendReaction(chatJID, senderJID, messageID, emoji string) error {
	if a.waClient.Store.ID == nil {
		return fmt.Errorf("not logged in")
	}
	chat, err := types.ParseJID(chatJID)
	if err != nil {
		return err
	}
	sender := *a.waClient.Store.ID
	if senderJID != "" {
		if s, perr := types.ParseJID(senderJID); perr == nil {
			sender = s
		}
	}
	reactionMsg := a.waClient.BuildReaction(chat, sender, messageID, emoji)
	if _, err := a.waClient.SendMessage(a.ctx, chat, reactionMsg); err != nil {
		return err
	}
	// Persist our own reaction locally so it survives a reload.
	_ = a.messageStore.AddReactionToMessage(messageID, emoji, a.waClient.Store.ID.String())
	return nil
}

func (a *Api) SendMessage(chatJID string, content MessageContent) (string, error) {
	if a.waClient.Store.ID == nil {
		return "", fmt.Errorf("client not logged in")
	}

	parsedJID, err := types.ParseJID(chatJID)
	if err != nil {
		return "", err
	}

	var msgContent *waE2E.Message
	contextInfo, err := a.buildQuotedContext(parsedJID, content.QuotedMessageID)
	if err != nil {
		log.Println("Failed to build quoted context:", err)
		return "", err
	}
	if content.Forwarded {
		if contextInfo == nil {
			contextInfo = &waE2E.ContextInfo{}
		}
		contextInfo.IsForwarded = proto.Bool(true)
	}

	switch content.Type {
	case "text":

		mentionedJIDs := content.Mentions

		// If we have mentions or quoted context, use ExtendedTextMessage
		if len(mentionedJIDs) > 0 || contextInfo != nil {
			if contextInfo == nil {
				contextInfo = &waE2E.ContextInfo{}
			}
			if len(mentionedJIDs) > 0 {
				contextInfo.MentionedJID = mentionedJIDs
			}
			msgContent = &waE2E.Message{
				ExtendedTextMessage: &waE2E.ExtendedTextMessage{
					Text:        &content.Text,
					ContextInfo: contextInfo,
				},
			}
		} else {
			msgContent = &waE2E.Message{
				Conversation: &content.Text,
			}
		}
	case "image":
		// Decode base64 image data
		imageData, err := base64.StdEncoding.DecodeString(content.Base64Data)
		if err != nil {
			return "", fmt.Errorf("failed to decode base64 image data: %v", err)
		}

		// Create image message
		mimeType := content.Mimetype
		if mimeType == "" {
			mimeType = "image/jpeg"
		}
		imageMsg := &waE2E.ImageMessage{
			Mimetype:      &mimeType,
			Caption:       &content.Text,
			JPEGThumbnail: nil, // We'll let WhatsApp generate the thumbnail
		}

		if len(content.Mentions) > 0 || contextInfo != nil {
			if contextInfo == nil {
				contextInfo = &waE2E.ContextInfo{}
			}
			if len(content.Mentions) > 0 {
				contextInfo.MentionedJID = content.Mentions
			}
			imageMsg.ContextInfo = contextInfo
		}

		// Upload the image
		uploaded, err := a.uploadWithRetry(a.ctx, imageData, whatsmeow.MediaImage)
		if err != nil {
			return "", fmt.Errorf("failed to upload image: %v", err)
		}

		imageMsg.URL = &uploaded.URL
		imageMsg.DirectPath = &uploaded.DirectPath
		imageMsg.MediaKey = uploaded.MediaKey
		imageMsg.FileEncSHA256 = uploaded.FileEncSHA256
		imageMsg.FileSHA256 = uploaded.FileSHA256
		imageMsg.FileLength = &uploaded.FileLength

		msgContent = &waE2E.Message{
			ImageMessage: imageMsg,
		}
	case "video":
		// Decode base64 video data
		videoData, err := base64.StdEncoding.DecodeString(content.Base64Data)
		if err != nil {
			return "", fmt.Errorf("failed to decode base64 video data: %v", err)
		}

		// Create video message
		mimeType := content.Mimetype
		if mimeType == "" {
			mimeType = "video/mp4"
		}
		videoMsg := &waE2E.VideoMessage{
			Mimetype:      &mimeType,
			Caption:       &content.Text,
			JPEGThumbnail: nil, // We'll let WhatsApp generate the thumbnail
		}

		// Sending a GIF = a video message flagged for gif playback. Receivers
		// render it as a looping animation instead of a regular video.
		if content.GifPlayback {
			videoMsg.GifPlayback = proto.Bool(true)
		}

		if len(content.Mentions) > 0 || contextInfo != nil {
			if contextInfo == nil {
				contextInfo = &waE2E.ContextInfo{}
			}
			if len(content.Mentions) > 0 {
				contextInfo.MentionedJID = content.Mentions
			}
			videoMsg.ContextInfo = contextInfo
		}

		// Upload the video
		uploaded, err := a.uploadWithRetry(a.ctx, videoData, whatsmeow.MediaVideo)
		if err != nil {
			return "", fmt.Errorf("failed to upload video: %v", err)
		}

		videoMsg.URL = &uploaded.URL
		videoMsg.DirectPath = &uploaded.DirectPath
		videoMsg.MediaKey = uploaded.MediaKey
		videoMsg.FileEncSHA256 = uploaded.FileEncSHA256
		videoMsg.FileSHA256 = uploaded.FileSHA256
		videoMsg.FileLength = &uploaded.FileLength

		msgContent = &waE2E.Message{
			VideoMessage: videoMsg,
		}
	case "audio":
		// Decode base64 audio data
		audioData, err := base64.StdEncoding.DecodeString(content.Base64Data)
		if err != nil {
			return "", fmt.Errorf("failed to decode base64 audio data: %v", err)
		}

		// Create audio message
		mimeType := content.Mimetype
		if mimeType == "" {
			mimeType = "audio/ogg"
		}
		audioMsg := &waE2E.AudioMessage{
			Mimetype: &mimeType,
		}

		if contextInfo != nil {
			audioMsg.ContextInfo = contextInfo
		}

		// Upload the audio
		uploaded, err := a.uploadWithRetry(a.ctx, audioData, whatsmeow.MediaAudio)
		if err != nil {
			return "", fmt.Errorf("failed to upload audio: %v", err)
		}

		audioMsg.URL = &uploaded.URL
		audioMsg.DirectPath = &uploaded.DirectPath
		audioMsg.MediaKey = uploaded.MediaKey
		audioMsg.FileEncSHA256 = uploaded.FileEncSHA256
		audioMsg.FileSHA256 = uploaded.FileSHA256
		audioMsg.FileLength = &uploaded.FileLength

		msgContent = &waE2E.Message{
			AudioMessage: audioMsg,
		}
	case "document":
		// Decode base64 document data
		documentData, err := base64.StdEncoding.DecodeString(content.Base64Data)
		if err != nil {
			return "", fmt.Errorf("failed to decode base64 document data: %v", err)
		}

		// Create document message
		mimeType := content.Mimetype
		if mimeType == "" {
			mimeType = "application/octet-stream"
		}
		fileName := strings.TrimSpace(content.FileName)
		if fileName == "" {
			fileName = "document"
		}
		documentMsg := &waE2E.DocumentMessage{
			Mimetype: &mimeType,
			FileName: &fileName,
			Caption:  &content.Text,
		}

		if len(content.Mentions) > 0 || contextInfo != nil {
			if contextInfo == nil {
				contextInfo = &waE2E.ContextInfo{}
			}
			if len(content.Mentions) > 0 {
				contextInfo.MentionedJID = content.Mentions
			}
			documentMsg.ContextInfo = contextInfo
		}

		// Upload the document
		uploaded, err := a.uploadWithRetry(a.ctx, documentData, whatsmeow.MediaDocument)
		if err != nil {
			return "", fmt.Errorf("failed to upload document: %v", err)
		}

		documentMsg.URL = &uploaded.URL
		documentMsg.DirectPath = &uploaded.DirectPath
		documentMsg.MediaKey = uploaded.MediaKey
		documentMsg.FileEncSHA256 = uploaded.FileEncSHA256
		documentMsg.FileSHA256 = uploaded.FileSHA256
		documentMsg.FileLength = &uploaded.FileLength

		msgContent = &waE2E.Message{
			DocumentMessage: documentMsg,
		}
	case "sticker":
		// Decode base64 sticker data
		stickerData, err := base64.StdEncoding.DecodeString(content.Base64Data)
		if err != nil {
			return "", fmt.Errorf("failed to decode base64 sticker data: %v", err)
		}

		// Create sticker message
		mimeType := content.Mimetype
		if mimeType == "" {
			mimeType = "image/webp"
		}
		stickerMsg := &waE2E.StickerMessage{
			Mimetype: &mimeType,
		}

		// Upload the sticker
		uploaded, err := a.uploadWithRetry(a.ctx, stickerData, whatsmeow.MediaImage) // Stickers use MediaImage
		if err != nil {
			return "", fmt.Errorf("failed to upload sticker: %v", err)
		}

		stickerMsg.URL = &uploaded.URL
		stickerMsg.DirectPath = &uploaded.DirectPath
		stickerMsg.MediaKey = uploaded.MediaKey
		stickerMsg.FileEncSHA256 = uploaded.FileEncSHA256
		stickerMsg.FileSHA256 = uploaded.FileSHA256
		stickerMsg.FileLength = &uploaded.FileLength

		msgContent = &waE2E.Message{
			StickerMessage: stickerMsg,
		}
	default:
		return "", fmt.Errorf("unsupported message type: %s", content.Type)
	}

	log.Printf("SendMessage Content: %+v\n", msgContent)

	resp, err := a.waClient.SendMessage(a.ctx, parsedJID, msgContent)
	if err != nil {
		log.Println("SendMessage error:", err)
		return "", err
	}

	// Manually add to store and emit event so UI updates immediately
	msgEvent := &events.Message{
		Info: types.MessageInfo{
			ID:        resp.ID,
			Timestamp: resp.Timestamp,
			MessageSource: types.MessageSource{
				Chat:     parsedJID,
				IsFromMe: true,
				Sender:   *a.waClient.Store.ID,
			},
		},
		Message: msgContent,
	}
	parsedHTML := a.processMessageText(msgContent)
	messageID := a.messageStore.ProcessMessageEvent(a.ctx, a.waClient.Store.LIDs, msgEvent, parsedHTML)

	// Extract message text for chat list update
	var messageText string
	if msgContent.GetConversation() != "" {
		messageText = msgContent.GetConversation()
	} else if msgContent.GetExtendedTextMessage() != nil {
		messageText = msgContent.GetExtendedTextMessage().GetText()
	} else {
		switch {
		case msgContent.GetImageMessage() != nil:
			messageText = "image"
		case msgContent.GetVideoMessage() != nil:
			if msgContent.GetVideoMessage().GetGifPlayback() {
				messageText = "gif"
			} else {
				messageText = "video"
			}
		case msgContent.GetAudioMessage() != nil:
			messageText = "audio"
		case msgContent.GetDocumentMessage() != nil:
			messageText = "document"
		case msgContent.GetStickerMessage() != nil:
			messageText = "sticker"
		default:
			messageText = "message"
		}
	}

	var msg any
	if messageID != "" {
		decodedMsg, err := a.messageStore.GetDecodedMessage(parsedJID.String(), messageID)
		if err == nil {
			msg = decodedMsg
		}
	}

	if msg == nil {
		msg = struct {
			Info    types.MessageInfo
			Content *waE2E.Message
		}{
			Info:    msgEvent.Info,
			Content: msgEvent.Message,
		}
	}

	a.emitEvent("wa:new_message", map[string]any{
		"chatId":       parsedJID.String(),
		"message":      msg,
		"clientTempId": content.ClientTempID,
		"messageText":  messageText,
		"parsedHTML":   parsedHTML,
		"timestamp":    resp.Timestamp.Unix(),
		"sender":       "You",
	})

	return resp.ID, nil
}

// ForwardMessage retrieves the original message from sourceJID/messageID and
// forwards it to targetJID with the forwarded flag set.
func (a *Api) ForwardMessage(sourceJID, messageID, targetJID string) error {
	if a.waClient.Store.ID == nil {
		return fmt.Errorf("client not logged in")
	}

	source, err := types.ParseJID(sourceJID)
	if err != nil {
		return fmt.Errorf("invalid source JID: %v", err)
	}
	target, err := types.ParseJID(targetJID)
	if err != nil {
		return fmt.Errorf("invalid target JID: %v", err)
	}

	msg, err := a.messageStore.GetMessageWithMedia(source.String(), messageID)
	if err != nil {
		return fmt.Errorf("original message not found: %v", err)
	}

	var msgContent *waE2E.Message
	forwarded := proto.Bool(true)

	// Determine the message type from the media type
	if msg.Media != nil {
		// Media message – download original, re-upload, send with forwarded flag
		data, err := a.waClient.Download(a.ctx, msg.Media)
		if err != nil {
			return fmt.Errorf("failed to download media: %v", err)
		}

		mediaType := msg.Media.GetMediaType()
		uploaded, err := a.uploadWithRetry(a.ctx, data, mediaType)
		if err != nil {
			return fmt.Errorf("failed to upload media: %v", err)
		}

		caption := markdown.StripHTML(msg.Text)
		contextInfo := &waE2E.ContextInfo{IsForwarded: forwarded}

		switch msg.Media.GetMediaGeneralType() {
		case mtypes.MediaTypeImage:
			img := &waE2E.ImageMessage{
				Caption:       &caption,
				Mimetype:      proto.String(msg.Media.GetMimetype()),
				URL:           &uploaded.URL,
				DirectPath:    &uploaded.DirectPath,
				MediaKey:      uploaded.MediaKey,
				FileEncSHA256: uploaded.FileEncSHA256,
				FileSHA256:    uploaded.FileSHA256,
				FileLength:    &uploaded.FileLength,
				ContextInfo:   contextInfo,
			}
			msgContent = &waE2E.Message{ImageMessage: img}
		case mtypes.MediaTypeVideo:
			vid := &waE2E.VideoMessage{
				Caption:       &caption,
				Mimetype:      proto.String(msg.Media.GetMimetype()),
				URL:           &uploaded.URL,
				DirectPath:    &uploaded.DirectPath,
				MediaKey:      uploaded.MediaKey,
				FileEncSHA256: uploaded.FileEncSHA256,
				FileSHA256:    uploaded.FileSHA256,
				FileLength:    &uploaded.FileLength,
				ContextInfo:   contextInfo,
			}
			msgContent = &waE2E.Message{VideoMessage: vid}
		case mtypes.MediaTypeAudio:
			aud := &waE2E.AudioMessage{
				Mimetype:      proto.String(msg.Media.GetMimetype()),
				URL:           &uploaded.URL,
				DirectPath:    &uploaded.DirectPath,
				MediaKey:      uploaded.MediaKey,
				FileEncSHA256: uploaded.FileEncSHA256,
				FileSHA256:    uploaded.FileSHA256,
				FileLength:    &uploaded.FileLength,
				ContextInfo:   contextInfo,
			}
			msgContent = &waE2E.Message{AudioMessage: aud}
		case mtypes.MediaTypeDocument:
			doc := &waE2E.DocumentMessage{
				Caption:       &caption,
				Mimetype:      proto.String(msg.Media.GetMimetype()),
				URL:           &uploaded.URL,
				DirectPath:    &uploaded.DirectPath,
				MediaKey:      uploaded.MediaKey,
				FileEncSHA256: uploaded.FileEncSHA256,
				FileSHA256:    uploaded.FileSHA256,
				FileLength:    &uploaded.FileLength,
				ContextInfo:   contextInfo,
			}
			msgContent = &waE2E.Message{DocumentMessage: doc}
		case mtypes.MediaTypeSticker:
			sticker := &waE2E.StickerMessage{
				Mimetype:      proto.String(msg.Media.GetMimetype()),
				URL:           &uploaded.URL,
				DirectPath:    &uploaded.DirectPath,
				MediaKey:      uploaded.MediaKey,
				FileEncSHA256: uploaded.FileEncSHA256,
				FileSHA256:    uploaded.FileSHA256,
				FileLength:    &uploaded.FileLength,
			}
			msgContent = &waE2E.Message{StickerMessage: sticker}
		default:
			return fmt.Errorf("unsupported media type for forwarding")
		}
	} else {
		// Text-only message
		plainText := markdown.StripHTML(msg.Text)
		contextInfo := &waE2E.ContextInfo{IsForwarded: forwarded}
		msgContent = &waE2E.Message{
			ExtendedTextMessage: &waE2E.ExtendedTextMessage{
				Text:        &plainText,
				ContextInfo: contextInfo,
			},
		}
	}

	_, err = a.waClient.SendMessage(a.ctx, target, msgContent)
	if err != nil {
		return fmt.Errorf("failed to send forwarded message: %v", err)
	}
	return nil
}

func (a *Api) MarkRead(chatJID string, messageIDs []string, Type string) error {
	parsedChatJID, err := types.ParseJID(chatJID)
	if err != nil {
		return err
	}
	if Type == "read-msg" {
		for _, msgID := range messageIDs {
			msg, err := a.messageStore.GetMessageWithMedia(chatJID, msgID)
			if err != nil {
				log.Printf("Failed to get message %s: %v", msgID, err)
				continue
			}
			senderJID := msg.Info.Sender
			ids := []types.MessageID{msgID}
			err = a.waClient.MarkRead(a.ctx, ids, time.Now(), parsedChatJID, senderJID)
			if err != nil {
				log.Printf("MarkRead error for message %s: %v", msgID, err)
			}
		}
	}
	return nil
}

// ---- Message pins ----

// PinExpirySeconds mirrors WhatsApp's default pin duration (7 days).
const PinExpirySeconds = 7 * 24 * 60 * 60

func (a *Api) GetPinnedMessages(chatJID string) ([]store.PinnedMessage, error) {
	return a.messageStore.GetPinnedMessages(chatJID)
}

// SetMessagePinned pins or unpins a message for everyone in the chat and
// records the change locally.
func (a *Api) SetMessagePinned(chatJID, senderJID, messageID string, fromMe, pin bool) error {
	if a.waClient.Store.ID == nil {
		return fmt.Errorf("not logged in")
	}
	chat, err := types.ParseJID(chatJID)
	if err != nil {
		return err
	}

	key := &waCommon.MessageKey{
		RemoteJID: proto.String(chatJID),
		FromMe:    proto.Bool(fromMe),
		ID:        proto.String(messageID),
	}
	if chat.Server == types.GroupServer && !fromMe && senderJID != "" {
		key.Participant = proto.String(senderJID)
	}

	pinType := waE2E.PinInChatMessage_PIN_FOR_ALL
	if !pin {
		pinType = waE2E.PinInChatMessage_UNPIN_FOR_ALL
	}
	msg := &waE2E.Message{
		PinInChatMessage: &waE2E.PinInChatMessage{
			Key:               key,
			Type:              &pinType,
			SenderTimestampMS: proto.Int64(time.Now().UnixMilli()),
		},
		MessageContextInfo: &waE2E.MessageContextInfo{
			MessageAddOnDurationInSecs: proto.Uint32(uint32(PinExpirySeconds)),
		},
	}
	if _, err := a.waClient.SendMessage(a.ctx, chat, msg); err != nil {
		return err
	}

	sender := a.waClient.Store.ID.String()
	if err := a.messageStore.ApplyMessagePin(chatJID, sender, messageID, pin, PinExpirySeconds); err != nil {
		log.Println("SetMessagePinned: failed to persist:", err)
	}
	a.emitEvent("wa:pinned_update", map[string]any{"chatId": chatJID})
	return nil
}

// sendAndStoreLocal sends a prebuilt message and records it locally so the
// UI shows it immediately, mirroring SendMessage's echo path.
func (a *Api) sendAndStoreLocal(chat types.JID, msgContent *waE2E.Message, preview string) (string, error) {
	resp, err := a.waClient.SendMessage(a.ctx, chat, msgContent)
	if err != nil {
		return "", err
	}
	msgEvent := &events.Message{
		Info: types.MessageInfo{
			ID:        resp.ID,
			Timestamp: resp.Timestamp,
			MessageSource: types.MessageSource{
				Chat:     chat,
				IsFromMe: true,
				Sender:   *a.waClient.Store.ID,
			},
		},
		Message: msgContent,
	}
	messageID := a.messageStore.ProcessMessageEvent(a.ctx, a.waClient.Store.LIDs, msgEvent, "")

	var msg any
	if messageID != "" {
		if decodedMsg, derr := a.messageStore.GetDecodedMessage(chat.String(), messageID); derr == nil {
			msg = decodedMsg
		}
	}
	a.emitEvent("wa:new_message", map[string]any{
		"chatId":      chat.String(),
		"message":     msg,
		"messageText": preview,
		"timestamp":   resp.Timestamp.Unix(),
		"sender":      "You",
		"isFromMe":    true,
	})
	return resp.ID, nil
}

// SendPoll creates a poll in the chat. selectableCount 1 = single answer,
// 0 or len(options) = multiple answers allowed.
func (a *Api) SendPoll(chatJID, name string, options []string, selectableCount int) (string, error) {
	if a.waClient.Store.ID == nil {
		return "", fmt.Errorf("client not logged in")
	}
	chat, err := types.ParseJID(chatJID)
	if err != nil {
		return "", err
	}
	name = strings.TrimSpace(name)
	clean := make([]string, 0, len(options))
	for _, o := range options {
		if o = strings.TrimSpace(o); o != "" {
			clean = append(clean, o)
		}
	}
	if name == "" || len(clean) < 2 {
		return "", fmt.Errorf("a poll needs a question and at least two options")
	}
	msg := a.waClient.BuildPollCreation(name, clean, selectableCount)
	return a.sendAndStoreLocal(chat, msg, "📊 "+name)
}

// SendShareContact shares a contact card in the chat.
func (a *Api) SendShareContact(chatJID, displayName, phone string) (string, error) {
	if a.waClient.Store.ID == nil {
		return "", fmt.Errorf("client not logged in")
	}
	chat, err := types.ParseJID(chatJID)
	if err != nil {
		return "", err
	}
	displayName = strings.TrimSpace(displayName)
	digits := strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, phone)
	if (displayName == "" || digits == "") && strings.Contains(phone, "@") {
		// A JID was passed instead of a phone number (LID-only contacts carry
		// no phone in the frontend store). Resolve it to a phone number via
		// the canonical user JID.
		if jid, err := types.ParseJID(phone); err == nil {
			jid = canonicalUserJID(a.ctx, a.waClient, jid)
			if jid.Server == types.DefaultUserServer {
				digits = jid.User
			}
		}
	}
	if displayName == "" || digits == "" {
		return "", fmt.Errorf("contact needs a name and a phone number")
	}
	vcard := fmt.Sprintf(
		"BEGIN:VCARD\nVERSION:3.0\nFN:%s\nTEL;type=CELL;waid=%s:+%s\nEND:VCARD",
		displayName, digits, digits)
	msg := &waE2E.Message{
		ContactMessage: &waE2E.ContactMessage{
			DisplayName: &displayName,
			Vcard:       &vcard,
		},
	}
	return a.sendAndStoreLocal(chat, msg, "👤 "+displayName)
}

// EditMessage replaces the text of a previously-sent message. Only text
// edits are supported; media message captions can't be edited via this API.
func (a *Api) EditMessage(chatJID, messageID, newText string) (string, error) {
	if a.waClient.Store.ID == nil {
		return "", fmt.Errorf("not logged in")
	}
	chat, err := types.ParseJID(chatJID)
	if err != nil {
		return "", err
	}
	plainText := markdown.StripHTML(newText)
	msg := a.waClient.BuildEdit(chat, messageID, &waE2E.Message{
		Conversation: &plainText,
	})
	resp, err := a.waClient.SendMessage(a.ctx, chat, msg)
	if err != nil {
		return "", err
	}
	err = a.messageStore.UpdateMessageContent(messageID, &waE2E.Message{Conversation: &plainText}, "")
	if err != nil {
		log.Println("EditMessage: failed to persist edit locally:", err)
	}
	a.emitEvent("wa:chat_list_refresh")
	return resp.ID, nil
}

// RevokeMessage deletes a message for everyone in the chat (delete for
// everyone). For groups, the sender must be the original author; admins
// can revoke any message.
func (a *Api) RevokeMessage(chatJID, messageID string) error {
	if a.waClient.Store.ID == nil {
		return fmt.Errorf("not logged in")
	}
	chat, err := types.ParseJID(chatJID)
	if err != nil {
		return err
	}
	revokeMsg := a.waClient.BuildRevoke(chat, types.EmptyJID, messageID)
	_, err = a.waClient.SendMessage(a.ctx, chat, revokeMsg)
	if err != nil {
		return err
	}
	err = a.messageStore.MarkMessageDeleted(messageID)
	if err != nil {
		log.Println("RevokeMessage: failed to mark deleted locally:", err)
	}
	a.emitEvent("wa:chat_list_refresh")
	return nil
}

// SendLocation sends a location message (latitude, longitude, optional name).
func (a *Api) SendLocation(chatJID string, latitude, longitude float64, name string) (string, error) {
	if a.waClient.Store.ID == nil {
		return "", fmt.Errorf("not logged in")
	}
	chat, err := types.ParseJID(chatJID)
	if err != nil {
		return "", err
	}
	locMsg := &waE2E.Message{
		LocationMessage: &waE2E.LocationMessage{
			DegreesLatitude:  &latitude,
			DegreesLongitude: &longitude,
			Name:             &name,
		},
	}
	resp, err := a.waClient.SendMessage(a.ctx, chat, locMsg)
	if err != nil {
		return "", err
	}
	msgID := resp.ID
	slog.Info(fmt.Sprintf("Sent location to %s (%.4f, %.4f) id=%s", chatJID, latitude, longitude, msgID), "source", "messages")
	return msgID, nil
}

// DeleteForMe removes a message from the local database only. The message
// remains visible to other chat participants.
func (a *Api) DeleteForMe(_ string, messageID string) error {
	if a.waClient.Store.ID == nil {
		return fmt.Errorf("not logged in")
	}
	err := a.messageStore.MarkMessageDeleted(messageID)
	if err != nil {
		return err
	}
	a.emitEvent("wa:chat_list_refresh")
	return nil
}
