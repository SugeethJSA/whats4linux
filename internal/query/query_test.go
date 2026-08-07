package query

import (
	"database/sql"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

func newQueryDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if _, err := db.Exec(`PRAGMA foreign_keys=ON;`); err != nil {
		t.Fatal(err)
	}
	return db
}

func TestMessagesTableRoundTrip(t *testing.T) {
	db := newQueryDB(t)
	if _, err := db.Exec(CreateMessagesTable); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(CreateMessageMediaTable); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(CreateLinkPreviewsTable); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(InsertMessage,
		"m1", "123@s.whatsapp.net", "456@s.whatsapp.net", time.Now().Unix(), false,
		"hello", true, "", false, false, 0,
	); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(InsertMessage,
		"m2", "123@s.whatsapp.net", "456@s.whatsapp.net", time.Now().Unix(), false,
		"other", false, "", false, false, 0,
	); err != nil {
		t.Fatal(err)
	}

	var chatJID, senderJID, text, replyTo string
	var timestamp int64
	var isFromMe, hasMedia, edited, forwarded bool
	if err := db.QueryRow(SelectMessageByID, "m1").Scan(&chatJID, &senderJID, &timestamp, &isFromMe, &text, &hasMedia, &replyTo, &edited, &forwarded); err != nil {
		t.Fatalf("SelectMessageByID: %v", err)
	}
	if text != "hello" {
		t.Fatalf("text = %q, want hello", text)
	}

	if _, err := db.Exec(UpdateMessage, "edited text", "m1"); err != nil {
		t.Fatal(err)
	}
	var editedText string
	var editedAfter bool
	if err := db.QueryRow(SelectMessageByID, "m1").Scan(&chatJID, &senderJID, &timestamp, &isFromMe, &editedText, &hasMedia, &replyTo, &editedAfter, &forwarded); err != nil {
		t.Fatalf("SelectMessageByID after edit: %v", err)
	}
	if editedText != "edited text" || !editedAfter {
		t.Fatalf("after edit: text=%q edited=%v", editedText, editedAfter)
	}

	rows, err := db.Query(SelectLatestMessagesByChat, "123@s.whatsapp.net", 10)
	if err != nil {
		t.Fatal(err)
	}
	count := 0
	for rows.Next() {
		count++
	}
	rows.Close()
	if count != 2 {
		t.Fatalf("SelectLatestMessagesByChat rows = %d, want 2", count)
	}

	searchRows, err := db.Query(SearchMessagesSelect, "edited")
	if err != nil {
		t.Fatal(err)
	}
	searchCount := 0
	for searchRows.Next() {
		searchCount++
	}
	searchRows.Close()
	if searchCount != 1 {
		t.Fatalf("search rows = %d, want 1", searchCount)
	}
}

func TestMessageMediaTableRoundTrip(t *testing.T) {
	db := newQueryDB(t)
	if _, err := db.Exec(CreateMessageMediaTable); err != nil {
		t.Fatal(err)
	}
	mediaKey := []byte{1, 2, 3}
	sha := []byte{4, 5, 6}
	if _, err := db.Exec(InsertMessageMedia,
		"m1", 1, "https://media.example/1", "image/jpeg", "/dp", mediaKey, sha, sha,
		640, 480, "pic.jpg", 0, nil, 0, 0, nil, 0,
	); err != nil {
		t.Fatal(err)
	}

	var mediaType, width, height int
	var url, mimetype, directPath, fileName string
	var gotMediaKey, gotSha, encSha []byte
	var fileLength int64
	if err := db.QueryRow(SelectMessageMediaByMessageID, "m1").Scan(&mediaType, &url, &mimetype, &directPath, &gotMediaKey, &gotSha, &encSha, &width, &height, &fileName, &fileLength); err != nil {
		t.Fatalf("SelectMessageMediaByMessageID: %v", err)
	}
	if mediaType != 1 || url != "https://media.example/1" {
		t.Fatalf("media = type %d url %q", mediaType, url)
	}

	if _, err := db.Exec(UpdateMessageMediaByMessageID,
		1, "https://media.example/2", "image/jpeg", "/dp", mediaKey, sha, sha,
		800, 600, "pic.jpg", 0, 0, nil, "m1",
	); err != nil {
		t.Fatal(err)
	}
	var newURL string
	var newWidth int
	if err := db.QueryRow(SelectMessageMediaByMessageID, "m1").Scan(&mediaType, &newURL, &mimetype, &directPath, &gotMediaKey, &gotSha, &encSha, &newWidth, &height, &fileName, &fileLength); err != nil {
		t.Fatal(err)
	}
	if newURL != "https://media.example/2" || newWidth != 800 {
		t.Fatalf("after update: url %q width %d", newURL, newWidth)
	}
}

