package api

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"log/slog"
	"os"
	"regexp"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gen2brain/beeep"

	"github.com/lugvitc/whats4linux/internal/cache"
	"github.com/lugvitc/whats4linux/internal/misc"
	"github.com/lugvitc/whats4linux/internal/settings"
	"github.com/lugvitc/whats4linux/internal/store"
	"github.com/lugvitc/whats4linux/internal/wa"
	"github.com/lugvitc/whats4linux/shared/socket"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/appstate"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
	"github.com/purpshell/meowcaller"
)

// Api struct
type Api struct {
	ctx                 context.Context
	cw                  *wa.AppDatabase
	waClient            *whatsmeow.Client
	messageStore        *store.MessageStore
	imageCache          *cache.ImageCache
	us                  *socket.UnixSocket
	waContainer         *sqlstore.Container
	callClient          *meowcaller.Client
	sessionDB           *sql.DB
	eventHandlerID      uint32
	eventHandlerSet     bool
	startupErr          error
	loginCancel         context.CancelFunc
	lifecycleMu         sync.Mutex
	loginMu             sync.Mutex
	eventMu             sync.RWMutex
	taskMu              sync.Mutex
	backgroundTasks     sync.WaitGroup
	shuttingDown        bool
	windowFocused       atomic.Bool
	groupRepairInFlight atomic.Bool
	appStateResync      atomic.Bool

	taskCh   chan func()
	workerWg sync.WaitGroup
}

// repairGroupNames heals whats4linux_groups rows that are missing or were
// stored with an empty name during early history sync. It runs in the
// background after the client connects (never on the GetChatList hot path,
// which must stay local-only and instant) and tells the frontend to reload
// the chat list once anything was fixed.
func (a *Api) repairGroupNames() {
	if !a.groupRepairInFlight.CompareAndSwap(false, true) {
		return
	}
	defer a.groupRepairInFlight.Store(false)

	repaired := 0
	for _, cm := range a.messageStore.GetChatList() {
		if cm.JID.Server != types.GroupServer {
			continue
		}
		if g, err := a.cw.FetchGroup(cm.JID.String()); err == nil && g.Name != "" {
			continue
		}
		gi, err := a.waClient.GetGroupInfo(a.ctx, cm.JID)
		if err != nil || gi == nil || gi.GroupName.Name == "" {
			continue
		}
		parentJID := ""
		if !gi.LinkedParentJID.IsEmpty() {
			parentJID = gi.LinkedParentJID.String()
		}
		if err := a.cw.StoreGroup(wa.Group{
			JID:              cm.JID.String(),
			Name:             gi.GroupName.Name,
			Topic:            gi.GroupTopic.Topic,
			OwnerJID:         gi.OwnerJID.String(),
			ParticipantCount: len(gi.Participants),
			ParentJID:        parentJID,
			ParentName:       a.cw.ParentCommunityName(parentJID),
			IsParent:         gi.IsParent,
			IsDefaultSub:     gi.IsDefaultSubGroup,
		}); err != nil {
			log.Println("repairGroupNames: failed to persist group:", cm.JID.String(), err)
			continue
		}
		repaired++
	}

	if repaired > 0 {
		log.Printf("repairGroupNames: repaired %d group name(s)", repaired)
		runtime.EventsEmit(a.ctx, "wa:chat_list_refresh")
	}
}

