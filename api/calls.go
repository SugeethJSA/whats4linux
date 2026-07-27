package api

import (
	"context"
	"fmt"
	"log"

	"github.com/purpshell/meowcaller"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// CallStats holds diagnostic info about an active call for the frontend stats panel.
type CallStats struct {
	CallID          string `json:"call_id"`
	PeerJID         string `json:"peer_jid"`
	State           string `json:"state"`
	IsVideo         bool   `json:"is_video"`
	IsSendingVideo  bool   `json:"is_sending_video"`
	IsReceivingVideo bool  `json:"is_receiving_video"`
	Codec           string `json:"codec"`            // "MLow" (WhatsApp default)
	SampleRate      int    `json:"sample_rate"`      // 16000
	FrameSize       int    `json:"frame_size"`       // 960 samples (60ms)
	RelayEnabled    bool   `json:"relay_enabled"`    // always true for WhatsApp calls
	BridgeActive    bool   `json:"bridge_active"`    // audio bridge live
	Duration        int64  `json:"duration"`         // call duration in seconds (0 while ringing)
}

type ActiveCall struct {
	Call   *meowcaller.Call
	Bridge *LiveAudioBridge
}

// Global active calls map
var activeCalls = make(map[string]*ActiveCall)

// initMeowcaller initializes the WhatsApp VoIP extension library
func (a *Api) initMeowcaller() {
	if a.waClient == nil {
		log.Println("[Calls] WhatsApp client not initialized, skipping meowcaller")
		return
	}
	
	a.callClient = meowcaller.NewClient(a.waClient)

	// Handle incoming calls
	a.callClient.OnIncomingCall(func(call *meowcaller.Call) {
		log.Printf("[Calls] Incoming call from %s (CallID: %s)", call.Peer().String(), call.ID())
		activeCalls[call.ID()] = &ActiveCall{Call: call}

		// Emit event to frontend
		if a.ctx != nil {
			runtime.EventsEmit(a.ctx, "call:incoming", map[string]interface{}{
				"callID":  call.ID(),
				"peerJID": call.Peer().String(),
				"isVideo": call.IsVideo(),
			})
		}
		
		// Handle call termination directly on the call object
		call.OnEnd(func(reason string) {
			log.Printf("[Calls] Call %s ended: %s", call.ID(), reason)
			delete(activeCalls, call.ID())
	
			if a.ctx != nil {
				runtime.EventsEmit(a.ctx, "call:ended", map[string]interface{}{
					"callID": call.ID(),
					"reason": reason,
				})
			}
		})
	})
}

// AcceptCall accepts an incoming call by ID
func (a *Api) AcceptCall(callID string) error {
	callData, ok := activeCalls[callID]
	if !ok {
		return fmt.Errorf("call %s not found", callID)
	}

	callData.Call.Answer()

	// For Phase 2: Attach Live OS Audio Bridge
	bridge, err := NewLiveAudioBridge()
	if err != nil {
		log.Printf("[Calls] Failed to initialize live audio bridge: %v", err)
		return fmt.Errorf("audio bridge init failed: %v", err)
	}
	
	if err := bridge.Start(); err != nil {
		log.Printf("[Calls] Failed to start audio bridge: %v", err)
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

	log.Printf("[Calls] Outbound call placed to %s (CallID: %s)", targetJID, call.ID())
	activeCalls[call.ID()] = &ActiveCall{Call: call}

	// Initialize Audio Bridge immediately for outgoing call
	bridge, err := NewLiveAudioBridge()
	if err != nil {
		log.Printf("[Calls] Failed to initialize live audio bridge for outbound call: %v", err)
	} else {
		if err := bridge.Start(); err == nil {
			activeCalls[call.ID()].Bridge = bridge
			call.Play(bridge)
			call.Receive(bridge)
		}
	}

	call.OnPeerAccept(func() {
		log.Printf("[Calls] Outbound call %s accepted by peer", call.ID())
		if a.ctx != nil {
			runtime.EventsEmit(a.ctx, "call:accepted", map[string]interface{}{
				"callID": call.ID(),
			})
		}
	})

	call.OnEnd(func(reason string) {
		log.Printf("[Calls] Outbound call %s ended: %s", call.ID(), reason)
		if activeCalls[call.ID()] != nil && activeCalls[call.ID()].Bridge != nil {
			activeCalls[call.ID()].Bridge.Close()
		}
		delete(activeCalls, call.ID())
		if a.ctx != nil {
			runtime.EventsEmit(a.ctx, "call:ended", map[string]interface{}{
				"callID": call.ID(),
				"reason": reason,
			})
		}
	})

	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "call:outgoing", map[string]interface{}{
			"callID":  call.ID(),
			"peerJID": targetJID,
			"isVideo": false,
		})
	}

	return nil
}

// RejectCall rejects an incoming call
func (a *Api) RejectCall(callID string) error {
	callData, ok := activeCalls[callID]
	if !ok {
		return fmt.Errorf("call %s not found", callID)
	}
	if callData.Bridge != nil {
		callData.Bridge.Close()
	}
	callData.Call.Reject()
	delete(activeCalls, callID)
	return nil
}

// GetCallStats returns diagnostic information about an active call.
func (a *Api) GetCallStats(callID string) (*CallStats, error) {
	callData, ok := activeCalls[callID]
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
	}, nil
}

// EndCall terminates an active call
func (a *Api) EndCall(callID string) error {
	callData, ok := activeCalls[callID]
	if !ok {
		return fmt.Errorf("call %s not found", callID)
	}
	if callData.Bridge != nil {
		callData.Bridge.Close()
	}
	callData.Call.Hangup()
	delete(activeCalls, callID)
	return nil
}
