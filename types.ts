export enum CharacterAction {
  IDLE = 'IDLE',
  JUMP = 'JUMP',
  WAVE_LEFT = 'WAVE_LEFT',
  WAVE_RIGHT = 'WAVE_RIGHT',
  CROUCH = 'CROUCH',
  EARS_UP = 'EARS_UP',
  DANCE = 'DANCE'
}

export interface CharacterState {
  action: CharacterAction;
  headTilt: number;     // -45 to 45 degrees
  leftArmAngle: number; // 0 (down) to 180 (up)
  rightArmAngle: number;// 0 (down) to 180 (up)
}

export interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'action' | 'error';
}

export interface LiveConfig {
  model: string;
  systemInstruction: string;
}
