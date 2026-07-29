package api

import (
	"encoding/base64"
	"fmt"
	"log"
	"log/slog"
	"strings"

	"github.com/lugvitc/whats4linux/internal/wa"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types"
)

type Group struct {
	GroupName        string             `json:"group_name"`
	GroupTopic       string             `json:"group_topic,omitempty"`
	IsGroupLock      bool               `json:"is_group_lock"`
	IsGroupAnnounce  bool               `json:"is_group_announce"`
	MemberAddMode    string             `json:"member_add_mode"`
	JoinApproval     bool               `json:"join_approval"`
	ParentJID        string             `json:"parent_jid,omitempty"`
	GroupOwner       Contact            `json:"group_owner"`
	GroupCreatedAt   string             `json:"group_created_at"`
	ParticipantCount int                `json:"participant_count"`
	Participants     []GroupParticipant `json:"group_participants"`
}

type GroupParticipant struct {
	Contact Contact `json:"contact"`
	IsAdmin bool    `json:"is_admin"`
}

func (a *Api) FetchGroups() ([]wa.Group, error) {
	if a.cw != nil {
		if err := a.cw.FetchAndStoreGroups(a.waClient); err != nil {
			log.Println("FetchGroups: cache refresh failed:", err)
		}
	}

	groups, err := a.waClient.GetJoinedGroups(a.ctx)
	if err != nil {
		return nil, err
	}

	var result []wa.Group
	for _, g := range groups {
		parentJID := ""
		if !g.LinkedParentJID.IsEmpty() {
			parentJID = g.LinkedParentJID.String()
		}
		result = append(result, wa.Group{
			JID:              g.JID.String(),
			Name:             g.Name,
			Topic:            g.Topic,
			OwnerJID:         g.OwnerJID.String(),
			ParticipantCount: len(g.Participants),
			ParentJID:        parentJID,
			IsParent:         g.IsParent,
			IsDefaultSub:     g.IsDefaultSubGroup,
		})
	}
	return result, nil
}

func (a *Api) GetGroupInfo(jidStr string) (Group, error) {
	if !strings.HasSuffix(jidStr, "@g.us") {
		return Group{}, fmt.Errorf("JID is not a group JID")
	}
	jid, err := types.ParseJID(jidStr)
	if err != nil {
		return Group{}, fmt.Errorf("Invalid JID: %w", err)
	}

	GroupInfo, err := a.waClient.GetGroupInfo(a.ctx, jid)

	if err != nil {
		return Group{}, err
	}

	var participants []GroupParticipant
	for _, p := range GroupInfo.Participants {
		contact, err := a.GetContact(p.JID)
		if err != nil {
			return Group{}, fmt.Errorf("Error fetching participant: %w", err)
		}

		participants = append(participants, GroupParticipant{
			Contact: *contact,
			IsAdmin: p.IsAdmin,
		})
	}
	parentJID := ""
	if !GroupInfo.LinkedParentJID.IsEmpty() {
		parentJID = GroupInfo.LinkedParentJID.String()
	}
	owner, err := a.GetContact(GroupInfo.OwnerJID)
	if err != nil {
		return Group{}, fmt.Errorf("Error fetching owner: %w", err)
	}
	return Group{
		GroupName:        GroupInfo.GroupName.Name,
		GroupTopic:       GroupInfo.GroupTopic.Topic,
		IsGroupLock:      GroupInfo.GroupLocked.IsLocked,
		IsGroupAnnounce:  GroupInfo.GroupAnnounce.IsAnnounce,
		MemberAddMode:    string(GroupInfo.MemberAddMode),
		JoinApproval:     GroupInfo.GroupMembershipApprovalMode.IsJoinApprovalRequired,
		ParentJID:        parentJID,
		GroupOwner:       *owner,
		GroupCreatedAt:   GroupInfo.GroupCreated.Format("2006-01-02 15:04:05"),
		ParticipantCount: GroupInfo.ParticipantCount,
		Participants:     participants,
	}, nil
}

func (a *Api) CreateGroup(name string, participantJIDs []string) (string, error) {
	if a.waClient.Store.ID == nil {
		return "", fmt.Errorf("not logged in")
	}
	participants := make([]types.JID, len(participantJIDs))
	for i, jidStr := range participantJIDs {
		jid, err := types.ParseJID(jidStr)
		if err != nil {
			return "", fmt.Errorf("invalid participant JID %s: %w", jidStr, err)
		}
		participants[i] = jid.ToNonAD()
	}
	groupInfo, err := a.waClient.CreateGroup(a.ctx, whatsmeow.ReqCreateGroup{
		Name:         name,
		Participants: participants,
	})
	if err != nil {
		return "", err
	}
	slog.Info(fmt.Sprintf("Created group %s (%s)", groupInfo.GroupName.Name, groupInfo.JID), "source", "groups")
	return groupInfo.JID.String(), nil
}

func (a *Api) AddGroupParticipants(groupJID string, participantJIDs []string) error {
	return a.updateParticipants(groupJID, participantJIDs, whatsmeow.ParticipantChangeAdd)
}

func (a *Api) RemoveGroupParticipants(groupJID string, participantJIDs []string) error {
	return a.updateParticipants(groupJID, participantJIDs, whatsmeow.ParticipantChangeRemove)
}

func (a *Api) PromoteGroupParticipants(groupJID string, participantJIDs []string) error {
	return a.updateParticipants(groupJID, participantJIDs, whatsmeow.ParticipantChangePromote)
}

