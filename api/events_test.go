package api

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/lugvitc/whats4linux/internal/cache"
	"github.com/lugvitc/whats4linux/internal/misc"
	messageStore "github.com/lugvitc/whats4linux/internal/store"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/proto/waSyncAction"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	"google.golang.org/protobuf/proto"
)

type emittedEvent struct {
	name string
	data []any
}

type emitCapture struct {
	mu     sync.Mutex
	events []emittedEvent
}

func (c *emitCapture) capture(name string, data ...any) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.events = append(c.events, emittedEvent{name: name, data: data})
}

func (c *emitCapture) last(name string) ([]any, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for i := len(c.events) - 1; i >= 0; i-- {
		if c.events[i].name == name {
			return c.events[i].data, true
		}
	}
	return nil, false
}

func (c *emitCapture) has(name string) bool {
	_, ok := c.last(name)
	return ok
}

// fakeLIDStore satisfies whatsmeow's LIDStore without a real device so
// ProcessMessageEvent's migration hooks are no-ops.
type fakeLIDStore struct{}

func (fakeLIDStore) PutManyLIDMappings(_ context.Context, _ []store.LIDMapping) error { return nil }
func (fakeLIDStore) PutLIDMapping(_ context.Context, _, _ types.JID) error            { return nil }
func (fakeLIDStore) GetPNForLID(_ context.Context, _ types.JID) (types.JID, error)    { return types.JID{}, nil }
func (fakeLIDStore) GetLIDForPN(_ context.Context, _ types.JID) (types.JID, error)    { return types.JID{}, nil }
func (fakeLIDStore) GetManyLIDsForPNs(_ context.Context, _ []types.JID) (map[types.JID]types.JID, error) {
	return nil, nil
}

func newEventsTestAPI(t *testing.T) (*Api, *emitCapture) {
	t.Helper()
	oldConfigDir := misc.ConfigDir
	misc.ConfigDir = t.TempDir()
	t.Setenv("XDG_CACHE_HOME", t.TempDir())
	t.Cleanup(func() { misc.ConfigDir = oldConfigDir })

	ms, err := messageStore.NewMessageStore()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = ms.Close() })

	imageCache, err := cache.NewImageCache()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = imageCache.Close() })

	capture := &emitCapture{}
	return &Api{
		ctx:          context.Background(),
		messageStore: ms,
		imageCache:   imageCache,
		waClient:     &whatsmeow.Client{Store: &store.Device{LIDs: fakeLIDStore{}}},
		emit:         capture.capture,
	}, capture
}

func TestEventHandlerReceiptEmit(t *testing.T) {
	a, capture := newEventsTestAPI(t)
	chat, _ := types.ParseJID("123@s.whatsapp.net")

	a.mainEventHandler(&events.Receipt{
		MessageSource: types.MessageSource{Chat: chat},
		MessageIDs:    []types.MessageID{"m1", "m2"},
		Type:          types.ReceiptTypeRead,
	})

	data, ok := capture.last("wa:message_receipt")
	if !ok {
		t.Fatal("wa:message_receipt not emitted")
	}
	payload, ok := data[0].(map[string]any)
	if !ok {
		t.Fatalf("payload = %T, want map", data[0])
	}
	if payload["chatId"] != "123@s.whatsapp.net" {
		t.Fatalf("chatId = %v", payload["chatId"])
	}
	if ids, ok := payload["messageIDs"].([]types.MessageID); !ok || len(ids) != 2 {
		t.Fatalf("messageIDs = %v", payload["messageIDs"])
	}
	if payload["status"] != "types.ReceiptTypeRead" {
		t.Fatalf("status = %v, want types.ReceiptTypeRead", payload["status"])
	}
}

func TestEventHandlerPresenceEmit(t *testing.T) {
	a, capture := newEventsTestAPI(t)
	from, _ := types.ParseJID("123@s.whatsapp.net")
	lastSeen := time.Date(2026, 8, 7, 12, 0, 0, 0, time.UTC)

	a.mainEventHandler(&events.Presence{From: from, Unavailable: true, LastSeen: lastSeen})

	data, ok := capture.last("wa:presence")
	if !ok {
		t.Fatal("wa:presence not emitted")
	}
	payload := data[0].(map[string]any)
	if payload["jid"] != "123@s.whatsapp.net" || payload["unavailable"] != true || payload["lastSeen"] != lastSeen.UnixMilli() {
		t.Fatalf("payload = %v", payload)
	}
}

