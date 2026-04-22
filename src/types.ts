export type FishType = 'clownfish' | 'pufferfish' | 'jellyfish' | 'shark' | 'squid' | 'turtle' | 'anglerfish' | 'boxjellyfish' | 'mantaray';

export interface Fish {
  id: string;
  type: FishType;
  x: number;
  y: number;
  z: number; // 0 is behind user, 1 is in front
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  color: string;
  targetX: number;
  targetY: number;
  state: 'idle' | 'happy' | 'scared' | 'feeding' | 'resting' | 'spawning' | 'perching' | 'caught';
  pauseTimer: number;
  scaredTimer: number;
  spawningTimer: number;
  spawnCooldown: number;
  wanderAngle: number;
  perchedOnCoralId?: string;
}

export interface Egg {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  stuckTo: 'head' | 'forehead' | 'ear-left' | 'ear-right' | 'shoulder-left' | 'shoulder-right' | null;
  offset: { x: number; y: number };
}

export type TrashType = 'bottle' | 'bag' | 'can' | 'straw' | 'mask';

export interface Trash {
  id: string;
  type: TrashType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  size: number;
  stuckTo: 'head' | 'shoulder-left' | 'shoulder-right' | 'coral' | null;
  stuckToCoralId?: string;
  offset: { x: number; y: number };
  removed?: boolean;
}

export interface Food {
  id: string;
  body: Matter.Body;
}

export interface InkCloud {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  timer: number;
}

export interface CoralBranch {
  angle: number;
  length: number;
  width: number;
  subBranches?: CoralBranch[];
}

export interface Coral {
  id: string;
  x: number;
  y: number;
  size: number;
  type: number;
  color: string;
  branches: CoralBranch[];
}

export interface Reef {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  points: { x: number; y: number }[];
  color: string;
  secondaryColor: string;
}

export type TaskActionType = 'discovery' | 'feeding' | 'cleanup';

export interface Task {
  id: string;
  type: TaskActionType;
  title: string;
  description: string;
  targetCount: number;
  currentCount: number;
  completed: boolean;
  discoveredFishTypes: FishType[];
}

export interface ARState {
  eyesClosed: boolean;
  isPinching: boolean;
  pinchPos: { x: number; y: number } | null;
  palmPos: { x: number; y: number } | null;
  indexFingerTipPos: { x: number; y: number } | null;
  indexFingerTipPosArray: { x: number; y: number }[];
  facePos: { x: number; y: number } | null;
  headTopPos: { x: number; y: number } | null;
  shoulderLeftPos: { x: number; y: number } | null;
  shoulderRightPos: { x: number; y: number } | null;
  foreheadPos: { x: number; y: number } | null;
  earLeftPos: { x: number; y: number } | null;
  earRightPos: { x: number; y: number } | null;
  faceLandmarks?: { x: number; y: number; z: number }[] | null;
  faceLandmarks2?: { x: number; y: number; z: number }[] | null;
  mode: 'normal' | 'deep-sea' | 'abyssal';
  isUserStill: boolean;
  eggCount: number;
  isSpawning: boolean;
  isPointing: boolean;
  isFist: boolean;
  fistProgress: number;
  fistActiveFrames: number;
  isBleached: boolean;
  pollutionLevel: number;
  hoveredFishId: string | null;
  hoveredFishPos: { x: number; y: number } | null;
  hoverProgress: number;
  interactionTime: number;
  swipeDirection: 'left' | 'right' | null;
  currentTask: Task | null;
}
