package query

const (
	CreateReadReceiptsTable = `
	CREATE TABLE IF NOT EXISTS read_receipts (
		chat_jid TEXT PRIMARY KEY,
		read_after_timestamp INTEGER NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_read_receipts_timestamp ON read_receipts(read_after_timestamp);
	`
)
