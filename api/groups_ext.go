package api

import (
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types"
)

type GroupJoinRequest struct {
	JID         string `json:"jid"`
	Requester   string `json:"requester"`
	RequestedAt int64  `json:"requested_at"`
}

func (a *Api) GetGroupJoinRequests(groupJID string) ([]GroupJoinRequest, error) {
	if a.waClient.Store.ID == nil {
		return nil, fmt.Errorf("not logged in")
	}
	jid, err := types.ParseJID(groupJID)
	if err != nil {
		return nil, err
	}
	reqs, err := a.waClient.GetGroupRequestParticipants(a.ctx, jid)
	if err != nil {
		return nil, err
	}
	out := make([]GroupJoinRequest, 0, len(reqs))
	for _, r := range reqs {
		out = append(out, GroupJoinRequest{
			JID:         r.JID.String(),
			Requester:   a.contactNameForJID(r.JID),
			RequestedAt: r.RequestedAt.Unix(),
		})
	}
	return out, nil
}

func (a *Api) ApproveGroupJoinRequest(groupJID string, requesterJIDs []string) error {
	return a.updateJoinRequests(groupJID, requesterJIDs, whatsmeow.ParticipantChangeApprove)
}

func (a *Api) RejectGroupJoinRequest(groupJID string, requesterJIDs []string) error {
	return a.updateJoinRequests(groupJID, requesterJIDs, whatsmeow.ParticipantChangeReject)
}

func (a *Api) updateJoinRequests(groupJID string, requesterJIDs []string, action whatsmeow.ParticipantRequestChange) error {
	if a.waClient.Store.ID == nil {
		return fmt.Errorf("not logged in")
	}
	jid, err := types.ParseJID(groupJID)
	if err != nil {
		return err
	}
	jids := make([]types.JID, len(requesterJIDs))
	for i, r := range requesterJIDs {
		jids[i], err = types.ParseJID(r)
		if err != nil {
			return fmt.Errorf("invalid JID %s: %w", r, err)
		}
	}
	_, err = a.waClient.UpdateGroupRequestParticipants(a.ctx, jid, jids, action)
	if err != nil {
		return err
	}
	slog.Info(fmt.Sprintf("%s %d join requests in %s", action, len(jids), groupJID), "source", "groups")
	runtime.EventsEmit(a.ctx, "wa:chat_list_refresh")
	return nil
}

func (a *Api) SetGroupMemberAddMode(groupJID string, mode string) error {
	if a.waClient.Store.ID == nil {
		return fmt.Errorf("not logged in")
	}
	jid, err := types.ParseJID(groupJID)
	if err != nil {
		return err
	}
	var m types.GroupMemberAddMode
	switch strings.ToLower(mode) {
	case "admin_add":
		m = types.GroupMemberAddModeAdmin
	case "all_member_add":
		m = "all_member_add"
	default:
		return fmt.Errorf("invalid member add mode: %s", mode)
	}
	err = a.waClient.SetGroupMemberAddMode(a.ctx, jid, m)
	if err != nil {
		return err
	}
	slog.Info(fmt.Sprintf("Set group %s member add mode to %s", groupJID, mode), "source", "groups")
	return nil
}

func (a *Api) SetGroupJoinApprovalMode(groupJID string, requireApproval bool) error {
	if a.waClient.Store.ID == nil {
		return fmt.Errorf("not logged in")
	}
	jid, err := types.ParseJID(groupJID)
	if err != nil {
		return err
	}
	err = a.waClient.SetGroupJoinApprovalMode(a.ctx, jid, requireApproval)
	if err != nil {
		return err
	}
	state := "on"
	if !requireApproval {
		state = "off"
	}
	slog.Info(fmt.Sprintf("Set group %s join approval to %s", groupJID, state), "source", "groups")
	return nil
}

func (a *Api) SetGroupDescription(groupJID, description string) error {
	if a.waClient.Store.ID == nil {
		return fmt.Errorf("not logged in")
	}
	jid, err := types.ParseJID(groupJID)
	if err != nil {
		return err
	}
	if strings.HasSuffix(groupJID, "@g.us") {
		info, err := a.waClient.GetGroupInfo(a.ctx, jid)
		if err == nil && info.IsParent {
			return a.waClient.SetGroupDescription(a.ctx, jid, description)
		}
	}
	return a.waClient.SetGroupTopic(a.ctx, jid, "", "", description)
}

func (a *Api) LinkGroupToCommunity(parentJID, childJID string) error {
	if a.waClient.Store.ID == nil {
		return fmt.Errorf("not logged in")
	}
	parent, err := types.ParseJID(parentJID)
	if err != nil {
		return err
	}
	child, err := types.ParseJID(childJID)
	if err != nil {
		return err
	}
	err = a.waClient.LinkGroup(a.ctx, parent, child)
	if err != nil {
		return err
	}
	slog.Info(fmt.Sprintf("Linked group %s to community %s", childJID, parentJID), "source", "communities")
	runtime.EventsEmit(a.ctx, "wa:chat_list_refresh")
	return nil
}

func (a *Api) UnlinkGroupFromCommunity(parentJID, childJID string) error {
	if a.waClient.Store.ID == nil {
		return fmt.Errorf("not logged in")
	}
	parent, err := types.ParseJID(parentJID)
	if err != nil {
		return err
	}
	child, err := types.ParseJID(childJID)
	if err != nil {
		return err
	}
	err = a.waClient.UnlinkGroup(a.ctx, parent, child)
	if err != nil {
		return err
	}
	slog.Info(fmt.Sprintf("Unlinked group %s from community %s", childJID, parentJID), "source", "communities")
	runtime.EventsEmit(a.ctx, "wa:chat_list_refresh")
	return nil
}

func (a *Api) SetDisappearingTimerDefault(timerSeconds int64) error {
	if a.waClient.Store.ID == nil {
		return fmt.Errorf("not logged in")
	}
	duration := time.Duration(timerSeconds) * time.Second
	err := a.waClient.SetDefaultDisappearingTimer(a.ctx, duration)
	if err != nil {
		return err
	}
	slog.Info(fmt.Sprintf("Set default disappearing timer to %ds", timerSeconds), "source", "privacy")
	return nil
}
