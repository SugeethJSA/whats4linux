package api

import (
	"fmt"
	"log"
	"log/slog"
	"time"

	"github.com/lugvitc/whats4linux/internal/store"
	"github.com/nyaruka/phonenumbers"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	"go.mau.fi/whatsmeow/appstate"
	"go.mau.fi/whatsmeow/types"
)

// formatPhone formats a JID user component as an international phone number.
// Returns empty string if the JID isn't a phone number (e.g. LID, group, etc.)
func formatPhone(user string) string {
	if user == "" {
		return ""
	}
	num, err := phonenumbers.Parse("+"+user, "")
	if err != nil || !phonenumbers.IsValidNumber(num) {
		return ""
	}
	return phonenumbers.Format(num, phonenumbers.INTERNATIONAL)
}

type ChatElement struct {
	LatestMessage string `json:"latest_message"`
	LatestTS      int64
	Sender        string `json:"sender"`
	IsFromMe      bool   `json:"is_from_me"`
	Pinned        bool   `json:"pinned"`
	PinnedAt      int64  `json:"pinned_at"`
	Archived      bool   `json:"archived"`
	Contact

	// Community linkage (populated for groups that belong to a community).
	ParentJID         string `json:"parent_jid,omitempty"`
	ParentName        string `json:"parent_name,omitempty"`
	IsCommunityGroup  bool   `json:"is_community_group"`
	IsCommunityParent bool   `json:"is_community_parent"`
	IsDefaultSubGroup bool   `json:"is_default_sub_group"`
}

// ToggleChatPin pins/unpins a chat: syncs the change to other devices via
// app state and records it locally for the chat list.
func (a *Api) ToggleChatPin(jidStr string, pinned bool) error {
	jid, err := types.ParseJID(jidStr)
	if err != nil {
		return err
	}
	// Local-first: the app's own state must not depend on app-state sync
	// health. Sync to other devices is best-effort (self-heals via
	// resyncAppState on the next connect if the hash chain is broken).
	if err := a.messageStore.SetChatPinned(jidStr, pinned, time.Now().Unix()); err != nil {
		return err
	}
	runtime.EventsEmit(a.ctx, "wa:chat_list_refresh")
	if err := a.waClient.SendAppState(a.ctx, appstate.BuildPin(jid, pinned)); err != nil {
		log.Println("ToggleChatPin: app state sync failed (kept local):", err)
		a.startBackground(a.resyncAppState)
	}
	return nil
}

// ToggleChatArchive archives/unarchives a chat: syncs to other devices via
// app state and records it locally for the chat list.
func (a *Api) ToggleChatArchive(jidStr string, archived bool) error {
	jid, err := types.ParseJID(jidStr)
	if err != nil {
		return err
	}
	// Local-first, same reasoning as ToggleChatPin.
	if err := a.messageStore.SetChatArchived(jidStr, archived, time.Now().Unix()); err != nil {
		return err
	}
	runtime.EventsEmit(a.ctx, "wa:chat_list_refresh")
	if err := a.waClient.SendAppState(a.ctx, appstate.BuildArchive(jid, archived, time.Time{}, nil)); err != nil {
		log.Println("ToggleChatArchive: app state sync failed (kept local):", err)
		a.startBackground(a.resyncAppState)
	}
	return nil
}