func (a *Api) DemoteGroupParticipants(groupJID string, participantJIDs []string) error {
	return a.updateParticipants(groupJID, participantJIDs, whatsmeow.ParticipantChangeDemote)
}

func (a *Api) updateParticipants(groupJID string, participantJIDs []string, action whatsmeow.ParticipantChange) error {
	jid, err := types.ParseJID(groupJID)
	if err != nil {
		return err
	}
	jids := make([]types.JID, len(participantJIDs))
	for i, p := range participantJIDs {
		jids[i], err = types.ParseJID(p)
		if err != nil {
			return fmt.Errorf("invalid JID %s: %w", p, err)
		}
	}
	_, err = a.waClient.UpdateGroupParticipants(a.ctx, jid, jids, action)
	if err != nil {
		return err
	}
	slog.Info(fmt.Sprintf("%s %d participants in %s", action, len(jids), groupJID), "source", "groups")
	return nil
}

func (a *Api) SetGroupName(groupJID, name string) error {
	jid, err := types.ParseJID(groupJID)
	if err != nil {
		return err
	}
	return a.waClient.SetGroupName(a.ctx, jid, name)
}

func (a *Api) SetGroupPhoto(groupJID, base64Data string) error {
	jid, err := types.ParseJID(groupJID)
	if err != nil {
		return err
	}
	data, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return fmt.Errorf("decode base64: %w", err)
	}
	_, err = a.waClient.SetGroupPhoto(a.ctx, jid, data)
	if err != nil {
		return err
	}
	slog.Info(fmt.Sprintf("Set group photo for %s", groupJID), "source", "groups")
	return nil
}

func (a *Api) LeaveGroup(groupJID string) error {
	jid, err := types.ParseJID(groupJID)
	if err != nil {
		return err
	}
	err = a.waClient.LeaveGroup(a.ctx, jid)
	if err != nil {
		return err
	}
	slog.Info(fmt.Sprintf("Left group %s", groupJID), "source", "groups")
	return nil
}

func (a *Api) AcceptGroupInviteLink(inviteCode string) (string, error) {
	info, err := a.waClient.GetGroupInfoFromLink(a.ctx, inviteCode)
	if err != nil {
		return "", fmt.Errorf("get group info from link: %w", err)
	}
	jid, err := a.waClient.JoinGroupWithLink(a.ctx, inviteCode)
	if err != nil {
		return "", fmt.Errorf("join group with link: %w", err)
	}
	slog.Info(fmt.Sprintf("Joined group %s (%s)", info.GroupName.Name, jid), "source", "groups")
	return jid.String(), nil
}

func (a *Api) GetGroupInviteLink(groupJID string) (string, error) {
	jid, err := types.ParseJID(groupJID)
	if err != nil {
		return "", err
	}
	link, err := a.waClient.GetGroupInviteLink(a.ctx, jid, false)
	if err != nil {
		return "", err
	}
	return link, nil
}

func (a *Api) SetGroupAnnounce(groupJID string, announce bool) error {
	jid, err := types.ParseJID(groupJID)
	if err != nil {
		return err
	}
	return a.waClient.SetGroupAnnounce(a.ctx, jid, announce)
}

func (a *Api) SetGroupLocked(groupJID string, locked bool) error {
	jid, err := types.ParseJID(groupJID)
	if err != nil {
		return err
	}
	return a.waClient.SetGroupLocked(a.ctx, jid, locked)
}

func (a *Api) CreateCommunity(name, description string) (string, error) {
	if a.waClient.Store.ID == nil {
		return "", fmt.Errorf("not logged in")
	}
	groupInfo, err := a.waClient.CreateGroup(a.ctx, whatsmeow.ReqCreateGroup{
		Name:        name,
		GroupParent: types.GroupParent{IsParent: true},
	})
	if err != nil {
		return "", err
	}
	if description != "" {
		jid, parseErr := types.ParseJID(groupInfo.JID.String())
		if parseErr == nil {
			if descErr := a.waClient.SetGroupDescription(a.ctx, jid, description); descErr != nil {
				slog.Warn(fmt.Sprintf("Failed to set community description: %v", descErr), "source", "communities")
			}
		}
	}
	slog.Info(fmt.Sprintf("Created community %s (%s)", name, groupInfo.JID), "source", "communities")
	return groupInfo.JID.String(), nil
}

func (a *Api) CreateCommunitySubGroup(parentJID, name string, participantJIDs []string) (string, error) {
	if a.waClient.Store.ID == nil {
		return "", fmt.Errorf("not logged in")
	}
	parent, err := types.ParseJID(parentJID)
	if err != nil {
		return "", fmt.Errorf("invalid parent JID: %w", err)
	}
	participants := make([]types.JID, len(participantJIDs))
	for i, jidStr := range participantJIDs {
		jid, err := types.ParseJID(jidStr)
		if err != nil {
			return "", fmt.Errorf("invalid participant JID %s: %w", jidStr, err)
		}
		participants[i] = jid.ToNonAD()
	}
	groupInfo, err := a.waClient.CreateGroup(a.ctx, whatsmeow.ReqCreateGroup{
		Name:              name,
		Participants:      participants,
		GroupLinkedParent: types.GroupLinkedParent{LinkedParentJID: parent},
	})
	if err != nil {
		return "", err
	}
	slog.Info(fmt.Sprintf("Created subgroup %s (%s) in %s", name, groupInfo.JID, parentJID), "source", "communities")
	return groupInfo.JID.String(), nil
}
