package api

import (
	"fmt"
	"sync"
	"unsafe"

	"github.com/gen2brain/malgo"
)

const (
	sampleRate   = 16000
	channels     = 1
	frameSamples = 320 // WhatsApp MLOW expects 20ms chunks at 16kHz
)

type LiveAudioBridge struct {
	malgoCtx *malgo.AllocatedContext
	device   *malgo.Device

	captureBuf  []float32
	captureMu   sync.Mutex
	captureCond *sync.Cond

	playbackBuf []float32
	playbackMu  sync.Mutex

	isClosed bool
}

// NewLiveAudioBridge initializes a duplex malgo hardware device at 16kHz Mono.
func NewLiveAudioBridge() (*LiveAudioBridge, error) {
	bridge := &LiveAudioBridge{
		captureBuf:  make([]float32, 0, frameSamples*10),
		playbackBuf: make([]float32, 0, frameSamples*10),
	}
	bridge.captureCond = sync.NewCond(&bridge.captureMu)

	// Initialize Malgo Context
	malgoCtx, err := malgo.InitContext(nil, malgo.ContextConfig{}, func(msg string) {
		// Uncomment for deep audio debugging: log.Printf("[malgo] %v", msg)
	})
	if err != nil {
		return nil, fmt.Errorf("failed to init malgo context: %w", err)
	}
	bridge.malgoCtx = malgoCtx

	deviceConfig := malgo.DefaultDeviceConfig(malgo.Duplex)
	deviceConfig.Capture.Format = malgo.FormatF32
	deviceConfig.Capture.Channels = channels
	deviceConfig.Playback.Format = malgo.FormatF32
	deviceConfig.Playback.Channels = channels
	deviceConfig.SampleRate = sampleRate

	onRecvFrames := func(pOutputSample, pInputSamples []byte, framecount uint32) {
		// --- CAPTURE (Mic -> captureBuf) ---
		if pInputSamples != nil {
			floatCount := len(pInputSamples) / 4
			rawSamples := unsafe.Slice((*float32)(unsafe.Pointer(&pInputSamples[0])), floatCount)
			
			actualChannels := floatCount / int(framecount)
			if actualChannels == 0 {
				actualChannels = 1
			}

			// Downmix to Mono if OS fed us Stereo/Multichannel
			mono := make([]float32, framecount)
			for i := 0; i < int(framecount); i++ {
				var sum float32
				for c := 0; c < actualChannels; c++ {
					sum += rawSamples[i*actualChannels+c]
				}
				mono[i] = sum / float32(actualChannels)
			}

			bridge.captureMu.Lock()
			bridge.captureBuf = append(bridge.captureBuf, mono...)
			bridge.captureCond.Signal()
			bridge.captureMu.Unlock()
		}

		// --- PLAYBACK (playbackBuf -> Speaker) ---
		if pOutputSample != nil {
			floatCount := len(pOutputSample) / 4
			outSamples := unsafe.Slice((*float32)(unsafe.Pointer(&pOutputSample[0])), floatCount)
			
			actualChannels := floatCount / int(framecount)
			if actualChannels == 0 {
				actualChannels = 1
			}

			bridge.playbackMu.Lock()
			availableFrames := len(bridge.playbackBuf)
			neededFrames := int(framecount)

			var monoFrames []float32
			if availableFrames >= neededFrames {
				monoFrames = bridge.playbackBuf[:neededFrames]
				bridge.playbackBuf = bridge.playbackBuf[neededFrames:]
			} else {
				monoFrames = make([]float32, neededFrames)
				copy(monoFrames, bridge.playbackBuf)
				bridge.playbackBuf = bridge.playbackBuf[:0]
			}
			bridge.playbackMu.Unlock()

			// Upmix Mono to whatever the OS Speaker expects (Stereo etc)
			for i := 0; i < neededFrames; i++ {
				for c := 0; c < actualChannels; c++ {
					outSamples[i*actualChannels+c] = monoFrames[i]
				}
			}
		}
	}

	callbacks := malgo.DeviceCallbacks{
		Data: onRecvFrames,
	}

	device, err := malgo.InitDevice(malgoCtx.Context, deviceConfig, callbacks)
	if err != nil {
		malgoCtx.Free()
		return nil, fmt.Errorf("failed to init malgo device: %w", err)
	}
	bridge.device = device

	return bridge, nil
}

func (b *LiveAudioBridge) Start() error {
	return b.device.Start()
}

// ---------------------------------------------------------
// meowcaller.AudioSource Implementation
// ---------------------------------------------------------

// ReadFrame is called by meowcaller to grab exactly 320 samples to send to WhatsApp.
func (b *LiveAudioBridge) ReadFrame() ([]float32, error) {
	b.captureMu.Lock()
	defer b.captureMu.Unlock()

	if b.isClosed {
		return nil, fmt.Errorf("audio bridge closed")
	}

	frame := make([]float32, frameSamples)
	if len(b.captureBuf) >= frameSamples {
		copy(frame, b.captureBuf[:frameSamples])
		b.captureBuf = b.captureBuf[frameSamples:]
	} // else: return the silent frame (0s) to keep the connection alive

	// Prevent buffer bloat if OS mic is faster than WhatsApp network pacing
	if len(b.captureBuf) > frameSamples*50 {
		b.captureBuf = b.captureBuf[len(b.captureBuf)-frameSamples*10:]
	}

	return frame, nil
}

// ---------------------------------------------------------
// meowcaller.AudioSink Implementation
// ---------------------------------------------------------

// WriteFrame is called by meowcaller with 320 decrypted samples from WhatsApp.
func (b *LiveAudioBridge) WriteFrame(frame []float32) error {
	b.playbackMu.Lock()
	defer b.playbackMu.Unlock()

	if b.isClosed {
		return fmt.Errorf("audio bridge closed")
	}

	b.playbackBuf = append(b.playbackBuf, frame...)
	
	// Prevent buffer bloat if OS speaker isn't consuming fast enough
	if len(b.playbackBuf) > frameSamples*50 { 
		// Drop oldest frames
		b.playbackBuf = b.playbackBuf[frameSamples*10:]
	}

	return nil
}

// Close gracefully releases OS audio hardware
func (b *LiveAudioBridge) Close() error {
	b.captureMu.Lock()
	if b.isClosed {
		b.captureMu.Unlock()
		return nil
	}
	b.isClosed = true
	b.captureCond.Broadcast() // Wake up any pending ReadFrame calls
	b.captureMu.Unlock()

	if b.device != nil {
		b.device.Uninit()
	}
	if b.malgoCtx != nil {
		b.malgoCtx.Free()
	}
	return nil
}
