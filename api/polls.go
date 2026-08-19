package api

import (
	"bytes"
	"fmt"
	"log/slog"
	"time"

	"github.com/lugvitc/whats4linux/internal/store"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

// PollOptionVotes is the vote tally for a single poll option.
type PollOptionVotes struct {
	Name  string `json:"name"`
	Votes int    `json:"votes"`
}

// PollVotesResult is the full vote state of a poll: per-option counts, the
// total number of voters and the current user's selection.
type PollVotesResult struct {
	Question      string            `json:"question"`
	Options       []PollOptionVotes `json:"options"`
	TotalVotes    int               `json:"totalVotes"`
	MyVoteIndices []int             `json:"myVoteIndices"`
	HasVoted      bool              `json:"hasVoted"`
}

// GetPollVotes returns the aggregated vote counts for a poll. Polls created
// before vote tracking existed fall back to option names parsed from the
// stored poll card HTML.
func (a *Api) GetPollVotes(chatJID, pollMessageID string) (PollVotesResult, error) {
	res := PollVotesResult{Question: ""}
	question, options, found, err := a.messageStore.GetPollMetadata(chatJID, pollMessageID)
	if err != nil {
		return res, err
	}
	if !found {
		question, options = a.pollOptionsFromCard(chatJID, pollMessageID)
	}
	if len(options) == 0 {
		return res, fmt.Errorf("poll %s not found in %s", pollMessageID, chatJID)
	}

	votes, err := a.messageStore.GetPollVotes(chatJID, pollMessageID)
	if err != nil {
		return res, err
	}

	res.Question = question
	res.Options = make([]PollOptionVotes, len(options))
	for i, name := range options {
		res.Options[i] = PollOptionVotes{Name: name}
	}
	res.TotalVotes = len(votes)

	myJID := ""
	if a.waClient != nil && a.waClient.Store.ID != nil {
		myJID = a.waClient.Store.ID.ToNonAD().String()
	}
	seen := make([]int, len(options))
	for voter, indices := range votes {
		for _, idx := range indices {
			if idx >= 0 && idx < len(seen) {
				seen[idx]++
			}
		}
		if myJID != "" && voter == myJID {
			res.MyVoteIndices = indices
			res.HasVoted = true
		}
	}
	for i := range res.Options {
		res.Options[i].Votes = seen[i]
	}
	return res, nil
}

// pollOptionsFromCard extracts question + option names from the stored poll
// card HTML (used for polls that predate the polls metadata table).
func (a *Api) pollOptionsFromCard(chatJID, pollMessageID string) (string, []string) {
	dm, err := a.messageStore.GetDecodedMessage(chatJID, pollMessageID)
	if err != nil {
		return "", nil
	}
	if dm.Content == nil {
		return "", nil
	}
	return store.ParsePollCardHTML(dm.Content.Conversation)
}

// SendPollVote votes in a poll from the app's own UI. The vote is sent via
// WhatsApp's msgsecret encryption and also recorded locally so the tally
// updates instantly.
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

	// Record our own vote locally so the tally reflects it immediately.
	_, options, found, err := a.messageStore.GetPollMetadata(chatJID, pollMessageID)
	if err != nil {
		slog.Warn("GetPollMetadata failed after sending vote", "source", "polls", "error", err)
	}
	if !found {
		_, options = a.pollOptionsFromCard(chatJID, pollMessageID)
	}
	indices := a.matchVoteHashes(options, whatsmeow.HashPollOptions(selectedOptions))
	if a.waClient.Store.ID != nil && len(indices) > 0 {
		voter := a.waClient.Store.ID.ToNonAD().String()
		if uerr := a.messageStore.UpsertPollVote(chatJID, pollMessageID, voter, indices); uerr != nil {
			slog.Warn("UpsertPollVote failed for own vote", "source", "polls", "error", uerr)
		}
	}

	slog.Info(fmt.Sprintf("Voted in poll %s in %s (%d options selected)", pollMessageID, chatJID, len(selectedOptions)), "source", "messages")
	runtime.EventsEmit(a.ctx, "wa:poll_vote_submitted", map[string]any{
		"chatId":    chatJID,
		"messageID": pollMessageID,
		"options":   selectedOptions,
	})
	a.refreshPollCard(chatJID, pollMessageID)
	return resp.ID, nil
}

