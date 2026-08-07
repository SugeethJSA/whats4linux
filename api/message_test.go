package api

import (
	"context"
	"strings"
	"testing"
	"time"

	mtypes "github.com/lugvitc/whats4linux/internal/types"
	"github.com/lugvitc/whats4linux/internal/wa"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/types"
	"google.golang.org/protobuf/proto"

	messageStore "github.com/lugvitc/whats4linux/internal/store"
)

const validBase64 = "aGVsbG8=" // "hello"

func TestPrepareOutgoingText(t *testing.T) {
	t.Run("plain conversation", func(t *testing.T) {
		msg, data, mediaType, label, err := prepareOutgoing(MessageContent{Type: "text", Text: "hello"}, nil)
		if err != nil {
			t.Fatalf("prepareOutgoing error = %v", err)
		}
		if msg.GetConversation() != "hello" {
			t.Fatalf("Conversation = %q, want hello", msg.GetConversation())
		}
		if data != nil || mediaType != "" || label != "" {
			t.Fatalf("unexpected media payload: data=%v mediaType=%q label=%q", data, mediaType, label)
		}
	})

	t.Run("extended with mentions", func(t *testing.T) {
		mentions := []string{"123@s.whatsapp.net"}
		msg, _, _, _, err := prepareOutgoing(MessageContent{Type: "text", Text: "hi @123", Mentions: mentions}, nil)
		if err != nil {
			t.Fatalf("prepareOutgoing error = %v", err)
		}
		ext := msg.GetExtendedTextMessage()
		if ext == nil || ext.GetText() != "hi @123" {
			t.Fatalf("ExtendedTextMessage = %+v, want text hi @123", ext)
		}
		if len(ext.GetContextInfo().GetMentionedJID()) != 1 || ext.GetContextInfo().GetMentionedJID()[0] != "123@s.whatsapp.net" {
			t.Fatalf("MentionedJID = %v, want [123@s.whatsapp.net]", ext.GetContextInfo().GetMentionedJID())
		}
	})

	t.Run("extended with quoted context", func(t *testing.T) {
		ctx := &waE2E.ContextInfo{StanzaID: proto.String("abc")}
		msg, _, _, _, err := prepareOutgoing(MessageContent{Type: "text", Text: "reply"}, ctx)
		if err != nil {
			t.Fatalf("prepareOutgoing error = %v", err)
		}
		ext := msg.GetExtendedTextMessage()
		if ext == nil || ext.GetContextInfo() != ctx {
			t.Fatalf("ExtendedTextMessage = %+v, want contextInfo preserved", ext)
		}
	})
}

func TestPrepareOutgoingMedia(t *testing.T) {
	tests := []struct {
		name        string
		content     MessageContent
		wantMedia   whatsmeow.MediaType
		wantLabel   string
		wantVariant func(msg *waE2E.Message) bool
	}{
		{
			name:      "image",
			content:   MessageContent{Type: "image", Text: "cap", Base64Data: validBase64},
			wantMedia: whatsmeow.MediaImage,
			wantLabel: "image",
			wantVariant: func(msg *waE2E.Message) bool {
				return msg.GetImageMessage() != nil && msg.GetImageMessage().GetCaption() == "cap"
			},
		},
		{
			name:      "video",
			content:   MessageContent{Type: "video", Text: "cap", Base64Data: validBase64},
			wantMedia: whatsmeow.MediaVideo,
			wantLabel: "video",
			wantVariant: func(msg *waE2E.Message) bool {
				return msg.GetVideoMessage() != nil && !msg.GetVideoMessage().GetGifPlayback()
			},
		},
		{
			name:      "gif",
			content:   MessageContent{Type: "video", Text: "cap", Base64Data: validBase64, GifPlayback: true},
			wantMedia: whatsmeow.MediaVideo,
			wantLabel: "video",
			wantVariant: func(msg *waE2E.Message) bool {
				return msg.GetVideoMessage() != nil && msg.GetVideoMessage().GetGifPlayback()
			},
		},
		{
			name:      "audio",
			content:   MessageContent{Type: "audio", Base64Data: validBase64},
			wantMedia: whatsmeow.MediaAudio,
			wantLabel: "audio",
			wantVariant: func(msg *waE2E.Message) bool {
				return msg.GetAudioMessage() != nil
			},
		},
		{
			name:      "document",
			content:   MessageContent{Type: "document", Text: "cap", FileName: "report.pdf", Base64Data: validBase64},
			wantMedia: whatsmeow.MediaDocument,
			wantLabel: "document",
			wantVariant: func(msg *waE2E.Message) bool {
				return msg.GetDocumentMessage() != nil && msg.GetDocumentMessage().GetFileName() == "report.pdf"
			},
		},
		{
			name:      "sticker",
			content:   MessageContent{Type: "sticker", Base64Data: validBase64},
			wantMedia: whatsmeow.MediaImage,
			wantLabel: "sticker",
			wantVariant: func(msg *waE2E.Message) bool {
				return msg.GetStickerMessage() != nil
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			msg, data, mediaType, label, err := prepareOutgoing(tt.content, nil)
			if err != nil {
				t.Fatalf("prepareOutgoing error = %v", err)
			}
			if !tt.wantVariant(msg) {
				t.Fatalf("unexpected message variant: %+v", msg)
			}
			if string(data) != "hello" {
				t.Fatalf("data = %q, want decoded payload", data)
			}
			if mediaType != tt.wantMedia {
				t.Fatalf("mediaType = %v, want %v", mediaType, tt.wantMedia)
			}
			if label != tt.wantLabel {
				t.Fatalf("label = %q, want %q", label, tt.wantLabel)
			}
		})
	}
}

