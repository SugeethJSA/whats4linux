package main

import (
	"bufio"
	"fmt"
	"net"
	"os"
	"sync"

	"github.com/getlantern/systray"
	"github.com/lugvitc/whats4linux/shared/socket"
)

var conn net.Conn
var mu sync.Mutex

// quitCh is closed when the systray should shut down, signalling all
// background goroutines to exit cleanly.
var quitCh = make(chan struct{})

// notifStateCh carries notification-switch states pushed by the main app so
// the checkbox can be updated once the menu is ready. Buffered so states
// received before the menu exists aren't lost.
var notifStateCh = make(chan bool, 8)

func connectSocket() error {
	c, err := net.Dial("unix", socket.UDSPath)
	if err != nil {
		return err
	}
	mu.Lock()
	conn = c
	mu.Unlock()
	return nil
}

func readCommands() error {
	for {
		scanner := bufio.NewScanner(conn)
		for scanner.Scan() {
			switch msg := scanner.Text(); msg {
			case "shutdown":
				fmt.Println("Received shutdown command from Whats4Linux, exiting systray.")
				systray.Quit()
				os.Exit(0)
			case "notifications_state:on":
				pushNotifState(true)
			case "notifications_state:off":
				pushNotifState(false)
			case "":
				// ignore empty keep-alive lines
			default:
				fmt.Println("Unknown command from Whats4Linux:", msg)
			}
		}
		if err := scanner.Err(); err != nil {
			fmt.Println("Error reading from Whats4Linux socket:", err)
			systray.Quit()
			os.Exit(0)
		}
		// EOF: the app closed the connection, try to reconnect.
		if err := connectSocket(); err != nil {
			return err
		}
		// Re-sync the checkbox after reconnecting.
		sendCommand("get_notifications_state")
	}
}

// pushNotifState queues a state for the checkbox without ever blocking the
// socket read loop: if the buffer is full (menu not ready yet), the oldest
// state is dropped so the latest always wins.
func pushNotifState(enabled bool) {
	for {
		select {
		case notifStateCh <- enabled:
			return
		default:
			select {
			case <-notifStateCh:
			default:
			}
		}
	}
}

func sendCommand(cmd string) {
	mu.Lock()
	defer mu.Unlock()
	if conn == nil {
		return
	}
	_, err := conn.Write([]byte(cmd + "\n"))
	if err != nil {
		fmt.Println("Error sending command to Whats4Linux:", err)
		systray.Quit()
		os.Exit(0)
	}
}

func main() {
	go func() {
		if err := connectSocket(); err != nil {
			fmt.Println("Whats4Linux not running, exiting systray.")
			os.Exit(0)
			return
		}
		sendCommand("get_notifications_state")
		done := make(chan struct{})
		go func() {
			if err := readCommands(); err != nil {
				fmt.Println("Error reading commands from Whats4Linux:", err)
			}
			close(done)
		}()
		select {
		case <-done:
		case <-quitCh:
		}
		os.Exit(0)
	}()
	systray.Run(func() {
		systray.SetTemplateIcon(icon, icon)
		systray.SetTitle("Whats4Linux")
		systray.SetTooltip("Lantern")
		mQuitOrig := systray.AddMenuItem("Quit", "Quit the whole app")
		go func() {
			select {
			case <-mQuitOrig.ClickedCh:
				fmt.Println("Requesting quit")
				sendCommand("quit")
			case <-quitCh:
				return
			}
			systray.Quit()
			fmt.Println("Finished quitting")
		}()
		var mShow, mHide *systray.MenuItem
		mShow = systray.AddMenuItem("Open", "Open whats4linux window")
		mShow.Hide()
		mHide = systray.AddMenuItem("Hide", "Hide whats4linux window")
		go func() {
			for {
				select {
				case <-mHide.ClickedCh:
					mShow.Show()
					mHide.Hide()
					sendCommand("hide")
				case <-quitCh:
					return
				}
			}
		}()
		go func() {
			for {
				select {
				case <-mShow.ClickedCh:
					mHide.Show()
					mShow.Hide()
					sendCommand("show")
				case <-quitCh:
					return
				}
			}
		}()
		mNotifs := systray.AddMenuItemCheckbox("Notifications", "Enable or disable desktop notifications", true)
		go func() {
			for {
				select {
				case <-mNotifs.ClickedCh:
					sendCommand("toggle_notifications")
				case <-quitCh:
					return
				}
			}
		}()
		go func() {
			for enabled := range notifStateCh {
				select {
				case <-quitCh:
					return
				default:
				}
				if enabled {
					mNotifs.Check()
				} else {
					mNotifs.Uncheck()
				}
			}
		}()
	}, func() {
		sendCommand("shutdown")
		close(quitCh)
	})
}
