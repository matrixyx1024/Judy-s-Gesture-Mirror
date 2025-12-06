import React, { useEffect, useState } from 'react';
import { CharacterAction, CharacterState } from '../types';

interface BunnyProps {
  state: CharacterState;
}

export const BunnyCharacter: React.FC<BunnyProps> = ({ state }) => {
  const { action, headTilt, leftArmAngle, rightArmAngle } = state;
  const [animationClass, setAnimationClass] = useState('');

  useEffect(() => {
    switch (action) {
      case CharacterAction.JUMP:
        setAnimationClass('animate-bounce-high');
        break;
      case CharacterAction.CROUCH:
        setAnimationClass('translate-y-10 scale-y-75');
        break;
      case CharacterAction.DANCE:
        setAnimationClass('animate-dance');
        break;
      case CharacterAction.IDLE:
      case CharacterAction.WAVE_LEFT:
      case CharacterAction.WAVE_RIGHT:
      case CharacterAction.EARS_UP:
      default:
        setAnimationClass('');
        break;
    }
    
    // Reset transient animations
    if (action === CharacterAction.JUMP) {
        const t = setTimeout(() => setAnimationClass(''), 1000);
        return () => clearTimeout(t);
    }

  }, [action]);

  const isEarsUp = action === CharacterAction.EARS_UP;
  const isDancing = action === CharacterAction.DANCE;

  return (
    <div className={`relative w-64 h-96 transition-transform duration-100 ${animationClass}`}>
      <svg viewBox="0 0 200 300" className="w-full h-full drop-shadow-2xl">
        {/* Defs for gradients */}
        <defs>
          <linearGradient id="furGrey" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d1d5db" />
            <stop offset="100%" stopColor="#9ca3af" />
          </linearGradient>
          <linearGradient id="earPink" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fbcfe8" />
            <stop offset="100%" stopColor="#f472b6" />
          </linearGradient>
          <linearGradient id="vestBlue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
        </defs>

        {/* Legs */}
        <path d="M70 250 L70 290 L90 290 L90 250 Z" fill="#374151" />
        <path d="M110 250 L110 290 L130 290 L130 250 Z" fill="#374151" />

        {/* Body */}
        <ellipse cx="100" cy="180" rx="45" ry="70" fill="url(#furGrey)" />
        
        {/* Vest */}
        <path d="M65 140 Q100 120 135 140 L135 220 Q100 240 65 220 Z" fill="url(#vestBlue)" stroke="#1e3a8a" strokeWidth="2" />
        {/* Badge */}
        <circle cx="120" cy="160" r="8" fill="#fbbf24" stroke="#d97706" />

        {/* Head Group (Includes Ears and Face) */}
        <g 
            style={{ 
                transformOrigin: '100px 140px', 
                transform: `rotate(${headTilt || 0}deg)` 
            }} 
            className="transition-transform duration-75 ease-linear"
        >
            {/* Ears */}
            <g className={`transition-transform duration-500 origin-bottom ${isEarsUp ? 'scale-y-110 -translate-y-2' : ''}`}>
                {/* Left Ear */}
                <path 
                    d="M60 90 Q40 10 70 5 Q90 10 80 90 Z" 
                    fill="url(#furGrey)" 
                    stroke="#6b7280" strokeWidth="2"
                    className={`origin-bottom-right transition-transform duration-500 ${isDancing ? 'animate-wiggle-slow' : ''}`}
                />
                <path d="M65 80 Q55 30 70 25 Q80 30 75 80 Z" fill="url(#earPink)" className="origin-bottom-right" />

                {/* Right Ear */}
                <path 
                    d="M140 90 Q160 10 130 5 Q110 10 120 90 Z" 
                    fill="url(#furGrey)" 
                    stroke="#6b7280" strokeWidth="2"
                    className={`origin-bottom-left transition-transform duration-500 ${isDancing ? 'animate-wiggle-slow-reverse' : ''}`}
                />
                <path d="M135 80 Q145 30 130 25 Q120 30 125 80 Z" fill="url(#earPink)" className="origin-bottom-left" />
            </g>

            {/* Head Shape */}
            <circle cx="100" cy="100" r="45" fill="url(#furGrey)" stroke="#9ca3af" strokeWidth="1" />

            {/* Face Features */}
            <circle cx="85" cy="90" r="5" fill="#1f2937" /> {/* Left Eye */}
            <circle cx="115" cy="90" r="5" fill="#1f2937" /> {/* Right Eye */}
            <circle cx="87" cy="88" r="1.5" fill="white" />
            <circle cx="117" cy="88" r="1.5" fill="white" />
            
            <path d="M95 105 L105 105 L100 110 Z" fill="#f472b6" /> {/* Nose */}
            <path d="M100 110 Q90 120 85 115" fill="none" stroke="#374151" strokeWidth="1.5" /> {/* Mouth L */}
            <path d="M100 110 Q110 120 115 115" fill="none" stroke="#374151" strokeWidth="1.5" /> {/* Mouth R */}
        </g>

        {/* Left Arm (Viewer's Left) */}
        <g 
            style={{ 
                transformOrigin: '65px 150px', 
                transform: `rotate(${leftArmAngle || 0}deg)` 
            }} 
            className="transition-transform duration-75 ease-linear"
        >
             <path d="M65 150 Q40 180 50 200" fill="none" stroke="url(#furGrey)" strokeWidth="12" strokeLinecap="round" />
             <circle cx="50" cy="200" r="8" fill="#d1d5db" />
        </g>

        {/* Right Arm (Viewer's Right) */}
        <g 
             style={{ 
                transformOrigin: '135px 150px', 
                transform: `rotate(${- (rightArmAngle || 0)}deg)` 
            }} 
            className="transition-transform duration-75 ease-linear"
        >
            <path d="M135 150 Q160 180 150 200" fill="none" stroke="url(#furGrey)" strokeWidth="12" strokeLinecap="round" />
            <circle cx="150" cy="200" r="8" fill="#d1d5db" />
        </g>

      </svg>
      
      {/* Speech Bubble for State */}
      <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-white px-3 py-1 rounded-full shadow-lg text-sm font-bold text-gray-700 animate-fade-in whitespace-nowrap">
        {action === CharacterAction.IDLE ? 'Mirroring...' : action}
      </div>
    </div>
  );
};