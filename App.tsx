import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Mic, Activity, Power, Video, VideoOff } from 'lucide-react';
import { BunnyCharacter } from './components/BunnyCharacter';
import { CharacterAction, LogEntry, CharacterState } from './types';
import { GeminiLiveService } from './services/geminiLiveService';

const FRAME_RATE = 5; // Frames per second
const JPEG_QUALITY = 0.5; // Lower quality for speed
const MAX_VIDEO_WIDTH = 360; // Downscale width to improve AI processing speed

function App() {
  const [isActive, setIsActive] = useState(false);
  const [characterState, setCharacterState] = useState<CharacterState>({
    action: CharacterAction.IDLE,
    headTilt: 0,
    leftArmAngle: 0,
    rightArmAngle: 0
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [videoEnabled, setVideoEnabled] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const serviceRef = useRef<GeminiLiveService | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  
  // Use a ref to keep track of videoEnabled state inside the interval closure
  const videoEnabledRef = useRef(videoEnabled);
  useEffect(() => {
    videoEnabledRef.current = videoEnabled;
  }, [videoEnabled]);

  const addLog = useCallback((message: string, type: 'info' | 'action' | 'error' = 'info') => {
    setLogs(prev => [{ timestamp: new Date().toLocaleTimeString(), message, type }, ...prev].slice(0, 5));
  }, []);

  const startVideoStreaming = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((err) => addLog(`Camera error: ${err}`, 'error'));

    const ctx = canvasRef.current.getContext('2d');
    
    frameIntervalRef.current = window.setInterval(() => {
      // Check serviceRef.current instead of isActive to avoid stale closure issues
      if (!serviceRef.current || !videoRef.current || !canvasRef.current || !ctx || !videoEnabledRef.current) return;

      if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        // Calculate scale to maintain aspect ratio while reducing size
        const scale = MAX_VIDEO_WIDTH / videoRef.current.videoWidth;
        canvasRef.current.width = MAX_VIDEO_WIDTH;
        canvasRef.current.height = videoRef.current.videoHeight * scale;
        
        // Draw video frame to canvas (resized)
        ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);

        // Compress and Convert to Base64
        canvasRef.current.toBlob(
          async (blob) => {
            if (blob && serviceRef.current) {
               // Convert blob to base64 manually
               const reader = new FileReader();
               reader.onloadend = () => {
                 const base64data = (reader.result as string).split(',')[1];
                 serviceRef.current?.sendFrame(base64data);
               };
               reader.readAsDataURL(blob);
            }
          },
          'image/jpeg',
          JPEG_QUALITY
        );
      }
    }, 1000 / FRAME_RATE);
  }, [addLog]);

  const startGemini = async () => {
    try {
      if (!process.env.API_KEY) {
        addLog("API_KEY not found in environment variables.", 'error');
        return;
      }

      serviceRef.current = new GeminiLiveService();
      
      await serviceRef.current.connect(
        (newState) => {
          setCharacterState(newState);
          // Only log significant action changes to avoid spam
          if (newState.action !== CharacterAction.IDLE) {
             addLog(`Action: ${newState.action}`, 'action');
          }
        },
        (msg) => addLog(msg),
        () => setIsActive(false)
      );

      setIsActive(true);
      startVideoStreaming();

    } catch (error: any) {
      addLog(`Failed to connect: ${error.message}`, 'error');
      setIsActive(false);
    }
  };

  const stopGemini = () => {
    if (serviceRef.current) {
      serviceRef.current.disconnect();
      serviceRef.current = null;
    }
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    setIsActive(false);
    setCharacterState({
      action: CharacterAction.IDLE,
      headTilt: 0,
      leftArmAngle: 0,
      rightArmAngle: 0
    });
    addLog("Disconnected", 'info');
  };

  useEffect(() => {
    return () => {
      stopGemini();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col md:flex-row overflow-hidden">
      
      {/* Sidebar / Controls */}
      <div className="w-full md:w-80 bg-slate-800 p-6 flex flex-col gap-6 shadow-xl z-10 border-r border-slate-700">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Camera className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Judy's Mirror
          </h1>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-slate-700/50 rounded-xl border border-slate-600">
             <h2 className="text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wider">Status</h2>
             <div className="flex items-center justify-between">
                <span className={`flex items-center gap-2 ${isActive ? 'text-green-400' : 'text-slate-400'}`}>
                  <Activity className={`w-4 h-4 ${isActive ? 'animate-pulse' : ''}`} />
                  {isActive ? 'Live & Watching' : 'Disconnected'}
                </span>
                <button 
                  onClick={() => setVideoEnabled(!videoEnabled)}
                  className="p-2 hover:bg-slate-600 rounded-full transition-colors"
                  title={videoEnabled ? "Disable Camera" : "Enable Camera"}
                >
                  {videoEnabled ? <Video className="w-4 h-4 text-blue-400"/> : <VideoOff className="w-4 h-4 text-red-400"/>}
                </button>
             </div>
          </div>

          <button
            onClick={isActive ? stopGemini : startGemini}
            className={`w-full py-4 px-6 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all transform active:scale-95 shadow-lg ${
              isActive 
                ? 'bg-red-500/20 text-red-400 border-2 border-red-500/50 hover:bg-red-500/30' 
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/25'
            }`}
          >
            <Power className="w-5 h-5" />
            {isActive ? 'Stop Session' : 'Start Camera'}
          </button>
        </div>

        {/* Instructions */}
        <div className="flex-1 overflow-y-auto">
          <h3 className="text-sm font-semibold text-slate-400 mb-3">GESTURES</h3>
          <ul className="space-y-2 text-sm text-slate-300">
             <li className="flex items-center gap-2 p-2 rounded hover:bg-slate-700/50">
              <span className="w-2 h-2 bg-blue-400 rounded-full"></span> 
              <span>Raise Hands / Tilt Head</span>
              <span className="text-xs text-slate-500 ml-auto">Mirror</span>
            </li>
            <li className="flex items-center gap-2 p-2 rounded hover:bg-slate-700/50">
              <span className="w-2 h-2 bg-green-400 rounded-full"></span> Jump Up <span className="text-xs text-slate-500 ml-auto">Jump</span>
            </li>
            <li className="flex items-center gap-2 p-2 rounded hover:bg-slate-700/50">
              <span className="w-2 h-2 bg-yellow-400 rounded-full"></span> Duck Down <span className="text-xs text-slate-500 ml-auto">Crouch</span>
            </li>
             <li className="flex items-center gap-2 p-2 rounded hover:bg-slate-700/50">
              <span className="w-2 h-2 bg-pink-400 rounded-full"></span> Hands to Ears <span className="text-xs text-slate-500 ml-auto">Wiggle Ears</span>
            </li>
          </ul>

          <h3 className="text-sm font-semibold text-slate-400 mt-6 mb-3">SYSTEM LOGS</h3>
          <div className="font-mono text-xs space-y-1 opacity-70">
            {logs.map((log, i) => (
              <div key={i} className={`flex gap-2 ${log.type === 'error' ? 'text-red-400' : log.type === 'action' ? 'text-blue-300' : 'text-slate-400'}`}>
                <span className="text-slate-600">[{log.timestamp}]</span>
                <span>{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Stage */}
      <div className="flex-1 relative flex flex-col items-center justify-center p-8 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black">
        
        {/* User Camera Preview (Small PIP) */}
        <div className="absolute top-6 right-6 w-48 aspect-video bg-black rounded-lg overflow-hidden border-2 border-slate-700 shadow-2xl transform transition-all hover:scale-105">
          <video 
            ref={videoRef} 
            autoPlay 
            muted 
            playsInline
            className={`w-full h-full object-cover transform scale-x-[-1] ${!videoEnabled ? 'opacity-0' : 'opacity-100'}`}
          />
           {!videoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs">
              Camera Paused
            </div>
          )}
          {/* Hidden Canvas for processing */}
          <canvas ref={canvasRef} className="hidden" />
          
          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded text-[10px] text-white backdrop-blur-sm">
             <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`}></div>
             LIVE INPUT
          </div>
        </div>

        {/* Character Stage */}
        <div className="flex flex-col items-center">
            <div className="relative z-10">
                <BunnyCharacter state={characterState} />
            </div>
            
            <div className="mt-12 text-center opacity-50">
                 <p className="text-slate-500 text-sm">Move your head and arms to control Judy!</p>
                 <div className="mt-2 flex justify-center gap-2">
                    <Mic className={`w-4 h-4 ${isActive ? 'text-blue-400 animate-pulse' : 'text-slate-600'}`} />
                 </div>
            </div>
            
            {/* Floor Reflection/Shadow */}
            <div className="w-64 h-8 bg-black/40 rounded-[100%] blur-xl mt-[-20px]"></div>
        </div>
      </div>
    </div>
  );
}

export default App;