// resyncAppState fully syncs the regular_low app state collection (archive,
// pin and mute mutations). When the local hash chain is corrupted
// ("mismatching LTHash"), incremental sync fails forever and mutations from
// the phone never arrive — recover by dropping the local version and pulling
// the collection from scratch. Runs in the background after Connected.
func (a *Api) resyncAppState() {
	if !a.appStateResync.CompareAndSwap(false, true) {
		return
	}
	defer a.appStateResync.Store(false)

	// regular_low carries archive/pin mutations, regular_high carries mutes.
	// FetchAppState with fullSync=true resets the local version itself and
	// re-applies the collection from a server snapshot; with
	// EmitAppStateEventsOnFullSync set, every mutation is dispatched to
	// mainEventHandler (FromFullSync=true) and lands in our tables.
	//
	// critical_block and critical_unblock_low are NOT full-synced here —
	// those collections are huge and fullSync destroys the version before the
	// network round-trip completes, so a failure wipes the version entirely.
	// Instead, critical_unblock_low is fetched without fullSync (preserving
	// any existing mutation MACs); if its version was never stored (0), the
	// internal fullSync code path still fetches the full snapshot.
	//
	// This is necessary because whatsmeow's auto-sync in
	// handleAppStateSyncKeyShare only fires during initial pairing or key
	// renewal — NOT on every connect.
	for _, name := range []appstate.WAPatchName{appstate.WAPatchRegularLow, appstate.WAPatchRegularHigh} {
		slog.Info(fmt.Sprintf("Starting app state full sync for %s", name), "source", "appstate")
		if err := a.waClient.FetchAppState(a.ctx, name, true, false); err != nil {
			slog.Error(fmt.Sprintf("App state full sync failed for %s: %v", name, err), "source", "appstate")
			a.emitError(fmt.Sprintf("App state sync failed: %s — %v", name, err))
			continue
		}
		slog.Info(fmt.Sprintf("App state fully synced: %s", name), "source", "appstate")
	}
	slog.Info(fmt.Sprintf("Starting app state sync for %s", appstate.WAPatchCriticalBlock), "source", "appstate")
	if err := a.waClient.FetchAppState(a.ctx, appstate.WAPatchCriticalBlock, false, false); err != nil {
		slog.Error(fmt.Sprintf("Block list sync failed: %v", err), "source", "appstate")
	}
	slog.Info(fmt.Sprintf("Starting app state sync for %s", appstate.WAPatchCriticalUnblockLow), "source", "appstate")
	if err := a.waClient.FetchAppState(a.ctx, appstate.WAPatchCriticalUnblockLow, false, false); err != nil {
		slog.Error(fmt.Sprintf("Contact sync failed: %v", err), "source", "appstate")
		a.emitError(fmt.Sprintf("Contact sync failed: %v", err))
	}
	// Log contact sync status for diagnostics
	if versions, _, err := a.waClient.Store.AppState.GetAppStateVersion(a.ctx, string(appstate.WAPatchCriticalUnblockLow)); err == nil && versions > 0 {
		contacts, _ := a.waClient.Store.Contacts.GetAllContacts(a.ctx)
		slog.Info(fmt.Sprintf("Synced %d entries (version %d)", len(contacts), versions), "source", "contacts")
	} else if err != nil {
		slog.Error(fmt.Sprintf("Version check failed: %v", err), "source", "contacts")
	} else {
		slog.Warn("Sync has never completed (version 0)", "source", "contacts")
	}
	slog.Info("Resync complete", "source", "appstate")
	runtime.EventsEmit(a.ctx, "wa:chat_list_refresh")
	// Purge empty contact stubs that have no data at all (no push_name,
	// no first_name, no full_name, no business_name). These accumulate
	// when app state sync runs but receives ContactAction mutations with
	// empty name fields.
	if a.sessionDB != nil {
		res, err := a.sessionDB.ExecContext(a.ctx,
			`DELETE FROM whatsmeow_contacts
			 WHERE (first_name IS NULL OR first_name = '')
			   AND (full_name IS NULL OR full_name = '')
			   AND (push_name IS NULL OR push_name = '')
			   AND (business_name IS NULL OR business_name = '')`)
		if err != nil {
			slog.Error(fmt.Sprintf("Failed to purge empty stubs: %v", err), "source", "contacts")
		} else if n, _ := res.RowsAffected(); n > 0 {
			slog.Info(fmt.Sprintf("Purged %d empty stubs", n), "source", "contacts")
		}
	}
}

// reconnectLoop is started as a background goroutine after an unexpected
// disconnect. It waits a few seconds, then tries to reconnect with
// exponential backoff. Successful reconnect triggers the Connected event,
// which re-runs group init, app-state resync, LID migration, etc.
// Stops when the app shuts down (isShuttingDown returns true) or after
// maxAttempts failed tries.
func (a *Api) reconnectLoop() {
	runtime.EventsEmit(a.ctx, "wa:status", "reconnecting")
	backoff := 2 * time.Second
	maxBackoff := 30 * time.Second
	for i := 0; i < 8; i++ {
		select {
		case <-a.ctx.Done():
			return
		case <-time.After(backoff):
		}
		if a.isShuttingDown() {
			return
		}
		slog.Info(fmt.Sprintf("Attempt %d/8...", i+1), "source", "reconnect")
		if err := a.waClient.Connect(); err != nil {
			slog.Warn(fmt.Sprintf("Attempt %d failed: %v", i+1, err), "source", "reconnect")
			if backoff < maxBackoff {
				backoff = time.Duration(float64(backoff) * 1.5)
			}
			continue
		}
		slog.Info("Reconnect successful", "source", "reconnect")
		return
	}
	slog.Error("All attempts exhausted — staying disconnected", "source", "reconnect")
	runtime.EventsEmit(a.ctx, "wa:status", "disconnected")
	runtime.EventsEmit(a.ctx, "wa:error", "Could not reconnect to WhatsApp after 8 attempts.")
}

