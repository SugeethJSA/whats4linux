package logcat

import (
	"fmt"
	"sync"
	"time"
)

type Level int

const (
	LevelDebug Level = iota
	LevelInfo
	LevelWarn
	LevelError
)

func (l Level) String() string {
	switch l {
	case LevelDebug:
		return "DEBUG"
	case LevelInfo:
		return "INFO"
	case LevelWarn:
		return "WARN"
	case LevelError:
		return "ERROR"
	default:
		return "UNKNOWN"
	}
}

type Entry struct {
	ID        int64  `json:"id"`
	Timestamp int64  `json:"timestamp"`
	Level     string `json:"level"`
	Source    string `json:"source"`
	Message   string `json:"message"`
}

type Buffer struct {
	mu      sync.Mutex
	entries []Entry
	max     int
	nextID  int64
}

var global *Buffer

func Init(maxEntries int) {
	global = New(maxEntries)
}

func Get() *Buffer {
	return global
}

func New(max int) *Buffer {
	return &Buffer{
		entries: make([]Entry, 0, max),
		max:     max,
	}
}

func (b *Buffer) Write(level Level, source, format string, args ...any) {
	msg := format
	if len(args) > 0 {
		msg = fmt.Sprintf(format, args...)
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	b.nextID++
	e := Entry{
		ID:        b.nextID,
		Timestamp: time.Now().UnixMilli(),
		Level:     level.String(),
		Source:    source,
		Message:   msg,
	}
	if len(b.entries) >= b.max {
		copy(b.entries, b.entries[1:])
		b.entries[len(b.entries)-1] = e
	} else {
		b.entries = append(b.entries, e)
	}
}

func (b *Buffer) Debug(source, format string, args ...any)  { b.Write(LevelDebug, source, format, args...) }
func (b *Buffer) Info(source, format string, args ...any)   { b.Write(LevelInfo, source, format, args...) }
func (b *Buffer) Warn(source, format string, args ...any)   { b.Write(LevelWarn, source, format, args...) }
func (b *Buffer) Error(source, format string, args ...any)  { b.Write(LevelError, source, format, args...) }

func (b *Buffer) Read(limit int, afterID int64) []Entry {
	b.mu.Lock()
	defer b.mu.Unlock()

	if len(b.entries) == 0 {
		return nil
	}

	start := 0
	if afterID > 0 {
		for i, e := range b.entries {
			if e.ID > afterID {
				start = i
				break
			}
		}
	}

	if limit <= 0 || start+limit > len(b.entries) {
		limit = len(b.entries) - start
	}
	if limit <= 0 {
		return nil
	}

	out := make([]Entry, limit)
	copy(out, b.entries[start:start+limit])
	return out
}

func (b *Buffer) Clear() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.entries = b.entries[:0]
}

func (b *Buffer) Len() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	return len(b.entries)
}

func Debug(source, format string, args ...any) { global.Write(LevelDebug, source, format, args...) }
func Info(source, format string, args ...any)  { global.Write(LevelInfo, source, format, args...) }
func Warn(source, format string, args ...any)  { global.Write(LevelWarn, source, format, args...) }
func Error(source, format string, args ...any) { global.Write(LevelError, source, format, args...) }
