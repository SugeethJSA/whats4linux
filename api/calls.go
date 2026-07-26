package api

import (
	"fmt"
	"log"

	"github.com/purpshell/meowcaller"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

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