func (a *Api) GetChatList() ([]ChatElement, error) {
	cmList := a.messageStore.GetChatList()
	pinnedChats := a.messageStore.GetPinnedChats()
	archivedChats := a.messageStore.GetArchivedChats()
	ce := make([]ChatElement, len(cmList))
	for i, cm := range cmList {
		var fc Contact
		var parentJID, parentName string
		var isCommunityGroup, isCommunityParent, isDefaultSub bool

		if cm.JID.Server == types.GroupServer {
			// Local-only on purpose: this runs at startup before the client
			// has connected, so it must never touch the network. Empty names
			// are healed asynchronously by repairGroupNames after Connected.
			name := ""
			if groupInfo, err := a.cw.FetchGroup(cm.JID.String()); err == nil {
				name = groupInfo.Name
				parentJID = groupInfo.ParentJID
				parentName = groupInfo.ParentName
				if parentName == "" && parentJID != "" {
					parentName = a.cw.ParentCommunityName(parentJID)
				}
				isCommunityGroup = parentJID != ""
				isCommunityParent = groupInfo.IsParent
				isDefaultSub = groupInfo.IsDefaultSub
			} else {
				log.Println("GetChatList: group lookup failed, using fallback:", cm.JID.String(), err)
			}
			if name == "" {
				// A single unknown/left group must not blank the whole chat
				// list. Fall back to the JID so the chat still renders.
				name = cm.JID.User
			}
			fc = Contact{
				JID:      cm.JID.String(),
				FullName: name,
			}
		} else {
			contact, err := a.waClient.Store.Contacts.GetContact(a.ctx, cm.JID.ToNonAD())
			phone := formatPhone(cm.JID.User)
			if err != nil {
				// Same here: degrade to the JID rather than failing everything.
				log.Println("GetChatList: contact lookup failed, using fallback:", cm.JID.String(), err)
				fc = Contact{
					JID:      cm.JID.String(),
					PushName: cm.JID.User,
					Phno:     phone,
				}
			} else {
				fc = Contact{
					JID:        cm.JID.String(),
					Short:      contact.FirstName,
					FullName:   contact.FullName,
					PushName:   contact.PushName,
					Phno:       phone,
					IsBusiness: contact.BusinessName != "",
				}
			}
		}
		pinnedAt, pinned := pinnedChats[cm.JID.String()]
		_, archived := archivedChats[cm.JID.String()]
		ce[i] = ChatElement{
			LatestMessage:     cm.MessageText,
			LatestTS:          cm.MessageTime,
			Sender:            a.chatListSenderName(cm),
			IsFromMe:          cm.IsFromMe,
			Pinned:            pinned,
			PinnedAt:          pinnedAt,
			Archived:          archived,
			Contact:           fc,
			ParentJID:         parentJID,
			ParentName:        parentName,
			IsCommunityGroup:  isCommunityGroup,
			IsCommunityParent: isCommunityParent,
			IsDefaultSubGroup: isDefaultSub,
		}
	}
	return ce, nil
}

// chatListSenderName resolves the display name for a chat list row: "You" for
// own messages, otherwise the sender's contact name (FullName > PushName >
// phone number) for the stored sender JID.
func (a *Api) chatListSenderName(cm store.ChatMessage) string {
	if cm.IsFromMe {
		return "You"
	}
	jid, err := types.ParseJID(cm.Sender)
	if err != nil {
		return cm.Sender
	}
	contact, err := a.waClient.Store.Contacts.GetContact(a.ctx, jid.ToNonAD())
	if err != nil {
		return jid.User
	}
	if contact.FullName != "" {
		return contact.FullName
	}
	if contact.PushName != "" {
		return contact.PushName
	}
	if num, perr := phonenumbers.Parse("+"+jid.User, ""); perr == nil {
		return phonenumbers.Format(num, phonenumbers.INTERNATIONAL)
	}
	return jid.User
}

// GetChannelList returns the followed Channels (newsletter feeds), named via
// their newsletter metadata.
func (a *Api) GetChannelList() ([]ChatElement, error) {
	cmList := a.messageStore.GetChannelList()
	ce := make([]ChatElement, len(cmList))
	for i, cm := range cmList {
		name := cm.JID.User
		if info, err := a.waClient.GetNewsletterInfo(a.ctx, cm.JID); err == nil && info != nil && info.ThreadMeta.Name.Text != "" {
			name = info.ThreadMeta.Name.Text
		}
		ce[i] = ChatElement{
			LatestMessage: cm.MessageText,
			LatestTS:      cm.MessageTime,
			Sender:        cm.Sender,
			Contact:       Contact{JID: cm.JID.String(), FullName: name},
		}
	}
	return ce, nil
}

func (a *Api) SendChatPresence(jid string, cp types.ChatPresence, cpm types.ChatPresenceMedia) error {
	parsedJid, err := types.ParseJID(jid)
	if err != nil {
		return err
	}
	return a.waClient.SendChatPresence(a.ctx, parsedJid, cp, cpm)
}

// SubscribeContactPresence subscribes to presence updates for a specific user.
// After subscribing, the app will receive wa:presence and wa:chat_presence
// events for that user.
func (a *Api) SubscribeContactPresence(jidStr string) error {
	jid, err := types.ParseJID(jidStr)
	if err != nil {
		return err
	}
	return a.waClient.SubscribePresence(a.ctx, jid.ToNonAD())
}

// ClearChat deletes all messages for a given chat and refreshes the UI.
func (a *Api) ClearChat(jidStr string) error {
	if err := a.messageStore.DeleteChatMessages(jidStr); err != nil {
		return err
	}
	runtime.EventsEmit(a.ctx, "wa:chat_list_refresh")
	return nil
}