func TestLinkPreviewsTableRoundTrip(t *testing.T) {
	db := newQueryDB(t)
	if _, err := db.Exec(CreateLinkPreviewsTable); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(InsertLinkPreview,
		"m1", "https://example.com", "Example", "A page", nil, "/dp", nil, nil, nil,
	); err != nil {
		t.Fatal(err)
	}

	var url, title string
	var description string
	var thumbnail []byte
	if err := db.QueryRow(SelectLinkPreviewByMessageID, "m1").Scan(&url, &title, &description, &thumbnail); err != nil {
		t.Fatalf("SelectLinkPreviewByMessageID: %v", err)
	}
	if url != "https://example.com" || title != "Example" {
		t.Fatalf("preview = %q %q", url, title)
	}

	if _, err := db.Exec(UpdateLinkPreviewThumbnail, []byte{9, 9}, "m1"); err != nil {
		t.Fatal(err)
	}
	var thumb, directPath, lpMediaKey, lpFileSHA, lpFileEncSHA []byte
	if err := db.QueryRow(SelectLinkPreviewMediaByMessageID, "m1").Scan(&thumb, &directPath, &lpMediaKey, &lpFileSHA, &lpFileEncSHA); err != nil {
		t.Fatalf("SelectLinkPreviewMediaByMessageID: %v", err)
	}
	if len(thumb) != 2 {
		t.Fatalf("thumbnail = %v, want updated bytes", thumb)
	}
}

func TestReactionsTableRoundTrip(t *testing.T) {
	db := newQueryDB(t)
	if _, err := db.Exec(CreateMessagesTable); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(CreateReactionsTable); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(InsertMessage,
		"m1", "123@s.whatsapp.net", "456@s.whatsapp.net", time.Now().Unix(), false,
		"hello", false, "", false, false, 0,
	); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(InsertReaction, "m1", "456@s.whatsapp.net", "❤️"); err != nil {
		t.Fatal(err)
	}

	rows, err := db.Query(SelectReactionsByMessageID, "m1")
	if err != nil {
		t.Fatal(err)
	}
	count := 0
	for rows.Next() {
		count++
	}
	rows.Close()
	if count != 1 {
		t.Fatalf("reactions = %d, want 1", count)
	}

	if _, err := db.Exec(DeleteReactionsByMessageIDAndSenderID, "m1", "456@s.whatsapp.net"); err != nil {
		t.Fatal(err)
	}
	var remaining int
	if err := db.QueryRow(`SELECT COUNT(*) FROM reactions WHERE message_id = ?`, "m1").Scan(&remaining); err != nil {
		t.Fatal(err)
	}
	if remaining != 0 {
		t.Fatalf("reactions after delete = %d, want 0", remaining)
	}
}

func TestPinnedMessagesTableRoundTrip(t *testing.T) {
	db := newQueryDB(t)
	if _, err := db.Exec(CreateMessagesTable); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(CreatePinnedMessagesTable); err != nil {
		t.Fatal(err)
	}
	now := time.Now().Unix()
	if _, err := db.Exec(InsertPinnedMessages, "m1", "123@s.whatsapp.net", "456@s.whatsapp.net", now, 0); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(InsertPinnedMessages, "m2", "123@s.whatsapp.net", "456@s.whatsapp.net", now, 3600); err != nil {
		t.Fatal(err)
	}

	rows, err := db.Query(GetChatPinnedMessagesWithText, "123@s.whatsapp.net", now)
	if err != nil {
		t.Fatal(err)
	}
	count := 0
	for rows.Next() {
		count++
	}
	rows.Close()
	if count != 2 {
		t.Fatalf("pinned with text rows = %d, want 2", count)
	}

	// m2 expires after 1h: at now+2h it must be flushed, m1 (0 = forever) stays.
	if _, err := db.Exec(DeleteExpiredPinnedMessages, now+2*3600); err != nil {
		t.Fatal(err)
	}
	var remaining int
	if err := db.QueryRow(`SELECT COUNT(*) FROM pinned_messages`).Scan(&remaining); err != nil {
		t.Fatal(err)
	}
	if remaining != 1 {
		t.Fatalf("pinned after expiry flush = %d, want 1", remaining)
	}

	if _, err := db.Exec(DeletePinnedMessageByMessageId, "m1"); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(`SELECT COUNT(*) FROM pinned_messages`).Scan(&remaining); err != nil {
		t.Fatal(err)
	}
	if remaining != 0 {
		t.Fatalf("pinned after delete = %d, want 0", remaining)
	}
}

func TestPinnedChatsTableRoundTrip(t *testing.T) {
	db := newQueryDB(t)
	if _, err := db.Exec(CreatePinnedChatsTable); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(UpsertPinnedChat, "123@s.whatsapp.net", time.Now().Unix()); err != nil {
		t.Fatal(err)
	}
	rows, err := db.Query(SelectPinnedChats)
	if err != nil {
		t.Fatal(err)
	}
	count := 0
	for rows.Next() {
		count++
	}
	rows.Close()
	if count != 1 {
		t.Fatalf("pinned chats = %d, want 1", count)
	}
	if _, err := db.Exec(DeletePinnedChat, "123@s.whatsapp.net"); err != nil {
		t.Fatal(err)
	}
}

