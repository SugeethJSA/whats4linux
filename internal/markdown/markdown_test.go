package markdown

import "testing"

func TestStripHTML(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{
			input:    "<p>Hello world</p>",
			expected: "Hello world",
		},
		{
			input:    "<p>Hello <b>bold</b> and <i>italic</i></p>",
			expected: "Hello bold and italic",
		},
		{
			input:    "<p>Line 1</p><p>Line 2</p>",
			expected: "Line 1\nLine 2",
		},
		{
			input:    "Line 1<br>Line 2",
			expected: "Line 1\nLine 2",
		},
		{
			input:    "&lt;p&gt;escaped&lt;/p&gt;",
			expected: "<p>escaped</p>",
		},
	}

	for _, tt := range tests {
		got := StripHTML(tt.input)
		if got != tt.expected {
			t.Errorf("StripHTML(%q) = %q; want %q", tt.input, got, tt.expected)
		}
	}
}
