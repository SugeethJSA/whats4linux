package api

import (
	"context"
	"fmt"
	"strings"

	"github.com/nyaruka/phonenumbers"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types"
)

type Contact struct {
	Phno       string `json:"phno"`
	JID        string `json:"jid"`
	Short      string `json:"short"`
	FullName   string `json:"full_name"`
	PushName   string `json:"push_name"`
	IsBusiness bool   `json:"is_business"`
	AvatarURL  string `json:"avatar_url"`
}

func canonicalUserJID(ctx context.Context, client *whatsmeow.Client, jid types.JID) types.JID {
	if jid.ActualAgent() == types.LIDDomain {
		if pn, err := client.Store.LIDs.GetPNForLID(ctx, jid); err == nil {
			jid = pn
		}
	}
	return jid.ToNonAD()
}

func (a *Api) GetContact(jid types.JID) (*Contact, error) {
	jid = canonicalUserJID(a.ctx, a.waClient, jid)
	contact, err := a.waClient.Store.Contacts.GetContact(a.ctx, jid)
	if err != nil {
		return nil, err
	}
	rawNum := "+" + jid.User
	// Parse phone number to use as International Format
	num, err := phonenumbers.Parse(rawNum, "")
	if err != nil {
		return nil, fmt.Errorf("invalid phone number")
	}

	return &Contact{
		Phno:       phonenumbers.Format(num, phonenumbers.INTERNATIONAL),
		JID:        jid.String(),
		FullName:   contact.FullName,
		Short:      contact.FirstName,
		PushName:   contact.PushName,
		IsBusiness: contact.BusinessName != "",
	}, nil
}

// SearchContacts searches contacts by name or phone number (case-insensitive).
func (a *Api) SearchContacts(query string) ([]Contact, error) {
	all, err := a.FetchContacts()
	if err != nil {
		return nil, err
	}
	q := strings.ToLower(query)
	var out []Contact
	for _, c := range all {
		if strings.Contains(strings.ToLower(c.FullName), q) ||
			strings.Contains(strings.ToLower(c.Short), q) ||
			strings.Contains(strings.ToLower(c.PushName), q) ||
			strings.Contains(c.Phno, q) ||
			strings.Contains(c.JID, q) {
			out = append(out, c)
		}
	}
	return out, nil
}

func (a *Api) FetchContacts() ([]Contact, error) {
	rawContacts, err := a.waClient.Store.Contacts.GetAllContacts(a.ctx)
	if err != nil {
		return nil, err
	}
	contacts := make([]Contact, 0, len(rawContacts))
	for jid, c := range rawContacts {
		rawNum := "+" + jid.User
		// Parse phone number to use as International Format
		num, err := phonenumbers.Parse(rawNum, "")
		if err != nil && !phonenumbers.IsValidNumber(num) {
			continue
		}

		contacts = append(contacts, Contact{
			Phno:       phonenumbers.Format(num, phonenumbers.INTERNATIONAL),
			JID:        jid.String(),
			FullName:   c.FullName,
			Short:      c.FirstName,
			PushName:   c.PushName,
			IsBusiness: c.BusinessName != "",
		})
	}
	return contacts, nil
}
