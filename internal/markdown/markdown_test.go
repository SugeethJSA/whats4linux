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

func TestMarkdownLinesToHTMLCodeFences(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{
			name:  "simple fence",
			input: "```\ncode line\n```",
			want:  `<pre class="code-block"><code>code line</code></pre>`,
		},
		{
			name:  "fence with language tag",
			input: "```go\nfunc main() {}\n```",
			want:  `<pre class="code-block"><code>func main() {}</code></pre>`,
		},
		{
			name:  "content is escaped, not parsed",
			input: "```\n<b>raw</b> *bold* https://x.com\n```",
			want:  `<pre class="code-block"><code>&lt;b&gt;raw&lt;/b&gt; *bold* https://x.com</code></pre>`,
		},
		{
			name:  "multi-line keeps newlines",
			input: "```\na\nb\n```",
			want:  "<pre class=\"code-block\"><code>a\nb</code></pre>",
		},
		{
			name:  "unterminated fence closes at end",
			input: "```\nline",
			want:  `<pre class="code-block"><code>line</code></pre>`,
		},
		{
			name:  "surrounding text stays inline",
			input: "before\n```\ncode\n```\nafter",
			want:  "<p>before</p>" + `<pre class="code-block"><code>code</code></pre>` + "<p>after</p>",
		},
		{
			name:  "inline backticks still work outside fences",
			input: "`code` here",
			want:  `<p><span class="inline-code">code</span> here</p>`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := MarkdownLinesToHTML(tt.input)
			if got != tt.want {
				t.Errorf("MarkdownLinesToHTML(%q) = %q; want %q", tt.input, got, tt.want)
			}
		})
	}
}