func (a *Api) emitError(msg string) {
	slog.Error(msg, "source", "app")
	runtime.EventsEmit(a.ctx, "wa:error", msg)
}

// htmlTagRE strips HTML tags from message previews so desktop notifications
// show plain text rather than markup.
var htmlTagRE = regexp.MustCompile(`<[^>]*>`)

// SetWindowFocused is called by the frontend on window focus/blur so the
// backend only raises notifications while the window is in the background.
func (a *Api) SetWindowFocused(focused bool) {
	a.windowFocused.Store(focused)
}

// notifyIncoming raises a desktop notification for an incoming message when the
// window isn't focused.
func (a *Api) notifyIncoming(v *events.Message, parsedHTML string) {
	title := v.Info.PushName
	if title == "" {
		title = "New message"
	}
	body := strings.TrimSpace(htmlTagRE.ReplaceAllString(parsedHTML, ""))
	if body == "" {
		body = "Sent you a message"
	}
	if err := beeep.Notify(title, body, ""); err != nil {
		log.Println("notify failed:", err)
	}
}

// NewApi creates a new Api application struct
func New() *Api {
	a := &Api{}
	a.startWorkerPool()
	return a
}

const workerPoolSize = 8
const workerQueueSize = 256

func (a *Api) startWorkerPool() {
	a.taskCh = make(chan func(), workerQueueSize)
	for i := 0; i < workerPoolSize; i++ {
		a.workerWg.Add(1)
		go func() {
			defer a.workerWg.Done()
			for task := range a.taskCh {
				if task == nil {
					return
				}
				task()
			}
		}()
	}
}

func (a *Api) startBackground(task func()) bool {
	if task == nil {
		return false
	}
	a.taskMu.Lock()
	shuttingDown := a.shuttingDown
	a.taskMu.Unlock()
	if shuttingDown {
		return false
	}
	select {
	case a.taskCh <- task:
		return true
	default:
		// Queue full — drop the task to avoid blocking the event loop.
		log.Println("[bg] worker queue full, dropping task")
		return false
	}
}

func (a *Api) isShuttingDown() bool {
	a.taskMu.Lock()
	defer a.taskMu.Unlock()
	return a.shuttingDown
}

func (a *Api) OnSecondInstanceLaunch(secondInstanceData options.SecondInstanceData) {
	runtime.WindowUnminimise(a.ctx)
	runtime.Show(a.ctx)
}

func (a *Api) Shutdown(ctx context.Context) {
	a.taskMu.Lock()
	a.shuttingDown = true
	a.taskMu.Unlock()

	a.lifecycleMu.Lock()
	client := a.waClient
	loginCancel := a.loginCancel
	if client != nil && a.eventHandlerSet {
		client.RemoveEventHandler(a.eventHandlerID)
		a.eventHandlerSet = false
	}
	a.lifecycleMu.Unlock()

	if loginCancel != nil {
		loginCancel()
	}
	if client != nil {
		client.Disconnect()
	}
	// Login may be waiting on the QR channel or finishing Connect. Cancellation
	// releases the QR wait; the second disconnect catches a Connect that raced
	// with shutdown after the first disconnect.
	a.loginMu.Lock()
	a.loginMu.Unlock()
	if client != nil {
		client.Disconnect()
	}
	// Wait for an event that entered before RemoveEventHandler and every
	// background task it launched before closing their stores.
	a.eventMu.Lock()
	a.eventMu.Unlock()
	close(a.taskCh)
	a.workerWg.Wait()

	if err := a.closeResources(); err != nil {
		log.Println("shutdown cleanup failed:", err)
	}
}

