package store

import (
	"reflect"
	"strings"
	"testing"
)

func TestSaveAndGetPollMetadata(t *testing.T) {
	ms := newTestMessageStore(t)
	if err := ms.SavePollMetadata("g1@s.whatsapp.net", "poll1", "Lunch?", []string{"Pizza", "Sushi"}); err != nil {
		t.Fatal(err)
	}
	question, options, found, err := ms.GetPollMetadata("g1@s.whatsapp.net", "poll1")
	if err != nil {
		t.Fatal(err)
	}
	if !found {
		t.Fatal("metadata not found after save")
	}
	if question != "Lunch?" || !reflect.DeepEqual(options, []string{"Pizza", "Sushi"}) {
		t.Errorf("unexpected metadata: %q %v", question, options)
	}
}

func TestGetPollMetadataMissing(t *testing.T) {
	ms := newTestMessageStore(t)
	_, _, found, err := ms.GetPollMetadata("g1@s.whatsapp.net", "nope")
	if err != nil {
		t.Fatal(err)
	}
	if found {
		t.Fatal("metadata should be missing")
	}
}

func TestPollVotesRoundTrip(t *testing.T) {
	ms := newTestMessageStore(t)
	chat := "g1@s.whatsapp.net"
	if err := ms.SavePollMetadata(chat, "poll1", "Q?", []string{"A", "B", "C"}); err != nil {
		t.Fatal(err)
	}
	if err := ms.UpsertPollVote(chat, "poll1", "alice@s.whatsapp.net", []int{0}); err != nil {
		t.Fatal(err)
	}
	if err := ms.UpsertPollVote(chat, "poll1", "bob@s.whatsapp.net", []int{1, 2}); err != nil {
		t.Fatal(err)
	}
	votes, err := ms.GetPollVotes(chat, "poll1")
	if err != nil {
		t.Fatal(err)
	}
	if len(votes) != 2 {
		t.Fatalf("expected 2 voters, got %d", len(votes))
	}
	if !reflect.DeepEqual(votes["alice@s.whatsapp.net"], []int{0}) {
		t.Errorf("alice votes wrong: %v", votes["alice@s.whatsapp.net"])
	}
	if !reflect.DeepEqual(votes["bob@s.whatsapp.net"], []int{1, 2}) {
		t.Errorf("bob votes wrong: %v", votes["bob@s.whatsapp.net"])
	}

	// Re-vote replaces the previous selection.
	if err := ms.UpsertPollVote(chat, "poll1", "alice@s.whatsapp.net", []int{2}); err != nil {
		t.Fatal(err)
	}
	votes, err = ms.GetPollVotes(chat, "poll1")
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(votes["alice@s.whatsapp.net"], []int{2}) {
		t.Errorf("alice re-vote wrong: %v", votes["alice@s.whatsapp.net"])
	}
}

func TestUpdatePollCardText(t *testing.T) {
	ms := newTestMessageStore(t)
	insertTestMessage(t, ms, "poll1", "g1@s.whatsapp.net", 100, "")
	if err := ms.UpdatePollCardText("poll1", "<b>new card</b>"); err != nil {
		t.Fatal(err)
	}
	dm, err := ms.GetDecodedMessage("g1@s.whatsapp.net", "poll1")
	if err != nil {
		t.Fatal(err)
	}
	if dm.Content == nil || dm.Content.Conversation != "<b>new card</b>" {
		t.Errorf("card text not updated: %+v", dm.Content)
	}
	if dm.Edited {
		t.Error("card text update must not set the edited flag")
	}
}

func TestParsePollCardHTML(t *testing.T) {
	html := `<div class="msg-card msg-poll">📊 <b>Lunch?</b><div class="poll-opt">○ Pizza</div><div class="poll-opt">○ Sushi &amp; more</div><div class="msg-card-note">3 votes</div></div>`
	question, options := ParsePollCardHTML(html)
	if question != "Lunch?" {
		t.Errorf("question wrong: %q", question)
	}
	if !reflect.DeepEqual(options, []string{"Pizza", "Sushi & more"}) {
		t.Errorf("options wrong: %v", options)
	}
}

func TestRenderPollCardIncludesCountsAndMine(t *testing.T) {
	out := RenderPollCard("Lunch?", []string{"Pizza", "Sushi"}, []int{3, 1}, []int{0})
	for _, want := range []string{"msg-poll", "○ Pizza", "○ Sushi", "3 votes", "75%", "25%", "poll-mine", "✓ Pizza"} {
		if !strings.Contains(out, want) {
			t.Errorf("card missing %q in %q", want, out)
		}
	}
	if strings.Contains(out, "No votes yet") {
		t.Error("card should show vote total once votes exist")
	}
}

func TestRenderPollCardNoVotesYet(t *testing.T) {
	out := RenderPollCard("Lunch?", []string{"Pizza"}, []int{0}, nil)
	if !strings.Contains(out, "No votes yet") {
		t.Errorf("card should say no votes yet: %q", out)
	}
	if strings.Contains(out, "vote on your phone") {
		t.Error("card must not tell users to vote on their phone")
	}
}
