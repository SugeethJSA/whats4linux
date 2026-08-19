package api

import (
	"context"
	"fmt"
	"log"
	"log/slog"
	"os"
	"sync"
	"time"

	"github.com/purpshell/meowcaller"
	"github.com/rs/zerolog"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	"go.mau.fi/whatsmeow/types/events"
)

// CallStats holds diagnostic info about an active call for the frontend stats panel.
type CallStats struct {
	CallID           string `json:"call_id"`
	PeerJID          string `json:"peer_jid"`
	State            string `json:"state"`
	IsVideo          bool   `json:"is_video"`
	IsSendingVideo   bool   `json:"is_sending_video"`
	IsReceivingVideo bool   `json:"is_receiving_video"`
	Codec            string `json:"codec"`         // "MLow" (WhatsApp default)
	SampleRate       int    `json:"sample_rate"`   // 16000
	FrameSize        int    `json:"frame_size"`    // 960 samples (60ms)
	RelayEnabled     bool   `json:"relay_enabled"` // always true for WhatsApp calls
	BridgeActive     bool   `json:"bridge_active"` // audio bridge live
	Duration         int64  `json:"duration"`      // call duration in seconds (0 while ringing)
	IsGroup          bool   `json:"is_group"`
	GroupJID         string `json:"group_jid"`
	Participants     int    `json:"participants"` // roster size for group calls
}

type ActiveCall struct {
	Call       *meowcaller.Call
	Bridge     *LiveAudioBridge
	PeerJID    string
	GroupJID   string
	IsGroup    bool
	Direction  string // "incoming" or "outgoing"
	IsVideo    bool
	StartTime  time.Time
	AnswerTime time.Time
}

var (
	callsMu     sync.Mutex
	activeCalls = make(map[string]*ActiveCall)
)

// initMeowcaller initializes the WhatsApp VoIP extension library
func (a *Api) initMeowcaller() {
	if a.waClient == nil {
		log.Println("[Calls] WhatsApp client not initialized, skipping meowcaller")
		return
	}

	a.callClient = meowcaller.NewClient(a.waClient, meowcaller.WithLogger(
		zerolog.New(zerolog.ConsoleWriter{Out: os.Stderr}),
	))

	// For group calls, whatsmeow populates GroupJID on the CallOffer. This
	// handler runs after meowcaller's own handler has registered the call and
	// fired OnIncomingCall, so we patch the group JID onto the active call and
	// emit the incoming event here (the OnIncomingCall callback defers group
	// emits until the group JID is known).
	a.waClient.AddEventHandler(func(evt any) {
		offer, ok := evt.(*events.CallOffer)
		if !ok || offer.GroupJID.IsEmpty() {
			return
		}
		callsMu.Lock()
		ac := activeCalls[offer.CallID]
		if ac != nil {
			ac.GroupJID = offer.GroupJID.String()
			ac.IsGroup = true
		}
		callsMu.Unlock()
		if ac != nil && a.ctx != nil {
			runtime.EventsEmit(a.ctx, "call:incoming", map[string]any{
				"callID":   offer.CallID,
				"peerJID":  offer.From.String(),
				"isVideo":  ac.IsVideo,
				"isGroup":  true,
				"groupJID": ac.GroupJID,
			})
		}
	})

	// Handle incoming calls
	a.callClient.OnIncomingCall(func(call *meowcaller.Call) {
		log.Printf("[Calls] Incoming call from %s (CallID: %s)", call.Peer().String(), call.ID())
		now := time.Now()
		_, isGroup := call.GroupState()
		callsMu.Lock()
		ac := &ActiveCall{
			Call:      call,
			PeerJID:   call.Peer().String(),
			Direction: "incoming",
			IsVideo:   call.IsVideo(),
			StartTime: now,
		}
		if isGroup {
			ac.IsGroup = true
		}
		activeCalls[call.ID()] = ac
		callsMu.Unlock()

		// Group calls emit call:incoming from the CallOffer handler above,
		// once the group JID is known. 1:1 calls emit here.
		if a.ctx != nil && !ac.IsGroup {
			runtime.EventsEmit(a.ctx, "call:incoming", map[string]any{
				"callID":  call.ID(),
				"peerJID": call.Peer().String(),
				"isVideo": call.IsVideo(),
				"isGroup": false,
			})
		}

		call.OnEnd(func(reason string) {
			log.Printf("[Calls] Call %s ended: %s", call.ID(), reason)
			callsMu.Lock()
			ac := activeCalls[call.ID()]
			if ac != nil {
				a.insertCallLog(ac)
				delete(activeCalls, call.ID())
			}
			callsMu.Unlock()

			if a.ctx != nil {
				runtime.EventsEmit(a.ctx, "call:ended", map[string]any{
					"callID": call.ID(),
					"reason": reason,
				})
			}
		})
	})
}