func (a *Api) closeResources() error {
	var closeErr error
	if a.us != nil {
		_ = a.us.SendCommand("shutdown")
		closeErr = errors.Join(closeErr, a.us.Close())
		a.us = nil
	}
	if a.messageStore != nil {
		closeErr = errors.Join(closeErr, a.messageStore.Close())
		a.messageStore = nil
	}
	if a.imageCache != nil {
		closeErr = errors.Join(closeErr, a.imageCache.Close())
		a.imageCache = nil
	}
	if a.cw != nil {
		closeErr = errors.Join(closeErr, a.cw.Close())
		a.cw = nil
	}
	if a.waContainer != nil {
		closeErr = errors.Join(closeErr, a.waContainer.Close())
		a.waContainer = nil
	}
	if a.sessionDB != nil {
		closeErr = errors.Join(closeErr, a.sessionDB.Close())
		a.sessionDB = nil
	}
	return closeErr
}

func (a *Api) failStartup(err error) {
	a.lifecycleMu.Lock()
	a.startupErr = err
	a.lifecycleMu.Unlock()
	log.Println("startup failed:", err)
	if closeErr := a.closeResources(); closeErr != nil {
		log.Println("startup cleanup failed:", closeErr)
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *Api) Startup(ctx context.Context) {
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stderr, nil)))

	// The window is focused when the app launches; the frontend keeps this in
	// sync via SetWindowFocused so we don't notify while the user is looking.
	a.windowFocused.Store(true)
	// Set the context before anything that may call back into the Api (the
	// systray command handler needs it for EventsEmit).
	a.ctx = ctx
	var err error
	a.us, err = socket.NewUnixSocket(ctx)
	if err != nil {
		a.failStartup(fmt.Errorf("create tray socket: %w", err))
		return
	}
	a.us.SetCommandHandler(a.trayCommandHandler)
	socketServer := a.us
	go func() {
		err := socketServer.ListenAndServe()
		if err != nil {
			log.Println("Unix socket server error:", err)
		}
	}()

	err = misc.StartSystray()
	if err != nil {
		log.Printf("failed to start systray: %v", err)
	}

	dbLog := waLog.Stdout("Database", settings.GetLogLevel(), true)
	a.cw, err = wa.NewAppDatabase(ctx)
	if err != nil {
		a.failStartup(fmt.Errorf("open application database: %w", err))
		return
	}
	db, err := sql.Open("sqlite", misc.GetSQLiteAddress("session.wa"))
	if err != nil {
		a.failStartup(fmt.Errorf("open WhatsApp session database: %w", err))
		return
	}
	a.sessionDB = db
	container := sqlstore.NewWithDB(db, "sqlite", dbLog)
	a.waContainer = container
	err = container.Upgrade(ctx)
	if err != nil {
		a.failStartup(fmt.Errorf("upgrade WhatsApp session database: %w", err))
		return
	}
	a.waClient = wa.NewClient(ctx, container)
	a.messageStore, err = store.NewMessageStore()
	if err != nil {
		a.failStartup(fmt.Errorf("open message store: %w", err))
		return
	}
	a.imageCache, err = cache.NewImageCache()
	if err != nil {
		a.failStartup(fmt.Errorf("open image cache: %w", err))
		return
	}
	
	// Initialize VoIP extension
	a.initMeowcaller()
}

func (a *Api) Login() error {
	a.loginMu.Lock()
	defer a.loginMu.Unlock()

	if a.isShuttingDown() {
		return context.Canceled
	}
	a.lifecycleMu.Lock()
	if a.startupErr != nil {
		err := a.startupErr
		a.lifecycleMu.Unlock()
		return err
	}
	if a.waClient == nil {
		a.lifecycleMu.Unlock()
		return errors.New("WhatsApp client is not ready")
	}
	if !a.eventHandlerSet {
		a.eventHandlerID = a.waClient.AddEventHandler(a.mainEventHandler)
		a.eventHandlerSet = true
	}
	client := a.waClient
	a.lifecycleMu.Unlock()

	if client.Store.ID == nil {
		loginCtx, cancel := context.WithCancel(a.ctx)
		a.lifecycleMu.Lock()
		a.loginCancel = cancel
		a.lifecycleMu.Unlock()
		defer func() {
			cancel()
			a.lifecycleMu.Lock()
			a.loginCancel = nil
			a.lifecycleMu.Unlock()
		}()

		qrChan, err := client.GetQRChannel(loginCtx)
		if err != nil {
			return fmt.Errorf("create QR login channel: %w", err)
		}
		if a.isShuttingDown() {
			return context.Canceled
		}
		err = client.Connect()
		if err != nil {
			return err
		}
		for {
			select {
			case <-loginCtx.Done():
				return loginCtx.Err()
			case evt, ok := <-qrChan:
				if !ok {
					return nil
				}
				if evt.Event == "code" {
					runtime.EventsEmit(a.ctx, "wa:qr", evt.Code)
				} else {
					runtime.EventsEmit(a.ctx, "wa:status", evt.Event)
				}
			}
		}
	} else {
		// Already logged in, connect before announcing readiness.
		err := client.Connect()
		if err != nil {
			return err
		}
		if a.isShuttingDown() {
			return context.Canceled
		}
		runtime.EventsEmit(a.ctx, "wa:status", "logged_in")
	}
	return nil
}

