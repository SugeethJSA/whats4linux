package api

import (
	"fmt"
	"log"

	"github.com/purpshell/meowcaller"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type ActiveCall struct {
	Call *meowcaller.Call
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

	// For Phase 1: Play a test audio file to the caller
	// Meowcaller has MP3File source included. We'll play a dummy beep/file if it exists.
	// In production, this would be bound to malgo/portaudio for mic access.
	mp3, err := meowcaller.MP3File("beep.mp3")
	if err == nil {
		callData.Call.Play(mp3)
	} else {
		log.Printf("[Calls] Could not load beep.mp3: %v", err)
	}

	// Record caller's audio to a wav file
	wav, err := meowcaller.WAVRecorder(fmt.Sprintf("%s.wav", callID))
	if err == nil {
		callData.Call.Receive(wav)
	} else {
		log.Printf("[Calls] Could not initialize WAV recorder: %v", err)
	}

	return nil
}

// RejectCall rejects an incoming call
func (a *Api) RejectCall(callID string) error {
	callData, ok := activeCalls[callID]
	if !ok {
		return fmt.Errorf("call %s not found", callID)
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
	callData.Call.Hangup()
	delete(activeCalls, callID)
	return nil
}
