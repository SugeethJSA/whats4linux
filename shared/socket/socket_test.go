package socket

import (
	"bufio"
	"context"
	"net"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func useTestSocketPath(t *testing.T) {
	t.Helper()
	original := UDSPath
	UDSPath = filepath.Join(t.TempDir(), "whats4linux.sock")
	t.Cleanup(func() { UDSPath = original })
}

// startTestServer starts a listener with a handler that replies "pong" to
// "ping" (avoids touching the wails runtime, which needs a real app context).
func startTestServer(t *testing.T) *UnixSocket {
	t.Helper()
	useTestSocketPath(t)
	s, err := NewUnixSocket(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	s.SetCommandHandler(func(cmd string) (string, bool) {
		if cmd == "ping" {
			return "pong", true
		}
		return "", false
	})
	done := make(chan error, 1)
	go func() { done <- s.ListenAndServe() }()
	t.Cleanup(func() {
		_ = s.Close()
		select {
		case <-done:
		case <-time.After(time.Second):
		}
	})

	deadline := time.Now().Add(time.Second)
	for {
		if _, err := os.Stat(UDSPath); err == nil {
			return s
		}
		if time.Now().After(deadline) {
			t.Fatal("socket listener did not start")
		}
		time.Sleep(time.Millisecond)
	}
}

func TestCloseStopsListenerAndRemovesSocket(t *testing.T) {
	useTestSocketPath(t)
	s, err := NewUnixSocket(context.Background())
	if err != nil {
		t.Fatal(err)
	}

	done := make(chan error, 1)
	go func() { done <- s.ListenAndServe() }()

	deadline := time.Now().Add(time.Second)
	for {
		if _, err := os.Stat(UDSPath); err == nil {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("socket listener did not start")
		}
		time.Sleep(time.Millisecond)
	}

	if err := s.Close(); err != nil {
		t.Fatal(err)
	}
	select {
	case err := <-done:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(time.Second):
		t.Fatal("socket listener did not stop")
	}
	if _, err := os.Stat(UDSPath); !os.IsNotExist(err) {
		t.Fatalf("socket path remains after close: %v", err)
	}
}

func TestCloseBeforeListenDoesNotLeaveSocket(t *testing.T) {
	useTestSocketPath(t)
	s, err := NewUnixSocket(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Close(); err != nil {
		t.Fatal(err)
	}
	if err := s.ListenAndServe(); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(UDSPath); !os.IsNotExist(err) {
		t.Fatalf("socket path remains after closed server attempted to listen: %v", err)
	}
}

// dialClient connects to the test socket and returns the client conn plus a
// channel that receives the first line the server sends back.
func dialClient(t *testing.T) (net.Conn, chan string) {
	t.Helper()
	c, err := net.Dial("unix", UDSPath)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = c.Close() })
	lines := make(chan string, 4)
	go func() {
		scanner := bufio.NewScanner(c)
		for scanner.Scan() {
			lines <- scanner.Text()
		}
		close(lines)
	}()
	return c, lines
}

// waitActive polls until the server has registered an active connection.
func waitActive(t *testing.T, s *UnixSocket) {
	t.Helper()
	deadline := time.Now().Add(time.Second)
	for {
		if s.currentConn() != nil {
			return
		}
		if time.Now().After(deadline) {
			t.Fatal("connection not registered as active")
		}
		time.Sleep(time.Millisecond)
	}
}

// The first connection becomes the active tray; a second concurrent
// connection must be refused with "already_running" and closed (the
// duplicate-instance guard) — and must not disturb the first connection.
func TestSecondConnectionRefusedWhileTrayActive(t *testing.T) {
	s := startTestServer(t)

	first, firstLines := dialClient(t)
	waitActive(t, s)

	second, secondLines := dialClient(t)
	select {
	case line := <-secondLines:
		if line != "already_running" {
			t.Fatalf("second connection got %q, want already_running", line)
		}
	case <-time.After(time.Second):
		t.Fatal("second connection was not answered")
	}
	_ = second

	// The first connection is unaffected: it can still send commands.
	if _, err := first.Write([]byte("ping\n")); err != nil {
		t.Fatal(err)
	}
	select {
	case line := <-firstLines:
		if line != "pong" {
			t.Fatalf("first connection got %q, want pong", line)
		}
	case <-time.After(time.Second):
		t.Fatal("first connection stopped answering after duplicate refused")
	}
	if s.currentConn() == nil {
		t.Fatal("first connection lost after duplicate refused")
	}
	// Second conn was closed by the server; its reader hits EOF.
	select {
	case _, ok := <-secondLines:
		if ok {
			t.Fatal("second connection still open after refusal")
		}
	case <-time.After(time.Second):
		t.Fatal("second connection not closed after refusal")
	}
}

// When the active tray disconnects, the slot must be freed so a new tray
// (reconnect after app restart) can take over.
func TestSlotFreedAfterTrayDisconnects(t *testing.T) {
	s := startTestServer(t)

	first, _ := dialClient(t)
	waitActive(t, s)
	_ = first.Close()

	deadline := time.Now().Add(time.Second)
	for {
		if s.currentConn() == nil {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("active slot not freed after disconnect")
		}
		time.Sleep(time.Millisecond)
	}

	second, secondLines := dialClient(t)
	if _, err := second.Write([]byte("ping\n")); err != nil {
		t.Fatal(err)
	}
	select {
	case line := <-secondLines:
		if line != "pong" {
			t.Fatalf("second connection got %q, want pong (accepted)", line)
		}
	case <-time.After(time.Second):
		t.Fatal("second connection was not answered after reconnect")
	}
	if s.currentConn() == nil {
		t.Fatal("second connection not registered after reconnect")
	}
}