func (a *Api) mainEventHandler(evt any) {
	a.eventMu.RLock()
	defer a.eventMu.RUnlock()
	if a.isShuttingDown() {
		return
	}
	switch v := evt.(type) {
	case *events.Message:
		// Poll vote messages: insert a system message and skip normal processing
		if v.Message.GetPollUpdateMessage() != nil {
			a.startBackground(func() { a.handlePollVoteEvent(v) })
			return
		}

		parsedHTML := a.processMessageText(v.Message)

		// Handle message edits: re-parse the edited content
		if protoMsg := v.Message.GetProtocolMessage(); protoMsg != nil && protoMsg.GetType() == waE2E.ProtocolMessage_MESSAGE_EDIT {
			newContent := protoMsg.GetEditedMessage()
			if newContent != nil {
				parsedHTML = a.processMessageText(newContent)
			}
		}

		messageID := a.messageStore.ProcessMessageEvent(a.ctx, a.waClient.Store.LIDs, v, parsedHTML)

		// If a message was processed (inserted or updated), emit the decoded message from DB
		if messageID != "" {
			updatedMsg, err := a.messageStore.GetDecodedMessage(v.Info.Chat.String(), messageID)
			if err == nil {
				runtime.EventsEmit(a.ctx, "wa:new_message", map[string]any{
					"chatId":      v.Info.Chat.String(),
					"message":     updatedMsg,
					"messageText": parsedHTML, // Text field contains HTML now, but better than nothing or we can use updatedMsg.Text
					"timestamp":   v.Info.Timestamp.Unix(),
					"sender":      v.Info.PushName,
					"isFromMe":    v.Info.IsFromMe,
				})
			} else if !errors.Is(err, sql.ErrNoRows) {
				log.Println("Failed to get decoded message after processing:", err)
			}
		}

		// Raise a desktop notification for genuine incoming messages (not our
		// own, not reactions, not channel/broadcast posts) while backgrounded.
		// Respects the global notification switch and per-chat mutes
		// (including mutes synced from the phone).
		isFeed := v.Info.Chat.Server == types.NewsletterServer || v.Info.Chat.Server == types.BroadcastServer
		if messageID != "" && !v.Info.IsFromMe && !isFeed && v.Message.GetReactionMessage() == nil && !a.windowFocused.Load() &&
			store.GetNotificationsEnabled() && !a.messageStore.IsChatMuted(v.Info.Chat.String()) {
			a.startBackground(func() { a.notifyIncoming(v, parsedHTML) })
		}

		if reaction := v.Message.GetReactionMessage(); reaction != nil {
			a.startBackground(func() {
				targetID := reaction.GetKey().GetID()
				targetMsg, err := a.messageStore.GetMessageWithMedia(v.Info.Chat.String(), targetID)
				if err != nil {
					log.Println("Failed", err)
					return
				}

				targetText := targetMsg.Text
				senderName := v.Info.PushName
				if senderName == "" && v.Info.Sender.User != "" {
					senderName = v.Info.Sender.User
				}
				if v.Info.IsFromMe {
					senderName = "You"
				}

				runtime.EventsEmit(a.ctx, "wa:new_message", map[string]any{
					"chatId":      v.Info.Chat.String(),
					"message":     nil,
					"messageText": targetText,
					"reaction":    reaction.GetText(),
					"timestamp":   v.Info.Timestamp.Unix(),
					"sender":      senderName,
				})
			})
		}

	case *events.Picture:
		a.startBackground(func() { _, _ = a.GetCachedAvatar(v.JID.String(), true) })

		runtime.EventsEmit(a.ctx, "wa:picture_update", v.JID.String())

	case *events.Mute:
		// Emitted for mutes set on other devices (e.g. the phone), including
		// during app-state full sync. Persist so notifications stay quiet.
		muted := v.Action.GetMuted()
		a.handleMuteEvent(v.JID, muted, v.Action.GetMuteEndTimestamp())

	case *events.Connected:
		// For new logins, there might be a problem where the whatsmeow client
		// gets a 515 code which gets resolved internally by auto-reconnecting
		// in a separate goroutine. In that case, the Initialise call below for
		// the AppDatabase will be executed first without the client even logging
		// in (which is the reason why the groups fetch fails and there are no
		// groups in the app until a manual reinitialize is done). To avoid that,
		// wait here until logged in.
		if err := a.cw.Initialise(a.waClient); err != nil {
			slog.Error(fmt.Sprintf("Database init failed: %v", err), "source", "groups")
			a.emitError(fmt.Sprintf("Group init failed: %v", err))
		}
		// Heal group rows with missing/empty names in the background now
		// that the client can reach the server.
		a.startBackground(a.repairGroupNames)
		// Recover archive/pin/mute sync if the local app state is corrupted.
		a.startBackground(a.resyncAppState)
		if err := a.waClient.SendPresence(a.ctx, types.PresenceAvailable); err != nil {
			slog.Warn(fmt.Sprintf("Failed to send available: %v", err), "source", "presence")
		}
		// Run migration for messages.db
		err := a.messageStore.MigrateLIDToPN(a.ctx, a.waClient.Store.LIDs)
		if err != nil {
			slog.Error(fmt.Sprintf("LID migration failed: %v", err), "source", "migration")
			a.emitError(fmt.Sprintf("LID migration failed: %v", err))
		} else {
			slog.Info("LID migration completed", "source", "migration")
			runtime.EventsEmit(a.ctx, "wa:chat_list_refresh")
		}
	case *events.HistorySync:
		// whatsmeow delivers past conversations here after linking. Process
		// in a background goroutine so thousands of messages don't block the
		// event loop (which would delay live messages, QR rendering, etc.).
		a.startBackground(func() { a.processHistorySync(v) })
	case *events.Archive:
		// Chat archived/unarchived from another device (or app state sync).
		if err := a.messageStore.SetChatArchived(v.JID.String(), v.Action.GetArchived(), v.Timestamp.Unix()); err != nil {
			log.Println("Failed to store chat archive state:", err)
		}
		runtime.EventsEmit(a.ctx, "wa:chat_list_refresh")
	case *events.Pin:
		// Chat pinned/unpinned from another device (or during app state sync).
		if err := a.messageStore.SetChatPinned(v.JID.String(), v.Action.GetPinned(), v.Timestamp.Unix()); err != nil {
			log.Println("Failed to store chat pin:", err)
		}
		runtime.EventsEmit(a.ctx, "wa:chat_list_refresh")
	case *events.Disconnected:
		a.waClient.SendPresence(a.ctx, types.PresenceUnavailable)
		if !a.isShuttingDown() {
			a.emitError("Disconnected from WhatsApp — reconnecting...")
			a.startBackground(a.reconnectLoop)
		}
	case *events.Receipt:
		runtime.EventsEmit(a.ctx, "wa:message_receipt", map[string]any{
			"chatId": v.Chat.String(),
			"status": v.Type.GoString(),
		})
	case *events.Contact:
		action := v.Action
		fullName := ""
		if action != nil {
			fullName = action.GetFullName()
		}
		slog.Info(fmt.Sprintf("Contact event for %s: fullName=%q", v.JID, fullName), "source", "contacts")
		runtime.EventsEmit(a.ctx, "wa:chat_list_refresh")
	case *events.PushName, *events.BusinessName:
		runtime.EventsEmit(a.ctx, "wa:chat_list_refresh")
	case *events.ChatPresence:
		runtime.EventsEmit(a.ctx, "wa:chat_presence", map[string]any{
			"chatId": v.Chat.String(),
			"state":  string(v.State),
			"media":  string(v.Media),
		})
	case *events.IdentityChange:
		slog.Info(fmt.Sprintf("Identity change for %s", v.JID), "source", "security")
	case *events.Presence:
		runtime.EventsEmit(a.ctx, "wa:presence", map[string]any{
			"jid":         v.From.String(),
			"unavailable": v.Unavailable,
			"lastSeen":    v.LastSeen.UnixMilli(),
		})

	case *events.GroupInfo:
		a.startBackground(func() { a.handleGroupInfoEvent(v) })

	default:
		// Ignore other events for now
	}

}