func TestMutedChatsTableRoundTrip(t *testing.T) {
	db := newQueryDB(t)
	if _, err := db.Exec(CreateMutedChatsTable); err != nil {
		t.Fatal(err)
	}
	now := time.Now().Unix()
	if _, err := db.Exec(UpsertMutedChat, "123@s.whatsapp.net", -1); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(UpsertMutedChat, "456@s.whatsapp.net", now-60); err != nil {
		t.Fatal(err)
	}

	var until int64
	if err := db.QueryRow(SelectMutedUntilByChatJID, "123@s.whatsapp.net").Scan(&until); err != nil {
		t.Fatal(err)
	}
	if until != -1 {
		t.Fatalf("muted_until = %d, want -1", until)
	}

	rows, err := db.Query(SelectMutedChatJIDs, now)
	if err != nil {
		t.Fatal(err)
	}
	jids := []string{}
	for rows.Next() {
		var jid string
		if err := rows.Scan(&jid); err != nil {
			t.Fatal(err)
		}
		jids = append(jids, jid)
	}
	rows.Close()
	if len(jids) != 1 || jids[0] != "123@s.whatsapp.net" {
		t.Fatalf("active mutes = %v, want only 123@s.whatsapp.net (expired excluded)", jids)
	}

	if _, err := db.Exec(DeleteMutedChatByChatJID, "123@s.whatsapp.net"); err != nil {
		t.Fatal(err)
	}
}

func TestArchivedChatsTableRoundTrip(t *testing.T) {
	db := newQueryDB(t)
	if _, err := db.Exec(CreateArchivedChatsTable); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(UpsertArchivedChat, "123@s.whatsapp.net", time.Now().Unix()); err != nil {
		t.Fatal(err)
	}
	rows, err := db.Query(SelectArchivedChats)
	if err != nil {
		t.Fatal(err)
	}
	count := 0
	for rows.Next() {
		count++
	}
	rows.Close()
	if count != 1 {
		t.Fatalf("archived chats = %d, want 1", count)
	}
	if _, err := db.Exec(DeleteArchivedChat, "123@s.whatsapp.net"); err != nil {
		t.Fatal(err)
	}
}

func TestImageIndexTableRoundTrip(t *testing.T) {
	db := newQueryDB(t)
	if _, err := db.Exec(CreateImageIndexTable); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(SaveImageIndex, "m1", "sha1", "image/jpeg", 640, 480, time.Now().Unix()); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(SaveImageIndex, "m2", "sha2", "image/png", 100, 100, time.Now().Unix()); err != nil {
		t.Fatal(err)
	}

	var sha, mime string
	var width, height, createdAt int64
	var imageID string
	if err := db.QueryRow(GetImageByID, "m1").Scan(&imageID, &sha, &mime, &width, &height, &createdAt); err != nil {
		t.Fatalf("GetImageByID: %v", err)
	}
	if sha != "sha1" {
		t.Fatalf("sha = %q, want sha1", sha)
	}

	rows, err := db.Query(GetImagesByIDsPrefix + `?, ?)`, "m1", "m2")
	if err != nil {
		t.Fatal(err)
	}
	count := 0
	for rows.Next() {
		count++
	}
	rows.Close()
	if count != 2 {
		t.Fatalf("GetImagesByIDsPrefix rows = %d, want 2", count)
	}

	if _, err := db.Exec(DeleteImageIndex, "m1"); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(GetImageByID, "m1").Scan(&imageID, &sha, &mime, &width, &height, &createdAt); err != sql.ErrNoRows {
		t.Fatalf("GetImageByID after delete = %v, want sql.ErrNoRows", err)
	}
}

func TestReadReceiptsTableRoundTrip(t *testing.T) {
	db := newQueryDB(t)
	if _, err := db.Exec(CreateReadReceiptsTable); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO read_receipts (chat_jid, read_after_timestamp) VALUES (?, ?)`,
		"123@s.whatsapp.net", time.Now().Unix(),
	); err != nil {
		t.Fatal(err)
	}

	rows, err := db.Query(SelectDistinctJIDColumnReadReceipts)
	if err != nil {
		t.Fatal(err)
	}
	var jids []string
	for rows.Next() {
		var jid string
		if err := rows.Scan(&jid); err != nil {
			t.Fatal(err)
		}
		jids = append(jids, jid)
	}
	rows.Close()
	if len(jids) != 1 || jids[0] != "123@s.whatsapp.net" {
		t.Fatalf("read receipt jids = %v", jids)
	}

	if _, err := db.Exec(UpdateReadReceiptsJID, "999@s.whatsapp.net", "123@s.whatsapp.net"); err != nil {
		t.Fatal(err)
	}
	var migrated int
	if err := db.QueryRow(`SELECT COUNT(*) FROM read_receipts WHERE chat_jid = '999@s.whatsapp.net'`).Scan(&migrated); err != nil {
		t.Fatal(err)
	}
	if migrated != 1 {
		t.Fatalf("migrated read receipt rows = %d, want 1", migrated)
	}
}