// handlePollVoteEvent processes an incoming encrypted poll vote: decrypts it,
// maps the option hashes back to option indices, stores the vote and re-
// renders the poll card so counts appear for everyone.
func (a *Api) handlePollVoteEvent(v *events.Message) {
	pollUpdate := v.Message.GetPollUpdateMessage()
	if pollUpdate == nil {
		return
	}
	key := pollUpdate.GetPollCreationMessageKey()
	if key == nil || key.GetID() == "" {
		return
	}
	chatJID := v.Info.Chat.String()
	pollMessageID := key.GetID()

	decrypted, err := a.waClient.DecryptPollVote(a.ctx, v)
	if err != nil {
		slog.Warn("Failed to decrypt poll vote", "source", "polls", "error", err)
		return
	}
	selected := decrypted.GetSelectedOptions()

	_, options, found, err := a.messageStore.GetPollMetadata(chatJID, pollMessageID)
	if err != nil {
		slog.Warn("GetPollMetadata failed", "source", "polls", "error", err)
		return
	}
	if !found {
		_, options = a.pollOptionsFromCard(chatJID, pollMessageID)
	}
	if len(options) == 0 {
		slog.Warn("Poll options unknown, cannot record vote", "source", "polls", "poll", pollMessageID)
		return
	}

	indices := a.matchVoteHashes(options, selected)
	if len(indices) == 0 {
		slog.Warn("No matching poll options for vote", "source", "polls", "poll", pollMessageID)
		return
	}

	voter := v.Info.Sender.ToNonAD()
	if voter.ActualAgent() == types.LIDDomain && a.waClient.Store.LIDs != nil {
		if pn, lerr := a.waClient.Store.LIDs.GetPNForLID(a.ctx, voter); lerr == nil {
			voter = pn
		}
	}
	if err := a.messageStore.UpsertPollVote(chatJID, pollMessageID, voter.String(), indices); err != nil {
		slog.Warn("UpsertPollVote failed", "source", "polls", "error", err)
		return
	}

	a.refreshPollCard(chatJID, pollMessageID)
}

// matchVoteHashes maps the SHA-256 hashes carried by a vote back to option
// indices by comparing against hashes of the poll's option names.
func (a *Api) matchVoteHashes(options []string, voteHashes [][]byte) []int {
	optionHashes := whatsmeow.HashPollOptions(options)
	seen := make(map[int]bool)
	var indices []int
	for _, voteHash := range voteHashes {
		for i, optHash := range optionHashes {
			if bytes.Equal(voteHash, optHash) && !seen[i] {
				seen[i] = true
				indices = append(indices, i)
			}
		}
	}
	return indices
}

// refreshPollCard recomputes the poll's vote tally, re-renders its HTML card
// with counts, persists it and pushes the update to every open window.
func (a *Api) refreshPollCard(chatJID, pollMessageID string) {
	question, options, found, err := a.messageStore.GetPollMetadata(chatJID, pollMessageID)
	if err != nil {
		slog.Warn("GetPollMetadata failed during refresh", "source", "polls", "error", err)
		return
	}
	if !found {
		question, options = a.pollOptionsFromCard(chatJID, pollMessageID)
	}
	if len(options) == 0 {
		return
	}

	votes, err := a.messageStore.GetPollVotes(chatJID, pollMessageID)
	if err != nil {
		slog.Warn("GetPollVotes failed during refresh", "source", "polls", "error", err)
		return
	}
	counts := make([]int, len(options))
	for _, indices := range votes {
		for _, idx := range indices {
			if idx >= 0 && idx < len(counts) {
				counts[idx]++
			}
		}
	}
	var myIndices []int
	if a.waClient != nil && a.waClient.Store.ID != nil {
		myJID := a.waClient.Store.ID.ToNonAD().String()
		if my, ok := votes[myJID]; ok {
			myIndices = my
		}
	}

	html := store.RenderPollCard(question, options, counts, myIndices)
	if err := a.messageStore.UpdatePollCardText(pollMessageID, html); err != nil {
		slog.Warn("UpdatePollCardText failed", "source", "polls", "error", err)
		return
	}

	runtime.EventsEmit(a.ctx, "wa:poll_vote_update", map[string]any{
		"chatId":    chatJID,
		"messageID": pollMessageID,
	})

	if dm, derr := a.messageStore.GetDecodedMessage(chatJID, pollMessageID); derr == nil {
		pollTS, perr := time.Parse(time.RFC3339, dm.Info.Timestamp)
		if perr != nil {
			pollTS = time.Now()
		}
		runtime.EventsEmit(a.ctx, "wa:new_message", map[string]any{
			"chatId":      chatJID,
			"message":     dm,
			"messageText": html,
			"timestamp":   pollTS.Unix(),
			"sender":      dm.Info.PushName,
			"pollUpdate":  true,
		})
	}
	runtime.EventsEmit(a.ctx, "wa:chat_list_refresh")
}
