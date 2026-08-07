package markdown

import "testing"

func TestParseInline(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{"empty", "", ""},
		{"plain", "hello world", "hello world"},
		{"bold", "hello *world*", "hello <b>world</b>"},
		{"italic", "_italic_", "<i>italic</i>"},
		{"strike", "~gone~", "<s>gone</s>"},
		{"inline code", "`x := 1`", `<span class="inline-code">x := 1</span>`},
		{"escapes html", "a < b & c", "a &lt; b &amp; c"},
		{"asterisk between words is literal", "2*3=6", "2*3=6"},
		{"underscore between words is literal", "snake_case", "snake_case"},
		{"unclosed token is literal", "hello *world", "hello *world"},
		{"empty emphasis content is literal", "x * * y", "x * * y"},
		{"nested emphasis not supported, stays literal", "a *b _c_*", "a <b>b _c_</b>"},
		{"link", "see https://x.com now", `see <a href="https://x.com" class="msg-link" rel="noreferrer noopener">https://x.com</a> now`},
		{"www link gets scheme", "www.example.com", `<a href="https://www.example.com" class="msg-link" rel="noreferrer noopener">www.example.com</a>`},
		{"link trailing punctuation", "https://x.com.", `<a href="https://x.com" class="msg-link" rel="noreferrer noopener">https://x.com</a>.`},
		{"bold around link", "*see https://x.com*", `<b>see https://x.com</b>`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ParseInline(tt.input); got != tt.want {
				t.Fatalf("ParseInline(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}