func TestPrepareOutgoingMimeDefaults(t *testing.T) {
	msg, _, _, _, err := prepareOutgoing(MessageContent{Type: "image", Base64Data: validBase64}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if got := msg.GetImageMessage().GetMimetype(); got != "image/jpeg" {
		t.Fatalf("image mime = %q, want image/jpeg", got)
	}

	msg, _, _, _, err = prepareOutgoing(MessageContent{Type: "video", Base64Data: validBase64}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if got := msg.GetVideoMessage().GetMimetype(); got != "video/mp4" {
		t.Fatalf("video mime = %q, want video/mp4", got)
	}

	msg, _, _, _, err = prepareOutgoing(MessageContent{Type: "audio", Base64Data: validBase64}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if got := msg.GetAudioMessage().GetMimetype(); got != "audio/ogg" {
		t.Fatalf("audio mime = %q, want audio/ogg", got)
	}

	msg, _, _, _, err = prepareOutgoing(MessageContent{Type: "document", FileName: "  ", Base64Data: validBase64}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if got := msg.GetDocumentMessage().GetMimetype(); got != "application/octet-stream" {
		t.Fatalf("document mime = %q, want application/octet-stream", got)
	}
	if got := msg.GetDocumentMessage().GetFileName(); got != "document" {
		t.Fatalf("document filename = %q, want default document", got)
	}

	msg, _, _, _, err = prepareOutgoing(MessageContent{Type: "sticker", Base64Data: validBase64}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if got := msg.GetStickerMessage().GetMimetype(); got != "image/webp" {
		t.Fatalf("sticker mime = %q, want image/webp", got)
	}

	msg, _, _, _, err = prepareOutgoing(MessageContent{Type: "image", Mimetype: "image/png", Base64Data: validBase64}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if got := msg.GetImageMessage().GetMimetype(); got != "image/png" {
		t.Fatalf("explicit image mime = %q, want image/png", got)
	}
}

func TestPrepareOutgoingErrors(t *testing.T) {
	for _, mediaType := range []string{"image", "video", "audio", "document", "sticker"} {
		t.Run("invalid base64 "+mediaType, func(t *testing.T) {
			_, _, _, _, err := prepareOutgoing(MessageContent{Type: mediaType, Base64Data: "!!!not-base64!!!"}, nil)
			if err == nil || !strings.Contains(err.Error(), "failed to decode base64") {
				t.Fatalf("err = %v, want base64 decode failure", err)
			}
		})
	}

	t.Run("unsupported type", func(t *testing.T) {
		_, _, _, _, err := prepareOutgoing(MessageContent{Type: "location"}, nil)
		if err == nil || err.Error() != "unsupported message type: location" {
			t.Fatalf("err = %v, want unsupported message type", err)
		}
	})
}

func TestAttachUploadedMedia(t *testing.T) {
	uploaded := whatsmeow.UploadResponse{
		URL:           "https://media.example/img",
		DirectPath:    "/m/direct",
		MediaKey:      []byte{1, 2, 3},
		FileEncSHA256: []byte{4, 5, 6},
		FileSHA256:    []byte{7, 8, 9},
		FileLength:    42,
	}
	check := func(t *testing.T, msg *waE2E.Message) {
		t.Helper()
		var m interface {
			GetURL() string
			GetDirectPath() string
			GetMediaKey() []byte
			GetFileEncSHA256() []byte
			GetFileSHA256() []byte
			GetFileLength() uint64
		}
		switch {
		case msg.GetImageMessage() != nil:
			m = msg.ImageMessage
		case msg.GetVideoMessage() != nil:
			m = msg.VideoMessage
		case msg.GetAudioMessage() != nil:
			m = msg.AudioMessage
		case msg.GetDocumentMessage() != nil:
			m = msg.DocumentMessage
		case msg.GetStickerMessage() != nil:
			m = msg.StickerMessage
		}
		if m == nil {
			t.Fatalf("no media variant on message: %+v", msg)
		}
		if m.GetURL() != uploaded.URL || m.GetDirectPath() != uploaded.DirectPath ||
			string(m.GetMediaKey()) != string(uploaded.MediaKey) ||
			string(m.GetFileEncSHA256()) != string(uploaded.FileEncSHA256) ||
			string(m.GetFileSHA256()) != string(uploaded.FileSHA256) ||
			m.GetFileLength() != uploaded.FileLength {
			t.Fatalf("media fields not attached")
		}
	}
	for _, variant := range []MessageContent{
		{Type: "image", Base64Data: validBase64},
		{Type: "video", Base64Data: validBase64},
		{Type: "audio", Base64Data: validBase64},
		{Type: "document", Base64Data: validBase64},
		{Type: "sticker", Base64Data: validBase64},
	} {
		msg, _, _, _, err := prepareOutgoing(variant, nil)
		if err != nil {
			t.Fatal(err)
		}
		attachUploadedMedia(msg, uploaded)
		check(t, msg)
	}
}

func TestProcessMessageText(t *testing.T) {
	a := &Api{ctx: context.Background()}
	tests := []struct {
		name string
		msg  *waE2E.Message
		want string
	}{
		{"nil", nil, ""},
		{"conversation", &waE2E.Message{Conversation: proto.String("hello")}, "<p>hello</p>"},
		{"extended", &waE2E.Message{ExtendedTextMessage: &waE2E.ExtendedTextMessage{Text: proto.String("hi")}}, "<p>hi</p>"},
		{"image caption", &waE2E.Message{ImageMessage: &waE2E.ImageMessage{Caption: proto.String("pic")}}, "<p>pic</p>"},
		{"video caption", &waE2E.Message{VideoMessage: &waE2E.VideoMessage{Caption: proto.String("vid")}}, "<p>vid</p>"},
		{"document caption", &waE2E.Message{DocumentMessage: &waE2E.DocumentMessage{Caption: proto.String("doc")}}, "<p>doc</p>"},
		{"audio has no text", &waE2E.Message{AudioMessage: &waE2E.AudioMessage{}}, ""},
		{"sticker has no text", &waE2E.Message{StickerMessage: &waE2E.StickerMessage{}}, ""},
		{"empty text", &waE2E.Message{Conversation: proto.String("")}, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := a.processMessageText(tt.msg); got != tt.want {
				t.Fatalf("processMessageText() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestBuildQuotedMessage(t *testing.T) {
	if got := buildQuotedMessage(nil); got != nil {
		t.Fatalf("buildQuotedMessage(nil) = %v, want nil", got)
	}

	t.Run("text only", func(t *testing.T) {
		quoted := buildQuotedMessage(&messageStore.ExtendedMessage{Text: "hello"})
		if quoted.GetConversation() != "hello" {
			t.Fatalf("quoted = %+v, want conversation hello", quoted)
		}
	})

	t.Run("media", func(t *testing.T) {
		media := wa.NewMedia("/dp", []byte("key"), []byte("sha"), []byte("enc"),
			"https://media.example/1", "image/jpeg", 640, 480, mtypes.MediaTypeImage)
		quoted := buildQuotedMessage(&messageStore.ExtendedMessage{Text: "cap", Media: media})
		img := quoted.GetImageMessage()
		if img == nil {
			t.Fatalf("quoted = %+v, want ImageMessage", quoted)
		}
		if img.GetURL() != "https://media.example/1" || img.GetWidth() != 640 || img.GetHeight() != 480 || img.GetCaption() != "cap" {
			t.Fatalf("image fields = %+v", img)
		}
	})

	t.Run("sticker", func(t *testing.T) {
		media := wa.NewMedia("/dp", nil, nil, nil, "https://media.example/s", "image/webp", 0, 0, mtypes.MediaTypeSticker)
		quoted := buildQuotedMessage(&messageStore.ExtendedMessage{Media: media})
		if quoted.GetStickerMessage() == nil {
			t.Fatalf("quoted = %+v, want StickerMessage", quoted)
		}
	})
}

func TestBuildQuotedContext(t *testing.T) {
	a := newMediaTestAPI(t)

	if ctx, err := a.buildQuotedContext(types.JID{}, ""); err != nil || ctx != nil {
		t.Fatalf("empty quoted message id: ctx=%v err=%v, want nil nil", ctx, err)
	}
	if _, err := a.buildQuotedContext(types.JID{}, "missing-id"); err == nil || err.Error() != "quoted message not found" {
		t.Fatalf("missing quoted message err = %v, want quoted message not found", err)
	}
}

func TestFetchMessagesPaged(t *testing.T) {
	a := newMediaTestAPI(t)
	chat, _ := types.ParseJID("123@s.whatsapp.net")
	sender, _ := types.ParseJID("456@s.whatsapp.net")
	base := time.Now()
	for i := 1; i <= 3; i++ {
		info := types.MessageInfo{
			ID:        "paged-" + string(rune('0'+i)),
			Timestamp: base.Add(time.Duration(i) * time.Minute),
			MessageSource: types.MessageSource{
				Chat: chat, Sender: sender,
			},
		}
		text := "msg" + string(rune('0'+i))
		if err := a.messageStore.InsertMessage(&info, &waE2E.Message{Conversation: proto.String(text)}, text); err != nil {
			t.Fatal(err)
		}
	}
	page1, err := a.FetchMessagesPaged("123@s.whatsapp.net", 2, 0, "")
	if err != nil {
		t.Fatal(err)
	}
	if len(page1) != 2 {
		t.Fatalf("page1 has %d messages, want 2", len(page1))
	}
	cursorTime, err := time.Parse(time.RFC3339, page1[0].Info.Timestamp)
	if err != nil {
		t.Fatal(err)
	}
	page2, err := a.FetchMessagesPaged("123@s.whatsapp.net", 2, cursorTime.Unix(), page1[0].Info.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(page2) != 2 {
		t.Fatalf("page2 has %d messages, want 2", len(page2))
	}
	seen := map[string]bool{}
	for _, msg := range append(page1, page2...) {
		if seen[msg.Info.ID] {
			t.Fatalf("message %s returned on both pages", msg.Info.ID)
		}
		seen[msg.Info.ID] = true
	}
	if len(seen) != 4 {
		t.Fatalf("paged through %d distinct messages, want 4", len(seen))
	}
}

func TestDeleteForMeRequiresLogin(t *testing.T) {
	a := &Api{waClient: &whatsmeow.Client{Store: &store.Device{}}}
	if err := a.DeleteForMe("chat", "id"); err == nil || err.Error() != "not logged in" {
		t.Fatalf("DeleteForMe err = %v, want not logged in", err)
	}
}

func TestSetMessagePinnedRequiresLogin(t *testing.T) {
	a := &Api{waClient: &whatsmeow.Client{Store: &store.Device{}}}
	if err := a.SetMessagePinned("123@s.whatsapp.net", "", "id", true, true); err == nil || err.Error() != "not logged in" {
		t.Fatalf("SetMessagePinned err = %v, want not logged in", err)
	}
}