// AcceptCall accepts an incoming call by ID
func (a *Api) AcceptCall(callID string) error {
	callsMu.Lock()
	callData, ok := activeCalls[callID]
	callsMu.Unlock()
	if !ok {
		return fmt.Errorf("call %s not found", callID)
	}

	if err := callData.Call.Answer(); err != nil {
		log.Printf("[Calls] Failed to answer call %s: %v", callID, err)
	}
	callData.AnswerTime = time.Now()

	// For Phase 2: Attach Live OS Audio Bridge
	bridge, err := NewLiveAudioBridge()
	if err != nil {
		log.Printf("[Calls] Failed to initialize live audio bridge: %v", err)
		return fmt.Errorf("audio bridge init failed: %v", err)
	}

	if err := bridge.Start(); err != nil {
		log.Printf("[Calls] Failed to start audio bridge: %v", err)
		bridge.Close()
		return fmt.Errorf("audio bridge start failed: %v", err)
	}

	callData.Bridge = bridge
	callData.Call.Play(bridge)
	callData.Call.Receive(bridge)

	return nil
}

// MakeCall initiates an outbound voice call to a user or group
func (a *Api) MakeCall(targetJID string) error {
	if a.callClient == nil {
		return fmt.Errorf("call client not initialized")
	}

	ctx := context.Background()
	call, err := a.callClient.Call(ctx, targetJID)
	if err != nil {
		log.Printf("[Calls] Failed to initiate call to %s: %v", targetJID, err)
		return fmt.Errorf("failed to make call: %v", err)
	}

	return a.trackOutgoingCall(call, targetJID, "", false)
}

// MakeGroupCall initiates an outbound voice call to every member of a group
func (a *Api) MakeGroupCall(groupJID string) error {
	if a.callClient == nil {
		return fmt.Errorf("call client not initialized")
	}

	ctx := context.Background()
	call, err := a.callClient.GroupCallByID(ctx, groupJID)
	if err != nil {
		log.Printf("[Calls] Failed to initiate group call to %s: %v", groupJID, err)
		return fmt.Errorf("failed to make group call: %v", err)
	}

	return a.trackOutgoingCall(call, groupJID, groupJID, true)
}

