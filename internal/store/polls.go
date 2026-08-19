package store

import (
	"database/sql"
	"encoding/json"
	"log"

	"github.com/lugvitc/whats4linux/internal/query"
)

// SavePollMetadata stores a poll's question and option names so incoming
// votes (which carry only hashes of option names) can be mapped back to
// option indices.
func (ms *MessageStore) SavePollMetadata(chatJID, messageID, question string, options []string) error {
	opts, err := json.Marshal(options)
	if err != nil {
		return err
	}
	return ms.runSync(func(tx *sql.Tx) error {
		_, err := tx.Exec(query.InsertPoll, chatJID, messageID, question, string(opts))
		return err
	})
}

// GetPollMetadata returns the poll question and option names. The second
// return value is false when no metadata exists for the poll.
func (ms *MessageStore) GetPollMetadata(chatJID, messageID string) (string, []string, bool, error) {
	var question, optionsJSON string
	err := ms.db.QueryRow(query.SelectPoll, chatJID, messageID).Scan(&question, &optionsJSON)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", nil, false, nil
		}
		return "", nil, false, err
	}
	var options []string
	if err := json.Unmarshal([]byte(optionsJSON), &options); err != nil {
		return "", nil, false, err
	}
	return question, options, true, nil
}

// UpsertPollVote records (or replaces) one voter's selection for a poll.
// Re-votes replace the previous selection for the same voter.
func (ms *MessageStore) UpsertPollVote(chatJID, pollMessageID, voterJID string, optionIndices []int) error {
	indices, err := json.Marshal(optionIndices)
	if err != nil {
		return err
	}
	return ms.runSync(func(tx *sql.Tx) error {
		_, err := tx.Exec(query.UpsertPollVote, chatJID, pollMessageID, voterJID, string(indices))
		return err
	})
}

// GetPollVotes returns every stored vote for a poll, keyed by voter JID.
func (ms *MessageStore) GetPollVotes(chatJID, pollMessageID string) (map[string][]int, error) {
	rows, err := ms.db.Query(query.SelectPollVotes, chatJID, pollMessageID)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	votes := make(map[string][]int)
	for rows.Next() {
		var voter, indicesJSON string
		if err := rows.Scan(&voter, &indicesJSON); err != nil {
			return nil, err
		}
		var indices []int
		if err := json.Unmarshal([]byte(indicesJSON), &indices); err != nil {
			continue
		}
		votes[voter] = indices
	}
	return votes, rows.Err()
}

// UpdatePollCardText rewrites the stored HTML of a poll card message so
// persisted history and the chat list reflect current vote counts.
func (ms *MessageStore) UpdatePollCardText(messageID, html string) error {
	return ms.runSync(func(tx *sql.Tx) error {
		_, err := tx.Exec(query.UpdatePollCardText, html, messageID)
		return err
	})
}

// LogPollMetadataError is a small helper to keep call sites terse.
func LogPollMetadataError(action string, err error) {
	if err != nil {
		log.Println("poll store:", action, "failed:", err)
	}
}
