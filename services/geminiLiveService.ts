import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from "@google/genai";
import { CharacterAction, CharacterState } from "../types";

// Helper to convert Blob to Base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
      resolve(base64data.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const updateCharacterFunction: FunctionDeclaration = {
  name: 'updateCharacter',
  parameters: {
    type: Type.OBJECT,
    description: 'Updates the character pose and action based on user input.',
    properties: {
      action: {
        type: Type.STRING,
        enum: Object.values(CharacterAction),
        description: 'Discrete action like JUMP or DANCE. Default IDLE.',
      },
      headTilt: {
        type: Type.NUMBER,
        description: 'Angle of head tilt in degrees. -45 (left tilt) to 45 (right tilt). 0 is straight.',
      },
      leftArmAngle: {
        type: Type.NUMBER,
        description: 'Angle of the character\'s left arm (viewer\'s left). 0 is down/side, 90 is horizontal, 180 is straight up.',
      },
      rightArmAngle: {
        type: Type.NUMBER,
        description: 'Angle of the character\'s right arm (viewer\'s right). 0 is down/side, 90 is horizontal, 180 is straight up.',
      }
    },
    required: ['action', 'headTilt', 'leftArmAngle', 'rightArmAngle'],
  },
};

export class GeminiLiveService {
  private ai: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private cleanup: (() => void) | null = null;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  public async connect(
    onStateUpdate: (state: CharacterState) => void,
    onLog: (msg: string) => void,
    onClose: () => void
  ) {
    // Audio Contexts for microphone input and model output
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const inputAudioContext = new AudioContextClass({ sampleRate: 16000 });
    const outputAudioContext = new AudioContextClass({ sampleRate: 24000 });
    
    // Resume contexts if suspended (browser policy)
    if (inputAudioContext.state === 'suspended') await inputAudioContext.resume();
    if (outputAudioContext.state === 'suspended') await outputAudioContext.resume();

    const outputNode = outputAudioContext.createGain();
    outputNode.connect(outputAudioContext.destination);
    
    let nextStartTime = 0;
    const sources = new Set<AudioBufferSourceNode>();

    // Helper to decode audio
    const decodeAudioData = async (data: Uint8Array) => {
      const dataInt16 = new Int16Array(data.buffer);
      const frameCount = dataInt16.length; // Mono
      const buffer = outputAudioContext.createBuffer(1, frameCount, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
      }
      return buffer;
    };

    // Helper to decode base64 string
    const decodeBase64 = (base64: string) => {
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    };

    // Helper to encode PCM for input
    const encodePCM = (bytes: Uint8Array) => {
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    };

    // Helper to create PCM Blob
    const createPCMBlob = (data: Float32Array) => {
      const l = data.length;
      const int16 = new Int16Array(l);
      for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
      }
      return {
        data: encodePCM(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
      };
    };

    // Get Microphone Stream
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = inputAudioContext.createMediaStreamSource(stream);
    const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);

    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
      const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
      const pcmBlob = createPCMBlob(inputData);
      
      if (this.sessionPromise) {
        this.sessionPromise.then((session) => {
          session.sendRealtimeInput({ media: pcmBlob });
        });
      }
    };

    source.connect(scriptProcessor);
    scriptProcessor.connect(inputAudioContext.destination);

    // Establish Connection
    this.sessionPromise = this.ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: () => {
          onLog("Connected to Gemini Live");
        },
        onmessage: async (message: LiveServerMessage) => {
          // Handle Tool Calls (The core gesture logic)
          if (message.toolCall) {
            for (const fc of message.toolCall.functionCalls) {
              if (fc.name === 'updateCharacter') {
                const args = fc.args as any;
                const newState: CharacterState = {
                  action: args.action || CharacterAction.IDLE,
                  headTilt: args.headTilt || 0,
                  leftArmAngle: args.leftArmAngle || 0,
                  rightArmAngle: args.rightArmAngle || 0,
                };
                
                onStateUpdate(newState);
                
                // Respond to the tool call
                this.sessionPromise?.then((session) => {
                  session.sendToolResponse({
                    functionResponses: {
                      id: fc.id,
                      name: fc.name,
                      response: { result: "ok" },
                    }
                  });
                });
              }
            }
          }

          // Handle Model Audio Output (if the model speaks back)
          const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (base64Audio) {
            nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
            const audioBuffer = await decodeAudioData(decodeBase64(base64Audio));
            const source = outputAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputNode);
            source.addEventListener('ended', () => sources.delete(source));
            source.start(nextStartTime);
            nextStartTime += audioBuffer.duration;
            sources.add(source);
          }
        },
        onclose: () => {
          onLog("Connection closed");
          onClose();
        },
        onerror: (err) => {
          onLog(`Error: ${err}`);
        }
      },
      config: {
        responseModalities: [Modality.AUDIO],
        tools: [{ functionDeclarations: [updateCharacterFunction] }],
        systemInstruction: `
          You are a high-performance Motion Capture Engine.
          
          INPUT: Video Stream + Audio.
          OUTPUT: Call 'updateCharacter' function.
          
          TASK:
          Continuously analyze the user's pose in the video and MIRROR it to the character.
          
          MIRRORING RULES (Visual):
          1. HEAD TILT:
             - User tilts head Left on screen -> Output negative headTilt (-30).
             - User tilts head Right on screen -> Output positive headTilt (30).
          
          2. ARMS (Mirror Mode):
             - User raises hand on the LEFT side of the screen -> Increase 'leftArmAngle' (0 to 180).
             - User raises hand on the RIGHT side of the screen -> Increase 'rightArmAngle' (0 to 180).
             - 0 is arm down, 90 is horizontal, 180 is up.
          
          3. ACTIONS:
             - Detect "Jump", "Crouch", "Dance", or "Wiggle Ears" gestures.
             - Default to "IDLE" if standing still.
          
          CRITICAL:
          - You MUST call 'updateCharacter' for EVERY change in pose you detect.
          - Be extremely responsive. Do not wait for the user to speak.
          - If the user is silent, just act as a mirror.
        `,
      }
    });

    this.cleanup = () => {
      stream.getTracks().forEach(track => track.stop());
      scriptProcessor.disconnect();
      source.disconnect();
      inputAudioContext.close();
      outputAudioContext.close();
      sources.forEach(s => s.stop());
      this.sessionPromise = null;
    };
  }

  public sendFrame(base64Image: string) {
    if (this.sessionPromise) {
      this.sessionPromise.then((session) => {
        session.sendRealtimeInput({
          media: {
            mimeType: 'image/jpeg',
            data: base64Image
          }
        });
      });
    }
  }

  public disconnect() {
    if (this.cleanup) {
      this.cleanup();
      this.cleanup = null;
    }
  }
}