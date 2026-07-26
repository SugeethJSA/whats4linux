package logcat

import (
	"fmt"
	"os"
	"path/filepath"
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
	mu       sync.Mutex
	entries  []Entry
	max      int
	nextID   int64
	logDir   string
	logFile  *os.File
}

var global *Buffer

var logDir string

func SetLogDir(dir string) {
	logDir = dir
}

func Init(maxEntries int) {
	global = New(maxEntries)
	global.logDir = logDir
	global.openLogFile()
}

func (b *Buffer) openLogFile() {
	if b.logDir == "" {
		return
	}
	if err := os.MkdirAll(b.logDir, 0755); err != nil {
		fmt.Fprintf(os.Stderr, "logcat: mkdir %s: %v\n", b.logDir, err)
		return
	}
	path := filepath.Join(b.logDir, time.Now().Format("2006-01-02")+".log")
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_APPEND, 0644)
	if err != nil {
		fmt.Fprintf(os.Stderr, "logcat: open %s: %v\n", path, err)
		return
	}
	b.logFile = f
}

func (b *Buffer) rotateLogFile() {
	if b.logFile != nil {
		b.logFile.Close()
	}
	b.openLogFile()
}

// RotateLog checks whether the log file needs rotating (new day) and does so.
// Call it periodically or after midnight.
func (b *Buffer) RotateLog() {
	b.mu.Lock()
	defer b.mu.Unlock()
	path := filepath.Join(b.logDir, time.Now().Format("2006-01-02")+".log")
	if b.logFile != nil {
		currentName := filepath.Base(b.logFile.Name())
		if currentName == time.Now().Format("2006-01-02")+".log" {
			return
		}
		b.logFile.Close()
		b.logFile = nil
	}
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_APPEND, 0644)
	if err != nil {
		fmt.Fprintf(os.Stderr, "logcat: open %s: %v\n", path, err)
		return
	}
	b.logFile = f
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
	now := time.Now()
	b.mu.Lock()
	b.nextID++
	e := Entry{
		ID:        b.nextID,
		Timestamp: now.UnixMilli(),
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
	// Write to log file outside the lock
	f := b.logFile
	b.mu.Unlock()

	if f != nil {
		line := fmt.Sprintf("[%s] [%s] [%s] %s\n",
			now.Format("2006-01-02 15:04:05.000"),
			level.String(), source, msg)
		f.WriteString(line)
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