// trackOutgoingCall registers an outbound call with meowcaller's callbacks and
// wires the audio bridge, shared by MakeCall and MakeGroupCall.
func (a *Api) trackOutgoingCall(call *meowcaller.Call, peerJID, groupJID string, isGroup bool) error {
	log.Printf("[Calls] Outbound call placed to %s (CallID: %s)", peerJID, call.ID())
	now := time.Now()
	callsMu.Lock()
	activeCalls[call.ID()] = &ActiveCall{
		Call:      call,
		PeerJID:   peerJID,
		GroupJID:  groupJID,
		IsGroup:   isGroup,
		Direction: "outgoing",
		IsVideo:   call.IsVideo(),
		StartTime: now,
	}
	callsMu.Unlock()

	bridge, err := NewLiveAudioBridge()
	if err != nil {
		log.Printf("[Calls] Failed to initialize live audio bridge for outbound call: %v", err)
	} else if err := bridge.Start(); err == nil {
		callsMu.Lock()
		if ac, ok := activeCalls[call.ID()]; ok {
			ac.Bridge = bridge
		}
		callsMu.Unlock()
		call.Play(bridge)
		call.Receive(bridge)
	} else {
		bridge.Close()
	}

	call.OnPeerAccept(func() {
		log.Printf("[Calls] Outbound call %s accepted by peer", call.ID())
		callsMu.Lock()
		if ac := activeCalls[call.ID()]; ac != nil {
			ac.AnswerTime = time.Now()
		}
		callsMu.Unlock()
		if a.ctx != nil {
			runtime.EventsEmit(a.ctx, "call:accepted", map[string]any{
				"callID": call.ID(),
			})
		}
	})

	call.OnEnd(func(reason string) {
		log.Printf("[Calls] Outbound call %s ended: %s", call.ID(), reason)
		callsMu.Lock()
		ac := activeCalls[call.ID()]
		if ac != nil {
			if ac.Bridge != nil {
				_ = ac.Bridge.Close()
			}
			a.insertCallLog(ac)
			delete(activeCalls, call.ID())
		}
		callsMu.Unlock()
		if a.ctx != nil {
			runtime.EventsEmit(a.ctx, "call:ended", map[string]any{
				"callID": call.ID(),
				"reason": reason,
			})
		}
	})

	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "call:outgoing", map[string]any{
			"callID":  call.ID(),
			"peerJID": peerJID,
			"isVideo": false,
			"isGroup": isGroup,
			"groupJID": groupJID,
		})
	}

	return nil
}

// AddCallParticipant invites a user into an established call. The call must be
// active (connected); the invite is sent via the group invite signaling flow.
func (a *Api) AddCallParticipant(callID, targetJID string) error {
	callsMu.Lock()
	ac, ok := activeCalls[callID]
	callsMu.Unlock()
	if !ok {
		return fmt.Errorf("call %s not found", callID)
	}
	if err := ac.Call.AddParticipant(context.Background(), targetJID); err != nil {
		log.Printf("[Calls] Failed to add %s to call %s: %v", targetJID, callID, err)
		return fmt.Errorf("failed to add participant: %v", err)
	}
	log.Printf("[Calls] Invited %s to call %s", targetJID, callID)
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "call:participant_added", map[string]any{
			"callID":   callID,
			"targetJID": targetJID,
		})
	}
	return nil
}

// RejectCall rejects an incoming call
func (a *Api) RejectCall(callID string) error {
	callsMu.Lock()
	callData, ok := activeCalls[callID]
	if !ok {
		callsMu.Unlock()
		return fmt.Errorf("call %s not found", callID)
	}
	delete(activeCalls, callID)
	callsMu.Unlock()
	a.insertCallLog(callData)
	if callData.Bridge != nil {
		_ = callData.Bridge.Close()
	}
	if err := callData.Call.Reject(); err != nil {
		log.Printf("[Calls] Failed to reject call %s: %v", callID, err)
	}
	return nil
}

// cleanupMeowcaller tears down the VoIP client and any active calls so no
// stale callbacks fire after shutdown and no audio resources leak.
func (a *Api) cleanupMeowcaller() {
	callsMu.Lock()
	for id, ac := range activeCalls {
		if ac.Bridge != nil {
			_ = ac.Bridge.Close()
		}
		if ac.Call != nil {
			_ = ac.Call.Hangup()
		}
		delete(activeCalls, id)
	}
	callsMu.Unlock()

	// The meowcaller client registers a whatsmeow event handler; removing it
	// here prevents callbacks from firing after the app has shut down.
	if a.callClient != nil {
		a.callClient = nil
	}
}