func TestEventHandlerChatPresenceEmit(t *testing.T) {
	a, capture := newEventsTestAPI(t)
	chat, _ := types.ParseJID("123@s.whatsapp.net")

	a.mainEventHandler(&events.ChatPresence{
		MessageSource: types.MessageSource{Chat: chat},
		State:         types.ChatPresenceComposing,
		Media:         types.ChatPresenceMediaText,
	})

	data, ok := capture.last("wa:chat_presence")
	if !ok {
		t.Fatal("wa:chat_presence not emitted")
	}
	payload := data[0].(map[string]any)
	if payload["chatId"] != "123@s.whatsapp.net" || payload["state"] != "composing" || payload["media"] != "" {
		t.Fatalf("payload = %v", payload)
	}
}

func TestEventHandlerLabelChatEmit(t *testing.T) {
	a, capture := newEventsTestAPI(t)
	chat, _ := types.ParseJID("123@s.whatsapp.net")

	a.mainEventHandler(&events.LabelAssociationChat{
		JID:     chat,
		LabelID: "5",
		Action:  &waSyncAction.LabelAssociationAction{Labeled: proto.Bool(true)},
	})

	data, ok := capture.last("wa:label_chat")
	if !ok {
		t.Fatal("wa:label_chat not emitted")
	}
	payload := data[0].(map[string]any)
	if payload["jid"] != "123@s.whatsapp.net" || payload["labelId"] != "5" || payload["labeled"] != true {
		t.Fatalf("payload = %v", payload)
	}
}

func TestEventHandlerNewsletterJoinLeaveEmits(t *testing.T) {
	a, capture := newEventsTestAPI(t)
	id, _ := types.ParseJID("123@newsletter")

	a.mainEventHandler(&events.NewsletterJoin{NewsletterMetadata: types.NewsletterMetadata{ID: id}})
	if !capture.has("wa:newsletter_joined") || !capture.has("wa:chat_list_refresh") {
		t.Fatalf("join emits = %v", capture.events)
	}
	if data, _ := capture.last("wa:newsletter_joined"); data[0] != "123@newsletter" {
		t.Fatalf("newsletter_joined payload = %v", data)
	}

	a.mainEventHandler(&events.NewsletterLeave{ID: id})
	if !capture.has("wa:newsletter_left") || !capture.has("wa:chat_list_refresh") {
		t.Fatalf("leave emits = %v", capture.events)
	}
}

func TestEventHandlerPictureEmit(t *testing.T) {
	a, capture := newEventsTestAPI(t)
	jid, _ := types.ParseJID("123@s.whatsapp.net")

	a.mainEventHandler(&events.Picture{JID: jid})

	if data, ok := capture.last("wa:picture_update"); !ok || data[0] != "123@s.whatsapp.net" {
		t.Fatalf("wa:picture_update payload = %v ok=%v", data, ok)
	}
}

func TestEventHandlerMessageEmit(t *testing.T) {
	a, capture := newEventsTestAPI(t)
	chat, _ := types.ParseJID("123@s.whatsapp.net")
	sender, _ := types.ParseJID("456@s.whatsapp.net")

	a.mainEventHandler(&events.Message{
		Info: types.MessageInfo{
			ID:        "evt-1",
			Timestamp: time.Now(),
			MessageSource: types.MessageSource{
				Chat: chat, Sender: sender,
			},
		},
		Message: &waE2E.Message{Conversation: proto.String("hello")},
	})

	data, ok := capture.last("wa:new_message")
	if !ok {
		t.Fatal("wa:new_message not emitted")
	}
	payload, ok := data[0].(map[string]any)
	if !ok {
		t.Fatalf("payload = %T, want map", data[0])
	}
	if payload["chatId"] != "123@s.whatsapp.net" {
		t.Fatalf("chatId = %v", payload["chatId"])
	}
	if payload["isFromMe"] != false {
		t.Fatalf("isFromMe = %v, want false", payload["isFromMe"])
	}
	if payload["message"] == nil {
		t.Fatal("message payload is nil, want decoded message")
	}
}
