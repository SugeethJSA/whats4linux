package query

const (
	// Polls metadata (question + option names) keyed by chat and message ID.
	CreatePollsTable = `
	CREATE TABLE IF NOT EXISTS polls (
		chat_jid TEXT NOT NULL,
		message_id TEXT NOT NULL,
		question TEXT NOT NULL,
		options_json TEXT NOT NULL,
		PRIMARY KEY (chat_jid, message_id)
	);
	`

	// Per-voter poll vote selections. Voter JIDs are stored only to replace
	// re-votes and to detect the current user's own vote; they are never
	// displayed (WhatsApp polls are anonymous).
	CreatePollVotesTable = `
	CREATE TABLE IF NOT EXISTS poll_votes (
		chat_jid TEXT NOT NULL,
		poll_message_id TEXT NOT NULL,
		voter_jid TEXT NOT NULL,
		option_indices_json TEXT NOT NULL,
		PRIMARY KEY (chat_jid, poll_message_id, voter_jid)
	);
	CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON poll_votes(chat_jid, poll_message_id);
	`

	InsertPoll = `
	INSERT OR REPLACE INTO polls (chat_jid, message_id, question, options_json)
	VALUES (?, ?, ?, ?)
	`

	SelectPoll = `
	SELECT question, options_json
	FROM polls
	WHERE chat_jid = ? AND message_id = ?
	LIMIT 1
	`

	UpsertPollVote = `
	INSERT OR REPLACE INTO poll_votes (chat_jid, poll_message_id, voter_jid, option_indices_json)
	VALUES (?, ?, ?, ?)
	`

	SelectPollVotes = `
	SELECT voter_jid, option_indices_json
	FROM poll_votes
	WHERE chat_jid = ? AND poll_message_id = ?
	`

	// UpdatePollCardText replaces a poll message's rendered HTML card without
	// touching the edited flag.
	UpdatePollCardText = `
	UPDATE messages
	SET text = ?
	WHERE message_id = ?
	`
)