// contactNameForJID looks up a human-readable display name for a JID from the
// contact store, falling back to the JID user portion.
func (a *Api) contactNameForJID(jid types.JID) string {
	myJID := a.waClient.Store.ID
	if myJID != nil {
		if jid.ToNonAD() == myJID.ToNonAD() {
			return "You"
		}
	}
	contact, err := a.waClient.Store.Contacts.GetContact(a.ctx, jid.ToNonAD())
	if err == nil {
		if contact.FullName != "" {
			return contact.FullName
		}
		if contact.PushName != "" {
			return contact.PushName
		}
	}
	return jid.User
}

// formatEphemeralTimer converts a disappearing-timer value in seconds to a
// short human-readable string (e.g. "24h", "7d", "90d").
func formatEphemeralTimer(secs uint32) string {
	switch {
	case secs <= 0:
		return "off"
	case secs < 60:
		return fmt.Sprintf("%ds", secs)
	case secs < 3600:
		return fmt.Sprintf("%dm", secs/60)
	case secs < 86400:
		return fmt.Sprintf("%dh", secs/3600)
	default:
		return fmt.Sprintf("%dd", secs/86400)
	}
}

// handleGroupInfoEvent stores system messages for all group configuration
// changes (name, topic, locked, announce, disappearing timer, membership
// approval, delete, community links, invite link, suspend, and participant
// changes) so the UI can display descriptive event cards.
func (a *Api) handleGroupInfoEvent(v *events.GroupInfo) {
	groupJID := v.JID.String()
	ts := v.Timestamp.Unix()
	now := time.Now().UnixMilli()
	seq := int64(0)
	changed := false

	ins := func(text string) {
		msgID := fmt.Sprintf("system_%s_%d", groupJID, now+seq)
		seq++
		if err := a.messageStore.InsertSystemMessage(groupJID, msgID, text, ts); err != nil {
			slog.Warn(fmt.Sprintf("Failed to store system message: %v", err), "source", "groups")
		}
		changed = true
	}

	// Resolve who triggered the change (if available)
	senderName := ""
	if v.Sender != nil {
		senderName = a.contactNameForJID(*v.Sender)
	}
	senderPrefix := ""
	if senderName != "" {
		senderPrefix = senderName + " "
	}

	if v.Name != nil && v.Name.Name != "" {
		ins("[system]✏️ " + senderPrefix + "changed the group name to \"" + v.Name.Name + "\"")
	}
	if v.Topic != nil {
		if v.Topic.TopicDeleted {
			ins("[system]✏️ " + senderPrefix + "removed the group description")
		} else if v.Topic.Topic != "" {
			ins("[system]✏️ " + senderPrefix + "changed the group description")
		}
	}
	if v.Locked != nil {
		if v.Locked.IsLocked {
			ins("[system]🔒 " + senderPrefix + "restricted group info editing to admins")
		} else {
			ins("[system]🔓 " + senderPrefix + "opened group info editing to all members")
		}
	}
	if v.Announce != nil {
		if v.Announce.IsAnnounce {
			ins("[system]🔇 " + senderPrefix + "set the group to announcement mode — only admins can send messages")
		} else {
			ins("[system]🔊 " + senderPrefix + "opened the group — all members can send messages")
		}
	}
	if v.Ephemeral != nil {
		if v.Ephemeral.IsEphemeral {
			ins("[system]⏳ " + senderPrefix + "set disappearing messages to " + formatEphemeralTimer(v.Ephemeral.DisappearingTimer))
		} else {
			ins("[system]⏳ " + senderPrefix + "turned off disappearing messages")
		}
	}
	if v.MembershipApprovalMode != nil {
		if v.MembershipApprovalMode.IsJoinApprovalRequired {
			ins("[system]🔐 " + senderPrefix + "enabled membership approval — new join requests require admin approval")
		} else {
			ins("[system]🔓 " + senderPrefix + "disabled membership approval — anyone can join freely")
		}
	}
	if v.Delete != nil && v.Delete.Deleted {
		ins("[system]🗑️ " + senderPrefix + "deleted the group")
	}
	if v.Link != nil {
		groupName := v.Link.Group.Name
		if groupName == "" {
			ins("[system]🔗 " + senderPrefix + "linked this group to a community")
		} else {
			ins("[system]🔗 " + senderPrefix + "linked this group to the community \"" + groupName + "\"")
		}
	}
	if v.Unlink != nil {
		ins("[system]🔗 " + senderPrefix + "unlinked this group from its community")
	}
	if v.NewInviteLink != nil && *v.NewInviteLink != "" {
		ins("[system]🔗 " + senderPrefix + "reset the group invite link")
	}
	if v.Suspended {
		ins("[system]🚫 Group has been suspended")
	}
	if v.Unsuspended {
		ins("[system]✅ Group has been unsuspended")
	}

	// Participant changes
	for _, jid := range v.Join {
		ins("[system]👋 " + a.contactNameForJID(jid) + " joined the group")
	}
	for _, jid := range v.Leave {
		ins("[system]👋 " + a.contactNameForJID(jid) + " left the group")
	}
	for _, jid := range v.Promote {
		ins("[system]⭐ " + a.contactNameForJID(jid) + " was promoted to admin")
	}
	for _, jid := range v.Demote {
		ins("[system]⭐ " + a.contactNameForJID(jid) + " was demoted")
	}

	if changed {
		runtime.EventsEmit(a.ctx, "wa:chat_list_refresh")
	}
}