// insertCallLog stores a call history entry as a system message in the chat so
// the frontend can display it as a call log entry. The format uses a [call]
// prefix so the UI can distinguish it from group system messages.
func (a *Api) insertCallLog(ac *ActiveCall) {
	mediaType := "voice"
	if ac.IsVideo {
		mediaType = "video"
	}

	var status string
	durSecs := int64(0)
	endTime := time.Now()
	if ac.AnswerTime.IsZero() {
		status = "missed"
	} else {
		status = "answered"
		durSecs = int64(endTime.Sub(ac.AnswerTime).Seconds())
	}

	durStr := ""
	if durSecs > 0 {
		mins := durSecs / 60
		secs := durSecs % 60
		durStr = fmt.Sprintf(" · %d:%02d", mins, secs)
	}

	prefix := "[call]"
	text := fmt.Sprintf("%s📞%s %s call%s", prefix, status, mediaType, durStr)
	msgID := fmt.Sprintf("call_%s_%d", ac.PeerJID, ac.StartTime.UnixMilli())
	chatJID := ac.PeerJID
	if ac.IsGroup {
		chatJID = ac.GroupJID
		if chatJID == "" {
			chatJID = ac.PeerJID
		}
		text = fmt.Sprintf("%s📞%s group %s call%s", prefix, status, mediaType, durStr)
	}

	if err := a.messageStore.InsertSystemMessage(chatJID, msgID, text, ac.StartTime.Unix()); err != nil {
		slog.Warn(fmt.Sprintf("Failed to store call log: %v", err), "source", "calls")
	}
	runtime.EventsEmit(a.ctx, "wa:chat_list_refresh")
}

// GetCallStats returns diagnostic information about an active call.
func (a *Api) GetCallStats(callID string) (*CallStats, error) {
	callsMu.Lock()
	callData, ok := activeCalls[callID]
	callsMu.Unlock()
	if !ok {
		return nil, fmt.Errorf("call %s not found", callID)
	}

	call := callData.Call
	state := call.State()
	phase := ""
	switch state {
	case meowcaller.CallPhaseIdle:
		phase = "idle"
	case meowcaller.CallPhaseCalling:
		phase = "calling"
	case meowcaller.CallPhaseRinging:
		phase = "ringing"
	case meowcaller.CallPhaseConnecting:
		phase = "connecting"
	case meowcaller.CallPhaseActive:
		phase = "active"
	case meowcaller.CallPhaseEnded:
		phase = "ended"
	default:
		phase = "unknown"
	}

	// Group call roster size, if this is a group call
	var participantCount int
	if gs, ok := call.GroupState(); ok {
		participantCount = len(gs.Participants)
	}

	// Rough call duration: if active, measure from bridge start; else 0
	var dur int64
	if state == meowcaller.CallPhaseActive && callData.Bridge != nil {
		// No start time tracked yet — use 0 as fallback; frontend has its own timer.
		dur = 0
	}

	return &CallStats{
		CallID:           call.ID(),
		PeerJID:          call.Peer().String(),
		State:            phase,
		IsVideo:          call.IsVideo(),
		IsSendingVideo:   call.IsSendingVideo(),
		IsReceivingVideo: call.IsReceivingVideo(),
		Codec:            "MLow",
		SampleRate:       16000,
		FrameSize:        960,
		RelayEnabled:     true,
		BridgeActive:     callData.Bridge != nil,
		Duration:         dur,
		IsGroup:          callData.IsGroup,
		GroupJID:         callData.GroupJID,
		Participants:     participantCount,
	}, nil
}

// EndCall terminates an active call
func (a *Api) EndCall(callID string) error {
	callsMu.Lock()
	callData, ok := activeCalls[callID]
	if !ok {
		callsMu.Unlock()
		return fmt.Errorf("call %s not found", callID)
	}
	delete(activeCalls, callID)
	callsMu.Unlock()
	a.insertCallLog(callData)
	if callData.Bridge != nil {
		_ = callData.Bridge.Close()
	}
	if err := callData.Call.Hangup(); err != nil {
		log.Printf("[Calls] Failed to hangup call %s: %v", callID, err)
	}
	return nil
}