func (a *Api) SubscribeNewsletter(newsletterJID string) error {
	if a.waClient.Store.ID == nil {
		return fmt.Errorf("not logged in")
	}
	jid, err := types.ParseJID(newsletterJID)
	if err != nil {
		return fmt.Errorf("invalid newsletter JID: %w", err)
	}
	err = a.waClient.FollowNewsletter(a.ctx, jid)
	if err != nil {
		return err
	}
	slog.Info(fmt.Sprintf("Subscribed to newsletter %s", newsletterJID), "source", "channels")
	return nil
}

func (a *Api) UnsubscribeNewsletter(newsletterJID string) error {
	if a.waClient.Store.ID == nil {
		return fmt.Errorf("not logged in")
	}
	jid, err := types.ParseJID(newsletterJID)
	if err != nil {
		return fmt.Errorf("invalid newsletter JID: %w", err)
	}
	err = a.waClient.UnfollowNewsletter(a.ctx, jid)
	if err != nil {
		return err
	}
	slog.Info(fmt.Sprintf("Unsubscribed from newsletter %s", newsletterJID), "source", "channels")
	return nil
}

func (a *Api) SearchNewsletters(query string) ([]ChatElement, error) {
	if a.waClient.Store.ID == nil {
		return nil, fmt.Errorf("not logged in")
	}
	var out []ChatElement
	info, err := a.waClient.GetNewsletterInfoWithInvite(a.ctx, query)
	if err == nil {
		out = append(out, ChatElement{
			Contact: Contact{JID: info.ID.String(), FullName: info.ThreadMeta.Name.Text},
		})
		return out, nil
	}
	if jid, parseErr := types.ParseJID(query); parseErr == nil {
		info, err = a.waClient.GetNewsletterInfo(a.ctx, jid)
		if err == nil {
			out = append(out, ChatElement{
				Contact: Contact{JID: info.ID.String(), FullName: info.ThreadMeta.Name.Text},
			})
		}
	}
	return out, nil
}

// StarMessage stars or unstars a message for the current user.
// The change is synced to other devices via app state.
func (a *Api) StarMessage(chatJID, messageID string, starred bool) error {
	if a.waClient.Store.ID == nil {
		return fmt.Errorf("not logged in")
	}
	chat, err := types.ParseJID(chatJID)
	if err != nil {
		return err
	}
	msg, err := a.messageStore.GetMessageWithMediaByID(messageID)
	if err != nil {
		return err
	}
	senderJID := msg.Info.Sender
	if err := a.waClient.SendAppState(a.ctx, appstate.BuildStar(chat, senderJID, messageID, msg.Info.IsFromMe, starred)); err != nil {
		log.Println("StarMessage: app state sync failed:", err)
		return err
	}
	slog.Info(fmt.Sprintf("Starred %t for %s", starred, chatJID), "source", "chats")
	return nil
}

// DeleteChat deletes a chat and its messages from the device.
func (a *Api) DeleteChat(chatJID string) error {
	if a.waClient.Store.ID == nil {
		return fmt.Errorf("not logged in")
	}
	chat, err := types.ParseJID(chatJID)
	if err != nil {
		return err
	}
	if err := a.waClient.SendAppState(a.ctx, appstate.BuildDeleteChat(chat, time.Now(), nil, true)); err != nil {
		log.Println("DeleteChat: app state sync failed:", err)
		return err
	}
	slog.Info(fmt.Sprintf("Deleted chat %s", chatJID), "source", "chats")
	return nil
}

// MarkChatAsRead marks a chat as read or unread.
func (a *Api) MarkChatAsRead(chatJID string, read bool) error {
	if a.waClient.Store.ID == nil {
		return fmt.Errorf("not logged in")
	}
	chat, err := types.ParseJID(chatJID)
	if err != nil {
		return err
	}
	if err := a.waClient.SendAppState(a.ctx, appstate.BuildMarkChatAsRead(chat, read, time.Now(), nil)); err != nil {
		log.Println("MarkChatAsRead: app state sync failed:", err)
		return err
	}
	slog.Info(fmt.Sprintf("Marked chat %s as read=%t", chatJID, read), "source", "chats")
	return nil
}

// MarkNotDirty marks the app state as not dirty, forcing a resync of the
// specified clean type. This is useful after recovering from a broken
// hash chain or after a manual state change.
func (a *Api) MarkNotDirty(cleanType string) error {
	if a.waClient.Store.ID == nil {
		return fmt.Errorf("not logged in")
	}
	return a.waClient.MarkNotDirty(a.ctx, cleanType, time.Now())
}