// handlePollVoteEvent creates a system message when someone votes in a poll.
func (a *Api) handlePollVoteEvent(v *events.Message) {
	chat := v.Info.Chat.String()
	senderName := a.contactNameForJID(v.Info.Sender)
	text := "[system]🗳️ " + senderName + " voted"
	msgID := fmt.Sprintf("pollvote_%s_%s", chat, v.Info.ID)
	if err := a.messageStore.InsertSystemMessage(chat, msgID, text, v.Info.Timestamp.Unix()); err != nil {
		slog.Warn(fmt.Sprintf("Failed to store poll vote system message: %v", err), "source", "polls")
	}
	runtime.EventsEmit(a.ctx, "wa:chat_list_refresh")
}

// processHistorySync stores the messages contained in a whatsmeow HistorySync
// event. WhatsApp sends these in several batches after a device is linked
// (bootstrap, recent, full). Each conversation's WebMessageInfo entries are
// converted into the same *events.Message shape that live messages use, then
// persisted through the existing MessageStore so the chat list and history
// render exactly like incoming messages do.
func (a *Api) processHistorySync(v *events.HistorySync) {
	conversations := v.Data.GetConversations()
	if len(conversations) == 0 {
		return
	}
	stored := 0
	totalConvs := len(conversations)
	runtime.EventsEmit(a.ctx, "wa:history_progress", map[string]any{
		"type":                  v.Data.GetSyncType().String(),
		"totalConversations":    totalConvs,
		"processedConversations": 0,
		"totalMessages":         0,
		"processedMessages":     0,
	})
	for _, conv := range conversations {
		chatJID, err := types.ParseJID(conv.GetID())
		if err != nil {
			continue
		}
		for _, histMsg := range conv.GetMessages() {
			webMsg := histMsg.GetMessage()
			if webMsg == nil {
				continue
			}
			parsedMsg, err := a.waClient.ParseWebMessage(chatJID, webMsg)
			if err != nil || parsedMsg.Message == nil {
				continue
			}
			// ParseWebMessage doesn't unwrap containers (ephemeral/view-once)
			// like the live path does, so do it here or the content is lost.
			parsedMsg.Message = store.UnwrapMessage(parsedMsg.Message)
			if parsedMsg.Message == nil {
				continue
			}
			parsedHTML := a.processMessageText(parsedMsg.Message)
			if a.messageStore.ProcessMessageEvent(a.ctx, a.waClient.Store.LIDs, parsedMsg, parsedHTML) != "" {
				stored++
			}
		}
	}
	runtime.EventsEmit(a.ctx, "wa:history_progress", map[string]any{
		"type":                  v.Data.GetSyncType().String(),
		"totalConversations":    totalConvs,
		"processedConversations": totalConvs,
		"totalMessages":         0,
		"processedMessages":     stored,
		"done":                  true,
	})
	slog.Info(fmt.Sprintf("Stored %d messages from %d conversations", stored, len(conversations)), "source", "history")
	runtime.EventsEmit(a.ctx, "wa:chat_list_refresh")
}
