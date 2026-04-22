import React, { useEffect, useRef, useState } from 'react';
import { SelfieSegmentation } from '@mediapipe/selfie_segmentation';
import { Hands, HAND_CONNECTIONS } from '@mediapipe/hands';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
import Matter from 'matter-js';
import { Fish, FishType, Food, ARState, Egg, Trash, TrashType, InkCloud, Coral, CoralBranch, Task } from '../types';
import { Heart, Waves, Zap, Info, Settings, Maximize2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import GuidancePanel from './GuidancePanel';

const FISH_CONFIG: Record<FishType, { size: number; color: string; speed: number }> = {
  clownfish: { size: 40, color: '#FF8C00', speed: 2 },
  pufferfish: { size: 50, color: '#FFD700', speed: 1.5 },
  jellyfish: { size: 60, color: '#E0B0FF', speed: 0.8 },
  shark: { size: 120, color: '#708090', speed: 3 },
  squid: { size: 45, color: '#FF69B4', speed: 2.5 },
  turtle: { size: 70, color: '#2E8B57', speed: 1.2 },
  anglerfish: { size: 65, color: '#2C3E50', speed: 1.0 },
  boxjellyfish: { size: 55, color: '#00FFFF', speed: 1.2 },
  mantaray: { size: 100, color: '#4682B4', speed: 1.5 },
};

const FISH_INFO: Record<FishType, string> = {
  clownfish: '小丑鱼，又称海葵鱼。它们与海葵有着互利共生的关系，海葵的毒触手能保护小丑鱼，而小丑鱼则能为海葵清理寄生虫。',
  pufferfish: '河豚，当遇到危险时，它们会吞下大量的水或空气，使身体膨胀成一个带刺的圆球，以此来吓退捕食者。',
  jellyfish: '水母，一种古老的海洋生物。它们没有大脑、心脏和骨骼，身体主要由水组成。深海中的水母往往能发出美丽的荧光。',
  shark: '鲨鱼，海洋中的顶级掠食者。它们有着极其敏锐的嗅觉，能够闻到数公里外的一滴血。',
  squid: '乌贼，遇到危险时会喷出墨汁来迷惑敌人。它们还能通过改变体表的色素细胞来快速改变身体颜色。',
  turtle: '海龟，寿命极长的海洋爬行动物。它们在海洋中度过一生，只有在产卵时才会回到它们出生的沙滩。',
  anglerfish: '灯笼鱼，深海中的奇特生物。它们头顶有一个发光的诱饵，用来在黑暗的深海中吸引猎物靠近，然后一口吞下。',
  boxjellyfish: '箱水母，海洋中最毒的生物之一。它们有着精致的立方体伞状结构，游动动作非常优雅且迅速。',
  mantaray: '魔鬼鱼，又称蝠鲼。它们在水中游动时就像在飞翔，优雅且充满力量。',
};

const NORMAL_CREATURES: FishType[] = ['clownfish', 'pufferfish', 'turtle', 'jellyfish', 'shark', 'squid'];
const DEEP_SEA_CREATURES: FishType[] = ['anglerfish', 'boxjellyfish', 'mantaray'];

const TASKS: Task[] = [
  {
    id: 'task-1',
    type: 'discovery',
    title: '观察与发现',
    description: '引导玩家用手指指向不同的鱼类，探索奇妙的海洋生物。',
    targetCount: 5,
    currentCount: 0,
    completed: false,
    discoveredFishTypes: [],
  },
  {
    id: 'task-2',
    type: 'feeding',
    title: '爱心喂食',
    description: '教授玩家使用“捏合”手势投放食物。通过喂食，引导玩家观察鱼群聚拢的自然行为。',
    targetCount: 5,
    currentCount: 0,
    completed: false,
    discoveredFishTypes: [],
  },
  {
    id: 'task-3',
    type: 'cleanup',
    title: '生态清理',
    description: '引导玩家清理粘在鱼儿、珊瑚和用户身上的“海洋垃圾”。通过挥手、晃动身体或握拳来清除它们，教育玩家通过清理海洋垃圾来预防海水污染。',
    targetCount: 10,
    currentCount: 0,
    completed: false,
    discoveredFishTypes: [],
  }
];

const INITIAL_TASK = TASKS[0];

export default function ARView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const [isStarted, setIsStarted] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showFreeExplore, setShowFreeExplore] = useState(false);

  const [arState, setArState] = useState<ARState>({
    eyesClosed: false,
    isPinching: false,
    pinchPos: null,
    palmPos: null,
    indexFingerTipPos: null,
    facePos: null,
    headTopPos: null,
    shoulderLeftPos: null,
    shoulderRightPos: null,
    foreheadPos: null,
    earLeftPos: null,
    earRightPos: null,
    mode: 'normal',
    isUserStill: false,
    eggCount: 0,
    isSpawning: false,
    isPointing: false,
    hoveredFishId: null,
    hoveredFishPos: null,
    hoverProgress: 0,
    interactionTime: 0,
    swipeDirection: null,
    currentTask: INITIAL_TASK,
    isFist: false,
    fistProgress: 0,
    fistActiveFrames: 0,
    isBleached: false,
    pollutionLevel: 0,
    indexFingerTipPosArray: [],
  });

    // Background music and mode transition control
    useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;

      const normalMusic = "https://raw.githubusercontent.com/lucaibing/-/main/%E6%B5%B7%E9%B8%A5%E5%8F%AB.mp3";
      const deepSeaMusic = "https://raw.githubusercontent.com/lucaibing/-/main/%E9%9F%B3%E9%A2%91-3%E5%88%8625%E7%A7%92.mp3";

      if (arState.mode === 'normal') {
        if (audio.src !== normalMusic) {
          audio.src = normalMusic;
          audio.load();
        }
        audio.volume = 0.3;
        audio.play().catch(e => console.error("Audio play failed:", e));
      } else if (arState.mode === 'deep-sea' || arState.mode === 'abyssal') {
        // Clear trash when entering deep-sea or abyssal mode
        trashRef.current = [];
        
        if (audio.src !== deepSeaMusic) {
          audio.src = deepSeaMusic;
          audio.load();
        }
        audio.volume = 0.3;
        audio.play().catch(e => console.error("Audio play failed:", e));
      } else {
        audio.pause();
        audio.currentTime = 0;
      }
    }, [arState.mode]);

  const arStateRef = useRef<ARState>(arState);
  
  const engineRef = useRef(Matter.Engine.create());
  const fishRef = useRef<Fish[]>([]);
  const foodRef = useRef<Food[]>([]);
  const eggRef = useRef<Egg[]>([]);
  const trashRef = useRef<Trash[]>([]);
  const inkCloudsRef = useRef<InkCloud[]>([]);
  const coralsRef = useRef<Coral[]>([]);
  const lastTimeRef = useRef(performance.now());
  const segmentationRef = useRef<SelfieSegmentation | null>(null);
  const handsRef = useRef<Hands | null>(null);
  const faceMeshRef = useRef<FaceMesh | null>(null);
  const lastSpawnTimeRef = useRef(performance.now());
  const lastTrashSpawnTimeRef = useRef(performance.now());
  const eyesClosedStartTimeRef = useRef<number | null>(null);
  const lastUserMoveTimeRef = useRef(performance.now());
  const lastFacePosRef = useRef({ x: 0, y: 0 });
  const shakeIntensityRef = useRef(0);
  const pollutionAlphaRef = useRef(0);
  const eyeStateBufferRef = useRef(0); // Positive for closed, negative for open
  const palmHistoryRef = useRef<{ x: number; y: number; t: number }[]>([]);
  const lastSwipeTimeRef = useRef(0);
  const hoveredFishIdRef = useRef<string | null>(null);
  const hoverStartTimeRef = useRef<number>(0);
  const hasTriggeredHoverActionRef = useRef<boolean>(false);
  const caughtFishIdRef = useRef<string | null>(null);
  
  // Initialize Fish
  useEffect(() => {
    const initialFish: Fish[] = [];
    const count = 20;
    for (let i = 0; i < count; i++) {
      const type = (['clownfish', 'pufferfish', 'jellyfish', 'squid', 'turtle', 'shark'] as FishType[])[Math.floor(Math.random() * 6)];
      initialFish.push(createFish(type));
    }
    fishRef.current = initialFish;

    // Initialize Corals
    const initialCorals: Coral[] = [];
    const coralCount = 25; // Slightly reduced for better visibility
    const coralColors = [
      '#FF7F50', '#FF6347', '#FF1493', '#BA55D3', '#9370DB', '#40E0D0', 
      '#FFB6C1', '#FFA07A', '#EE82EE', '#F08080', '#FFD700', '#FF4500',
      '#FF00FF', '#7B68EE', '#48D1CC', '#AFEEEE'
    ];
    
    for (let i = 0; i < coralCount; i++) {
      // Significantly reduced fan ratio: only about 15% are fans now
      const isFan = i % 6 === 0; 
      const x = (i / coralCount) * window.innerWidth + (Math.random() - 0.5) * (window.innerWidth / coralCount);
      
      initialCorals.push(createCoral(
        x,
        window.innerHeight - 5 - Math.random() * 35,
        coralColors[i % coralColors.length],
        isFan
      ));
      
      // Add clusters with a strong preference for branchy corals
      if (Math.random() > 0.4) {
        initialCorals.push(createCoral(
          x + (Math.random() - 0.5) * 140,
          window.innerHeight - 2 - Math.random() * 15,
          coralColors[(i + 2) % coralColors.length],
          Math.random() > 0.92 // Very low chance of being a fan in clusters
        ));
      }
    }
    
    // Sort corals to be more staggered, but keep fans generally in the background
    initialCorals.sort((a, b) => {
      // Primary sort by y (depth)
      const depthDiff = a.y - b.y;
      // If depths are similar, keep fans in back
      if (Math.abs(depthDiff) < 50) {
        if (a.type === 3 && b.type !== 3) return -1;
        if (a.type !== 3 && b.type === 3) return 1;
      }
      return depthDiff;
    });

    coralsRef.current = initialCorals;
  }, []);

  function createCoral(x: number, y: number, color: string, isFan: boolean = false): Coral {
    const type = isFan ? 3 : Math.floor(Math.random() * 3);
    // Fans are now smaller, branches are slightly larger
    const size = isFan ? 50 + Math.random() * 30 : 70 + Math.random() * 50;
    const branches: Coral['branches'] = [];
    
    if (isFan) {
      // Fan-shaped coral: many thin branches spreading out in a fan shape
      const branchCount = 10 + Math.floor(Math.random() * 6);
      for (let i = 0; i < branchCount; i++) {
        // Spread branches across a fan angle (-45 to +45 degrees from vertical)
        const angle = -Math.PI / 2 + (i / (branchCount - 1) - 0.5) * Math.PI * 0.6;
        const length = size * (0.8 + Math.random() * 0.4);
        const width = 3 + Math.random() * 3;
        
        const subBranches: CoralBranch[] = [];
        const subBranchCount = 3 + Math.floor(Math.random() * 4);
        for (let j = 0; j < subBranchCount; j++) {
          subBranches.push({
            angle: (Math.random() - 0.5) * Math.PI * 0.4,
            length: length * (0.15 + Math.random() * 0.25),
            width: width * 0.5
          });
        }
        branches.push({ angle, length, width, subBranches });
      }
    } else {
      const branchCount = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < branchCount; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
        const length = size * (0.6 + Math.random() * 0.6);
        const width = 8 + Math.random() * 8;
        
        const subBranches: CoralBranch[] = [];
        const subBranchCount = 2 + Math.floor(Math.random() * 3);
        for (let j = 0; j < subBranchCount; j++) {
          subBranches.push({
            angle: (Math.random() - 0.5) * Math.PI * 0.6,
            length: length * (0.3 + Math.random() * 0.4),
            width: width * 0.5
          });
        }
        branches.push({ angle, length, width, subBranches });
      }
    }

    return {
      id: Math.random().toString(36).substr(2, 9),
      x,
      y,
      size,
      type,
      color,
      branches
    };
  }

  function createFish(type: FishType, x?: number, y?: number): Fish {
    const config = FISH_CONFIG[type];
    const sizeVariation = 0.8 + Math.random() * 0.4; // 80% to 120% of base size
    return {
      id: Math.random().toString(36).substr(2, 9),
      type,
      x: x ?? Math.random() * window.innerWidth,
      y: y ?? Math.random() * window.innerHeight,
      z: Math.random() > 0.5 ? 1 : 0,
      vx: (Math.random() - 0.5) * config.speed,
      vy: (Math.random() - 0.5) * config.speed,
      size: config.size * sizeVariation,
      rotation: 0,
      color: config.color,
      targetX: Math.random() * window.innerWidth,
      targetY: Math.random() * window.innerHeight,
      state: 'idle',
      pauseTimer: 0,
      scaredTimer: 0,
      spawningTimer: 0,
      spawnCooldown: Math.random() * 30000, // Random initial cooldown
      wanderAngle: Math.random() * Math.PI * 2,
    };
  }

  function createTrash(): Trash {
    const types: TrashType[] = ['bottle', 'bag', 'can', 'straw', 'mask'];
    const type = types[Math.floor(Math.random() * types.length)];
    const size = 25 + Math.random() * 15;
    return {
      id: Math.random().toString(36).substr(2, 9),
      type,
      x: Math.random() * window.innerWidth,
      y: -50,
      vx: (Math.random() - 0.5) * 1.5,
      vy: 1.5 + Math.random() * 2,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.05,
      size,
      stuckTo: null,
      offset: { x: 0, y: 0 }
    };
  }

  useEffect(() => {
    if (!isStarted || !videoRef.current || !canvasRef.current) return;

    // 1. Setup MediaPipe
    // Fix for Emscripten "Module.arguments has been replaced with plain arguments_" error
    // This happens when multiple MediaPipe solutions are initialized in the same environment.
    (window as any).Module = (window as any).Module || { arguments: [] };

    segmentationRef.current = new SelfieSegmentation({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
    });
    segmentationRef.current.setOptions({ modelSelection: 0 });
    segmentationRef.current.onResults(onSegmentationResults);

    handsRef.current = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });
    handsRef.current.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    handsRef.current.onResults(onHandsResults);

    faceMeshRef.current = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });
    faceMeshRef.current.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    faceMeshRef.current.onResults(onFaceResults);

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        if (videoRef.current) {
          try {
            await segmentationRef.current?.send({ image: videoRef.current });
            await handsRef.current?.send({ image: videoRef.current });
            await faceMeshRef.current?.send({ image: videoRef.current });
          } catch (err) {
            console.error("MediaPipe Error:", err);
          }
        }
      },
      width: 1280,
      height: 720,
    });
    const cameraStartTimeout = setTimeout(() => {
      camera.start().catch(err => {
        console.error("Camera start error:", err);
        setCameraError(err.message || "Failed to access camera. Please ensure permissions are granted.");
        setIsStarted(false);
      });
    }, 1000);

    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    // 2. Setup Physics
    const engine = engineRef.current;
    const world = engine.world;
    world.gravity.y = 1.2; // Stronger gravity for more noticeable falling

    // 3. Animation Loop
    let animationFrameId: number;
    let lastUiUpdateTime = 0;

    const animate = (time: number) => {
      const deltaTime = time - lastTimeRef.current;
      lastTimeRef.current = time;

      // Randomly spawn trash ONLY in normal mode
      if (arStateRef.current.mode === 'normal' && time - lastTrashSpawnTimeRef.current > 2500) {
        if (Math.random() < 0.6) {
          trashRef.current.push(createTrash());
          trashRef.current.push(createTrash()); // Double the quantity
        }
        lastTrashSpawnTimeRef.current = time;
      }

      updatePhysics(deltaTime);
      updateFish(deltaTime);
      draw();

      // Throttle UI updates to 10fps to reduce React overhead
      if (time - lastUiUpdateTime > 100) {
        setArState({ ...arStateRef.current });
        lastUiUpdateTime = time;
      }

      animationFrameId = requestAnimationFrame(animate);
    };
    animationFrameId = requestAnimationFrame(animate);

    return () => {
      clearTimeout(cameraStartTimeout);
      cancelAnimationFrame(animationFrameId);
      camera.stop();
      segmentationRef.current?.close();
      handsRef.current?.close();
      faceMeshRef.current?.close();
      window.removeEventListener('resize', handleResize);
    };
  }, [isStarted]);

  const onSegmentationResults = (results: any) => {
    if (!maskCanvasRef.current) return;
    const ctx = maskCanvasRef.current.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
    ctx.drawImage(results.segmentationMask, 0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
    ctx.restore();
  };

  const onHandsResults = (results: any) => {
    let isPinching = false;
    let pinchPos = null;
    let palmPos = null;
    let indexFingerTipPos = null;
    let isPointing = false;
    let isFist = false;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      results.multiHandLandmarks.forEach((landmarks: any, index: number) => {
        const handedness = results.multiHandedness[index];
        const isRightHand = handedness.label === 'Right';

        const wrist = landmarks[0];
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const indexBase = landmarks[5];
        const middleTip = landmarks[12];
        const middleBase = landmarks[9];
        const ringTip = landmarks[16];
        const ringBase = landmarks[13];
        const pinkyTip = landmarks[20];
        const pinkyBase = landmarks[17];

        const handScale = Math.sqrt(Math.pow(wrist.x - middleBase.x, 2) + Math.pow(wrist.y - middleBase.y, 2));
        
        // Finger states
        const isIndexExtended = Math.sqrt(Math.pow(indexTip.x - wrist.x, 2) + Math.pow(indexTip.y - wrist.y, 2)) > 
                               Math.sqrt(Math.pow(indexBase.x - wrist.x, 2) + Math.pow(indexBase.y - wrist.y, 2)) * 1.2;
        
        const isMiddleCurled = Math.sqrt(Math.pow(middleTip.x - wrist.x, 2) + Math.pow(middleTip.y - wrist.y, 2)) < 
                              Math.sqrt(Math.pow(middleBase.x - wrist.x, 2) + Math.pow(middleBase.y - wrist.y, 2)) * 1.3; // Increased threshold for more leniency
        const isRingCurled = Math.sqrt(Math.pow(ringTip.x - wrist.x, 2) + Math.pow(ringTip.y - wrist.y, 2)) < 
                            Math.sqrt(Math.pow(ringBase.x - wrist.x, 2) + Math.pow(ringBase.y - wrist.y, 2)) * 1.3;
        const isPinkyCurled = Math.sqrt(Math.pow(pinkyTip.x - wrist.x, 2) + Math.pow(pinkyTip.y - wrist.y, 2)) < 
                             Math.sqrt(Math.pow(pinkyBase.x - wrist.x, 2) + Math.pow(pinkyBase.y - wrist.y, 2)) * 1.3;

        // More lenient fist: index must not be extended, and at least 2 of the other 3 fingers must be curled
        const curledCount = (isMiddleCurled ? 1 : 0) + (isRingCurled ? 1 : 0) + (isPinkyCurled ? 1 : 0);
        const handIsFist = !isIndexExtended && curledCount >= 2;
        const handIsPointing = isIndexExtended && curledCount >= 2;
        const isFullPalm = (!isMiddleCurled && !isRingCurled) || (!isMiddleCurled && !isPinkyCurled);

        if (handIsFist) isFist = true;
        if (handIsPointing) isPointing = true;

        const pinchDist = Math.sqrt(Math.pow(thumbTip.x - indexTip.x, 2) + Math.pow(thumbTip.y - indexTip.y, 2));
        
        const currentPalmX = (1 - middleBase.x) * window.innerWidth;
        const currentPalmY = middleBase.y * window.innerHeight;
        const now = performance.now();

        // Only set index finger position if pointing clearly
        if (isPointing && !indexFingerTipPos) {
          indexFingerTipPos = { x: (1 - indexTip.x) * window.innerWidth, y: indexTip.y * window.innerHeight };
        }

        if (pinchDist < handScale * 0.15) { 
          isPinching = true;
          const midX = (thumbTip.x + indexTip.x) / 2;
          const midY = (thumbTip.y + indexTip.y) / 2;
          
          pinchPos = { x: (1 - midX) * window.innerWidth, y: midY * window.innerHeight };
          
          const spawnX = (1 - midX) * window.innerWidth;
          const yPos = midY * window.innerHeight;
          spawnFood(spawnX, yPos);

          // Turtle interaction: Catch turtle if pinching near one
          if (!caughtFishIdRef.current) {
            const turtle = fishRef.current.find(f => 
              f.type === 'turtle' && 
              Math.sqrt(Math.pow(f.x - pinchPos!.x, 2) + Math.pow(f.y - pinchPos!.y, 2)) < f.size * 2
            );
            if (turtle) {
              caughtFishIdRef.current = turtle.id;
              turtle.state = 'caught';
            }

            // Squid interaction: Escape if pinched
            const squid = fishRef.current.find(f => 
              f.type === 'squid' && 
              f.state !== 'scared' &&
              Math.sqrt(Math.pow(f.x - pinchPos!.x, 2) + Math.pow(f.y - pinchPos!.y, 2)) < f.size * 1.5
            );

            if (squid) {
              // Trigger ink release
              for (let i = 0; i < 8; i++) {
                inkCloudsRef.current.push({
                  id: Math.random().toString(),
                  x: squid.x + (Math.random() - 0.5) * 30,
                  y: squid.y + (Math.random() - 0.5) * 30,
                  vx: (Math.random() - 0.5) * 2,
                  vy: (Math.random() - 0.5) * 2,
                  size: 50 + Math.random() * 50,
                  opacity: 0.95,
                  timer: 4000 + Math.random() * 2000,
                });
              }
              
              // Escape dash away from pinch point
              const dx = squid.x - pinchPos!.x;
              const dy = squid.y - pinchPos!.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              
              squid.vx = (dx / dist) * 35 + (Math.random() - 0.5) * 15;
              squid.vy = (dy / dist) * 35 + (Math.random() - 0.5) * 15;
              squid.scaredTimer = 5000;
              squid.state = 'scared';

              // Audio feedback for ink squirt
              try {
                const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const oscillator = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.3);
                gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
                oscillator.start();
                oscillator.stop(audioCtx.currentTime + 0.3);
              } catch (e) {}
            }

            // Clownfish interaction: Hide in coral if pinched
            const clownfish = fishRef.current.find(f => 
              f.type === 'clownfish' && 
              f.state !== 'perching' &&
              Math.sqrt(Math.pow(f.x - pinchPos!.x, 2) + Math.pow(f.y - pinchPos!.y, 2)) < f.size * 1.5
            );

            if (clownfish) {
              const nearbyCoral = coralsRef.current.find(c => {
                const dx = c.x - clownfish.x;
                const dy = c.y - clownfish.y;
                return Math.sqrt(dx * dx + dy * dy) < 400;
              });
              
              if (nearbyCoral) {
                clownfish.state = 'perching';
                clownfish.perchedOnCoralId = nearbyCoral.id;
                // Dash towards the coral
                const dx = nearbyCoral.x - clownfish.x;
                const dy = nearbyCoral.y - clownfish.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                clownfish.vx = (dx / dist) * 15;
                clownfish.vy = (dy / dist) * 15;
              } else {
                // If no coral nearby, just dash away
                clownfish.state = 'scared';
                clownfish.scaredTimer = 3000;
                const dx = clownfish.x - pinchPos!.x;
                const dy = clownfish.y - pinchPos!.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                clownfish.vx = (dx / dist) * 20;
                clownfish.vy = (dy / dist) * 20;
              }
            }
          }
        }

        // If something is caught, update its position to follow the pinch
        if (caughtFishIdRef.current && pinchPos) {
          const fish = fishRef.current.find(f => f.id === caughtFishIdRef.current);
          if (fish) {
            fish.x = pinchPos.x;
            fish.y = pinchPos.y;
            fish.targetX = pinchPos.x;
            fish.targetY = pinchPos.y;
          }
        }

        if (!palmPos) {
          palmPos = { x: currentPalmX, y: currentPalmY };
        }

        // Swipe Detection Logic - Only if right hand palm is open
        if (isFullPalm && isRightHand) {
          palmHistoryRef.current.push({ x: currentPalmX, y: currentPalmY, t: now });
        }
        
        // Keep only last 2000ms of history for better capture
        palmHistoryRef.current = palmHistoryRef.current.filter(p => now - p.t < 2000);

        // Increased cooldown from 300ms to 1000ms to prevent rapid consecutive switches
        if (isFullPalm && palmHistoryRef.current.length > 3 && now - lastSwipeTimeRef.current > 1000) {
          const first = palmHistoryRef.current[0];
          const last = palmHistoryRef.current[palmHistoryRef.current.length - 1];
          const dx = last.x - first.x;
          const dy = last.y - first.y;
          const dt = last.t - first.t;
          const speed = Math.abs(dx) / dt; // pixels per ms

          // Improved swipe detection: Horizontal linearity and minimum distance
          const isHorizontal = Math.abs(dx) > Math.abs(dy) * 1.0;
          // Increased minimum distance from 50 to 150 to require a larger gesture
          const isLongEnough = Math.abs(dx) > 150;
          const isFastEnough = speed > 0.1;
          
          // Check if all tasks are completed (Task 3 is completed)
          const isAllTasksCompleted = arStateRef.current.currentTask?.id === 'task-3' && arStateRef.current.currentTask?.completed;

          if (isHorizontal && isLongEnough && isFastEnough) {
            // dx < 0 means currentPalmX decreased, which means the hand moved from right to left on screen (user swiped left)
            const isLeftSwipe = dx < 0; 
            
            if (isLeftSwipe && isAllTasksCompleted) {
              const currentMode = arStateRef.current.mode;
              let nextMode: 'normal' | 'deep-sea' | 'abyssal' | null = null;

              // Cycle through modes: Normal -> Deep Sea -> Abyssal -> Normal
              if (currentMode === 'normal') {
                nextMode = 'deep-sea';
              } else if (currentMode === 'deep-sea') {
                nextMode = 'abyssal';
              } else if (currentMode === 'abyssal') {
                nextMode = 'normal';
              }

              if (nextMode) {
                setArState(prev => ({ ...prev, mode: nextMode!, swipeDirection: 'left' }));
                arStateRef.current.mode = nextMode;
                arStateRef.current.swipeDirection = 'left';
                
                // Clear swipe direction after 1.5 seconds
                setTimeout(() => {
                  setArState(prev => ({ ...prev, swipeDirection: null }));
                  arStateRef.current.swipeDirection = null;
                }, 1500);

                lastSwipeTimeRef.current = now;
                palmHistoryRef.current = []; // Clear history after swipe

                const targetCount = (nextMode === 'deep-sea' || nextMode === 'abyssal') ? 10 : 20;

                // Adjust count
                if (fishRef.current.length > targetCount) {
                  fishRef.current = fishRef.current.slice(0, targetCount);
                } else if (fishRef.current.length < targetCount) {
                  while (fishRef.current.length < targetCount) {
                    const types = (nextMode === 'deep-sea' || nextMode === 'abyssal') ? DEEP_SEA_CREATURES : NORMAL_CREATURES;
                    const type = types[Math.floor(Math.random() * types.length)];
                    fishRef.current.push(createFish(type));
                  }
                }

                // Update existing fish
                fishRef.current.forEach(f => {
                  const types = (nextMode === 'deep-sea' || nextMode === 'abyssal') ? DEEP_SEA_CREATURES : NORMAL_CREATURES;
                  const newType = types[Math.floor(Math.random() * types.length)];
                  const config = FISH_CONFIG[newType];
                  
                  f.type = newType;
                  f.color = config.color;
                  const sizeVariation = 0.8 + Math.random() * 0.4;
                  f.size = config.size * sizeVariation;
                  f.state = 'idle';
                });

                // Audio feedback
                try {
                  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                  const oscillator = audioCtx.createOscillator();
                  const gainNode = audioCtx.createGain();
                  oscillator.connect(gainNode);
                  gainNode.connect(audioCtx.destination);
                  oscillator.type = 'sine';
                  oscillator.frequency.setValueAtTime(nextMode === 'deep-sea' ? 440 : 660, audioCtx.currentTime);
                  gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
                  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
                  oscillator.start();
                  oscillator.stop(audioCtx.currentTime + 0.4);
                } catch (e) {
                  console.error('Audio feedback failed', e);
                }
              }
            } 
            // If tasks NOT completed, swipe can still be used for cleanup (Task 3)
            else if (!isAllTasksCompleted) {
              const task = arStateRef.current.currentTask;
              if (task && !task.completed && task.type === 'cleanup') {
                let clearedCount = 0;
                eggRef.current.forEach(p => {
                  if (p.stuckTo) {
                    p.stuckTo = null;
                    p.vx = (dx > 0 ? 1 : -1) * 30;
                    p.vy = (Math.random() - 0.5) * 20;
                    clearedCount++;
                  }
                });

                if (clearedCount > 0) {
                  const newCount = Math.min(task.targetCount, task.currentCount + clearedCount);
                  const isCompleted = newCount >= task.targetCount;
                  
                  const updatedTask = {
                    ...task,
                    currentCount: newCount,
                    completed: isCompleted
                  };
                  
                  arStateRef.current.currentTask = updatedTask;

                  if (isCompleted) {
                    setTimeout(() => {
                      const nextTaskIndex = TASKS.findIndex(t => t.id === task.id) + 1;
                      if (nextTaskIndex < TASKS.length) {
                        arStateRef.current.currentTask = TASKS[nextTaskIndex];
                      }
                    }, 3000);
                  }
                }
                
                lastSwipeTimeRef.current = now;
                palmHistoryRef.current = []; // Clear history after swipe
              }
            }
          }
        }
      });
    }

    // Release turtle if no hand is pinching
    if (!isPinching && caughtFishIdRef.current) {
      const fish = fishRef.current.find(f => f.id === caughtFishIdRef.current);
      if (fish) {
        fish.state = 'idle';
      }
      caughtFishIdRef.current = null;
    }

    // Update fist buffer
    let newFistActiveFrames = arStateRef.current.fistActiveFrames;
    if (isFist) {
      newFistActiveFrames = 15; // Set to 15 frames of "stickiness"
    } else if (newFistActiveFrames > 0) {
      newFistActiveFrames--;
    }

    // Update ref directly for zero-latency physics/rendering
    arStateRef.current = {
      ...arStateRef.current,
      isPinching,
      pinchPos,
      palmPos,
      indexFingerTipPos,
      isPointing,
      isFist: newFistActiveFrames > 0,
      fistActiveFrames: newFistActiveFrames,
      pollutionLevel: arStateRef.current.pollutionLevel,
      isBleached: arStateRef.current.isBleached
    };
  };

  const onFaceResults = (results: any) => {
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const landmarks = results.multiFaceLandmarks[0];
      const now = performance.now();
      
      // EAR calculation
      const leftEyeUpper = landmarks[159];
      const leftEyeLower = landmarks[145];
      const leftEyeOuter = landmarks[33];
      const leftEyeInner = landmarks[133];
      const leftHeight = Math.sqrt(Math.pow(leftEyeUpper.x - leftEyeLower.x, 2) + Math.pow(leftEyeUpper.y - leftEyeLower.y, 2));
      const leftWidth = Math.sqrt(Math.pow(leftEyeOuter.x - leftEyeInner.x, 2) + Math.pow(leftEyeOuter.y - leftEyeInner.y, 2));
      const leftEAR = leftHeight / leftWidth;

      const rightEyeUpper = landmarks[386];
      const rightEyeLower = landmarks[374];
      const rightEyeOuter = landmarks[263];
      const rightEyeInner = landmarks[362];
      const rightHeight = Math.sqrt(Math.pow(rightEyeUpper.x - rightEyeLower.x, 2) + Math.pow(rightEyeUpper.y - rightEyeLower.y, 2));
      const rightWidth = Math.sqrt(Math.pow(rightEyeOuter.x - rightEyeInner.x, 2) + Math.pow(rightEyeOuter.y - rightEyeInner.y, 2));
      const rightEAR = rightHeight / rightWidth;
      
      const leftClosed = leftEAR < 0.25;
      const rightClosed = rightEAR < 0.25;
      const bothEyesClosed = leftClosed && rightClosed;
      
      // Smoothing eye state for visual feedback
      const eyesClosedNow = bothEyesClosed;
      if (eyesClosedNow) {
        eyeStateBufferRef.current = Math.min(eyeStateBufferRef.current + 1, 10);
      } else {
        eyeStateBufferRef.current = Math.max(eyeStateBufferRef.current - 1, -10);
      }

      // Only update eyesClosed state if buffer reaches threshold
      let eyesClosed = arStateRef.current.eyesClosed;
      if (eyeStateBufferRef.current >= 6) eyesClosed = true;
      if (eyeStateBufferRef.current <= -6) eyesClosed = false;

      const noseTip = landmarks[1];
      const facePos = { x: (1 - noseTip.x) * window.innerWidth, y: noseTip.y * window.innerHeight };
      const headTop = landmarks[10];
      const chin = landmarks[152];
      const chinPos = { x: (1 - chin.x) * window.innerWidth, y: chin.y * window.innerHeight };
      const faceHeight = Math.sqrt(Math.pow(headTop.x - chin.x, 2) + Math.pow(headTop.y - chin.y, 2));
      const headTopPos = { 
        x: (1 - headTop.x) * window.innerWidth, 
        y: (headTop.y - faceHeight * 0.2) * window.innerHeight 
      };
      const faceWidth = Math.sqrt(Math.pow(landmarks[234].x - landmarks[454].x, 2) + Math.pow(landmarks[234].y - landmarks[454].y, 2));
      const shoulderY = chinPos.y + faceHeight * 0.8 * window.innerHeight;
      const shoulderLeftPos = { x: facePos.x - faceWidth * 1.5 * window.innerWidth, y: shoulderY };
      const shoulderRightPos = { x: facePos.x + faceWidth * 1.5 * window.innerWidth, y: shoulderY };
      
      const forehead = landmarks[151];
      const foreheadPos = { x: (1 - forehead.x) * window.innerWidth, y: forehead.y * window.innerHeight };
      const earLeft = landmarks[234];
      const earLeftPos = { x: (1 - earLeft.x) * window.innerWidth, y: earLeft.y * window.innerHeight };
      const earRight = landmarks[454];
      const earRightPos = { x: (1 - earRight.x) * window.innerWidth, y: earRight.y * window.innerHeight };
 
      const dx = facePos.x - lastFacePosRef.current.x;
      const dy = facePos.y - lastFacePosRef.current.y;
      const moveDist = Math.sqrt(dx * dx + dy * dy);

      // Enhanced head shake detection (favoring horizontal movement)
      const horizontalShake = Math.abs(dx) > Math.abs(dy) * 1.5;
      
      if (moveDist > 40) { 
        lastUserMoveTimeRef.current = now;
        if (moveDist > 80) { 
          // Increase intensity faster if it's a horizontal shake
          const increment = horizontalShake ? 0.3 : 0.15;
          shakeIntensityRef.current = Math.min(shakeIntensityRef.current + increment, 1.0);
        }
        if (moveDist > 300) {
          shakeIntensityRef.current = 1.0;
        }
      } else {
        shakeIntensityRef.current *= 0.8; // Faster decay for snappier feel
      }
      lastFacePosRef.current = facePos;

      const isUserStill = (now - lastUserMoveTimeRef.current) > 1000;
      const isSpawning = fishRef.current.some(f => f.state === 'spawning');
      const eggCount = eggRef.current.length;
      const newMode = arStateRef.current.mode;

      // Update ref directly for zero-latency physics/rendering
      arStateRef.current = {
        ...arStateRef.current,
        eyesClosed,
        facePos,
        headTopPos,
        shoulderLeftPos,
        shoulderRightPos,
        foreheadPos,
        earLeftPos,
        earRightPos,
        faceLandmarks: landmarks,
        mode: newMode,
        isUserStill,
        isSpawning,
        eggCount
      };

      // Shake off eggs
      if (shakeIntensityRef.current > 0.6) {
        let hasShakenOff = false;
        eggRef.current.forEach(p => {
          if (p.stuckTo) {
            p.stuckTo = null;
            p.vx = (Math.random() - 0.5) * 40;
            p.vy = -20 - Math.random() * 20;
            hasShakenOff = true;
          }
        });

        // Play sound if eggs were shaken off
        if (hasShakenOff) {
          try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.2);
          } catch (e) {
            console.error('Shake sound failed', e);
          }
        }
      }
    }
  };

  const spawnFood = (x: number, y: number) => {
    // Reduced frequency: spawn every 300ms
    const now = performance.now();
    if (now - lastSpawnTimeRef.current < 300) return; 
    lastSpawnTimeRef.current = now;

    const foodBody = Matter.Bodies.circle(x, y, 5, {
      restitution: 0.8, // Increased restitution for bounciness
      friction: 0.1,
      frictionAir: 0.01, // Reduced air friction
      label: 'food'
    });
    // Set velocity to only fall downwards
    Matter.Body.setVelocity(foodBody, { 
      x: 0, 
      y: 2 + Math.random() * 2 
    });
    Matter.World.add(engineRef.current.world, foodBody);
    foodRef.current.push({ id: Math.random().toString(), body: foodBody });
    
    // Update Task Progress
    const task = arStateRef.current.currentTask;
    if (task && !task.completed && task.type === 'feeding') {
      const newCount = task.currentCount + 1;
      const isCompleted = newCount >= task.targetCount;
      
      const updatedTask = {
        ...task,
        currentCount: newCount,
        completed: isCompleted
      };
      
      arStateRef.current.currentTask = updatedTask;

      if (isCompleted) {
        setTimeout(() => {
          const nextTaskIndex = TASKS.findIndex(t => t.id === task.id) + 1;
          if (nextTaskIndex < TASKS.length) {
            arStateRef.current.currentTask = TASKS[nextTaskIndex];
          }
        }, 3000);
      }
    }

    // Cleanup old food
    if (foodRef.current.length > 50) {
      const old = foodRef.current.shift();
      if (old) Matter.World.remove(engineRef.current.world, old.body);
    }
  };

  // Ecosystem Progression removed

  const updateCleanupTask = () => {
    const task = arStateRef.current.currentTask;
    
    // Play cleanup sound
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(660, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.2);
    } catch (e) {
      console.error('Cleanup sound failed', e);
    }

    if (task && !task.completed && task.type === 'cleanup') {
      const newCount = Math.min(task.targetCount, task.currentCount + 1);
      const isCompleted = newCount >= task.targetCount;
      
      const updatedTask = {
        ...task,
        currentCount: newCount,
        completed: isCompleted
      };
      
      arStateRef.current.currentTask = updatedTask;

      if (isCompleted) {
        if (task.id === 'task-3') {
          setShowFreeExplore(true);
          setTimeout(() => {
            setShowFreeExplore(false);
          }, 5000); // Disappear after 5 seconds
        }
        
        setTimeout(() => {
          const nextTaskIndex = TASKS.findIndex(t => t.id === task.id) + 1;
          if (nextTaskIndex < TASKS.length) {
            arStateRef.current.currentTask = TASKS[nextTaskIndex];
          }
        }, 3000);
      }
    }
  };

  const updatePhysics = (dt: number) => {
    // Use actual dt for more responsive physics, capped to avoid huge jumps
    const physicsDt = Math.min(dt, 33); 
    Matter.Engine.update(engineRef.current, physicsDt);
    
    const maskCtx = maskCanvasRef.current?.getContext('2d');
    const { facePos, headTopPos, shoulderLeftPos, shoulderRightPos, foreheadPos, earLeftPos, earRightPos, palmPos } = arStateRef.current;
    
    // Update Trash
    let trashOnCoralsCount = 0;
    trashRef.current.forEach(t => {
      const { palmPos, indexFingerTipPos, isFist } = arStateRef.current;
      
      // 1. Cleanup logic for all trash (stuck or falling)
      if (palmPos) {
        const distToHand = Math.sqrt(Math.pow(t.x - palmPos.x, 2) + Math.pow(t.y - palmPos.y, 2));
        const edgeBuffer = 150;
        const isNearEdge = palmPos.x < edgeBuffer || palmPos.x > window.innerWidth - edgeBuffer;
        const cleanupRadius = isNearEdge ? 250 : 180;

        // Clear by fist (grab/punch) or waving (palm near falling trash)
        if (isFist && distToHand < cleanupRadius) {
          t.removed = true;
          updateCleanupTask();
          return;
        } else if (!t.stuckTo && distToHand < cleanupRadius * 0.7) {
          // Waving at falling trash
          t.removed = true;
          updateCleanupTask();
          return;
        }
      }

      if (indexFingerTipPos) {
        const distToFinger = Math.sqrt(Math.pow(t.x - indexFingerTipPos.x, 2) + Math.pow(t.y - indexFingerTipPos.y, 2));
        if (distToFinger < 100) {
          t.removed = true;
          updateCleanupTask();
          return;
        }
      }

      // 2. Sticking and Movement logic
      if (t.stuckTo) {
        const { headTopPos, shoulderLeftPos, shoulderRightPos } = arStateRef.current;
        if (t.stuckTo === 'head' && headTopPos) {
          t.x = headTopPos.x + t.offset.x;
          t.y = headTopPos.y + t.offset.y;
        } else if (t.stuckTo === 'shoulder-left' && shoulderLeftPos) {
          t.x = shoulderLeftPos.x + t.offset.x;
          t.y = shoulderLeftPos.y + t.offset.y;
        } else if (t.stuckTo === 'shoulder-right' && shoulderRightPos) {
          t.x = shoulderRightPos.x + t.offset.x;
          t.y = shoulderRightPos.y + t.offset.y;
        } else if (t.stuckTo === 'coral' && t.stuckToCoralId) {
          const coral = coralsRef.current.find(c => c.id === t.stuckToCoralId);
          if (coral) {
            t.x = coral.x + t.offset.x;
            t.y = coral.y + t.offset.y;
            trashOnCoralsCount++;
          } else {
            t.stuckTo = null;
            t.stuckToCoralId = undefined;
          }
        }
        
        // Shake to clear trash (only for head/shoulders)
        if (shakeIntensityRef.current > 0.6 && t.stuckTo !== 'coral') {
          t.stuckTo = null;
          t.vx = (Math.random() - 0.5) * 40;
          t.vy = -20 - Math.random() * 20;
          updateCleanupTask();
        }
      } else {
        t.y += t.vy;
        t.x += t.vx;
        t.rotation += t.rotationSpeed;
        t.vy += 0.08; // Gravity
        
        // Sticking logic (User)
        if (maskCtx && headTopPos && shoulderLeftPos && shoulderRightPos) {
          const mx = (1 - t.x / window.innerWidth) * maskCanvasRef.current!.width;
          const my = (t.y / window.innerHeight) * maskCanvasRef.current!.height;
          
          if (mx >= 0 && mx < maskCanvasRef.current!.width && my >= 0 && my < maskCanvasRef.current!.height) {
            const pixel = maskCtx.getImageData(mx, my, 1, 1).data;
            if (pixel[3] > 150) {
              const distToHead = Math.sqrt(Math.pow(t.x - headTopPos.x, 2) + Math.pow(t.y - headTopPos.y, 2));
              const distToShoulderL = Math.sqrt(Math.pow(t.x - shoulderLeftPos.x, 2) + Math.pow(t.y - shoulderLeftPos.y, 2));
              const distToShoulderR = Math.sqrt(Math.pow(t.x - shoulderRightPos.x, 2) + Math.pow(t.y - shoulderRightPos.y, 2));
              
              const faceWidth = Math.abs(arStateRef.current.earLeftPos?.x! - arStateRef.current.earRightPos?.x!) || 100;
              const threshold = faceWidth * 0.7;

              if (distToHead < threshold) {
                t.stuckTo = 'head';
                t.offset = { x: t.x - headTopPos.x, y: t.y - headTopPos.y };
              } else if (distToShoulderL < threshold) {
                t.stuckTo = 'shoulder-left';
                t.offset = { x: t.x - shoulderLeftPos.x, y: t.y - shoulderLeftPos.y };
              } else if (distToShoulderR < threshold) {
                t.stuckTo = 'shoulder-right';
                t.offset = { x: t.x - shoulderRightPos.x, y: t.y - shoulderRightPos.y };
              }
            }
          }
        }

        // Sticking logic (Coral)
        if (!t.stuckTo) {
          coralsRef.current.forEach(coral => {
            const dist = Math.sqrt(Math.pow(t.x - coral.x, 2) + Math.pow(t.y - coral.y, 2));
            if (dist < coral.size * 0.8) {
              t.stuckTo = 'coral';
              t.stuckToCoralId = coral.id;
              t.offset = { x: t.x - coral.x, y: t.y - coral.y };
              t.vx = 0;
              t.vy = 0;
            }
          });
        }
      }
    });

    // Update bleaching state
    if (trashOnCoralsCount > 5) {
      arStateRef.current.isBleached = true;
    } else if (trashOnCoralsCount < 2) {
      arStateRef.current.isBleached = false;
    }

    // Update pollution alpha for smooth transition
    const targetAlpha = Math.min(0.5, Math.max(0, (trashRef.current.length - 10) * 0.04));
    pollutionAlphaRef.current += (targetAlpha - pollutionAlphaRef.current) * 0.02;
    arStateRef.current.pollutionLevel = pollutionAlphaRef.current;

    trashRef.current = trashRef.current.filter(t => !t.removed && t.y < window.innerHeight + 100);

    // Update Eggs
    eggRef.current.forEach(p => {
      if (p.stuckTo) {
        const { facePos, headTopPos, shoulderLeftPos, shoulderRightPos, foreheadPos, earLeftPos, earRightPos } = arStateRef.current;
        
        if (p.stuckTo === 'head' && headTopPos) {
          p.x = headTopPos.x + p.offset.x;
          p.y = headTopPos.y + p.offset.y;
        } else if (p.stuckTo === 'forehead' && foreheadPos) {
          p.x = foreheadPos.x + p.offset.x;
          p.y = foreheadPos.y + p.offset.y;
        } else if (p.stuckTo === 'ear-left' && earLeftPos) {
          p.x = earLeftPos.x + p.offset.x;
          p.y = earLeftPos.y + p.offset.y;
        } else if (p.stuckTo === 'ear-right' && earRightPos) {
          p.x = earRightPos.x + p.offset.x;
          p.y = earRightPos.y + p.offset.y;
        } else if (p.stuckTo === 'shoulder-left' && shoulderLeftPos) {
          p.x = shoulderLeftPos.x + p.offset.x;
          p.y = shoulderLeftPos.y + p.offset.y;
        } else if (p.stuckTo === 'shoulder-right' && shoulderRightPos) {
          p.x = shoulderRightPos.x + p.offset.x;
          p.y = shoulderRightPos.y + p.offset.y;
        } else if (facePos) {
          p.x = facePos.x + p.offset.x;
          p.y = facePos.y + p.offset.y;
        }

        // Clumping: other eggs stick to this stuck egg
        eggRef.current.forEach(other => {
          if (!other.stuckTo) {
            const dx = other.x - p.x;
            const dy = other.y - p.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < 15) {
              other.stuckTo = p.stuckTo;
              other.offset = { x: other.x - p.x + p.offset.x, y: other.y - p.y + p.offset.y };
            }
          }
        });

        // Shake to clear eggs - more explosive
        if (shakeIntensityRef.current > 0.6) {
          p.stuckTo = null;
          p.vx = (Math.random() - 0.5) * 50;
          p.vy = -20 - Math.random() * 20;
          updateCleanupTask();
        }

        // Check for hand tap to remove egg (Patting)
        if (palmPos) {
          const dx = palmPos.x - p.x;
          const dy = palmPos.y - p.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < 150) { // Increased interaction radius
            p.stuckTo = null;
            p.vx = (Math.random() - 0.5) * 25;
            p.vy = -10 - Math.random() * 10;
            updateCleanupTask();
          }
        }
      } else {
        p.vy += 0.25; // Slightly stronger gravity for eggs
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.98;
        p.vy *= 0.98;

        // Check for sticking
        if (maskCtx && facePos && headTopPos && shoulderLeftPos && shoulderRightPos && foreheadPos && earLeftPos && earRightPos) {
          const mx = (1 - p.x / window.innerWidth) * maskCanvasRef.current!.width;
          const my = (p.y / window.innerHeight) * maskCanvasRef.current!.height;
          
          if (mx >= 0 && mx < maskCanvasRef.current!.width && my >= 0 && my < maskCanvasRef.current!.height) {
            const pixel = maskCtx.getImageData(mx, my, 1, 1).data;
            
            // Distances to key points for fine-grained sticking
            const distToHeadTop = Math.sqrt(Math.pow(p.x - headTopPos.x, 2) + Math.pow(p.y - headTopPos.y, 2));
            const distToForehead = Math.sqrt(Math.pow(p.x - foreheadPos.x, 2) + Math.pow(p.y - foreheadPos.y, 2));
            const distToEarL = Math.sqrt(Math.pow(p.x - earLeftPos.x, 2) + Math.pow(p.y - earLeftPos.y, 2));
            const distToEarR = Math.sqrt(Math.pow(p.x - earRightPos.x, 2) + Math.pow(p.y - earRightPos.y, 2));
            const distToShoulderL = Math.sqrt(Math.pow(p.x - shoulderLeftPos.x, 2) + Math.pow(p.y - shoulderLeftPos.y, 2));
            const distToShoulderR = Math.sqrt(Math.pow(p.x - shoulderRightPos.x, 2) + Math.pow(p.y - shoulderRightPos.y, 2));

            // Use segmentation mask for precise person silhouette (pixel[3] > 150 means solid person)
            if (pixel[3] > 150) {
              const distances = [
                { id: 'head', dist: distToHeadTop, pos: headTopPos },
                { id: 'forehead', dist: distToForehead, pos: foreheadPos },
                { id: 'ear-left', dist: distToEarL, pos: earLeftPos },
                { id: 'ear-right', dist: distToEarR, pos: earRightPos },
                { id: 'shoulder-left', dist: distToShoulderL, pos: shoulderLeftPos },
                { id: 'shoulder-right', dist: distToShoulderR, pos: shoulderRightPos }
              ];
              
              distances.sort((a, b) => a.dist - b.dist);
              const closest = distances[0];
              
              // Dynamic threshold based on face width to handle different distances from camera
              const faceWidth = Math.abs(earLeftPos.x - earRightPos.x) || 100;
              const maxDist = faceWidth * 1.5;
              
              // Stick to the closest part if it's within the dynamic radius
              if (closest.dist < maxDist) {
                p.stuckTo = closest.id as any;
                p.offset = { x: p.x - closest.pos.x, y: p.y - closest.pos.y };
              }
            }
          }
        }
      }
    });

    // Cleanup eggs
    eggRef.current = eggRef.current.filter(p => p.y < window.innerHeight + 100);

    // Remove food that falls off screen or bounces off user
    foodRef.current = foodRef.current.filter(f => {
      // Screen boundary bounce
      if (f.body.position.x < 0) {
        Matter.Body.setPosition(f.body, { x: 0, y: f.body.position.y });
        Matter.Body.setVelocity(f.body, { x: Math.abs(f.body.velocity.x) * 0.8, y: f.body.velocity.y });
      } else if (f.body.position.x > window.innerWidth) {
        Matter.Body.setPosition(f.body, { x: window.innerWidth, y: f.body.position.y });
        Matter.Body.setVelocity(f.body, { x: -Math.abs(f.body.velocity.x) * 0.8, y: f.body.velocity.y });
      }

      if (f.body.position.y > window.innerHeight + 100) {
        Matter.World.remove(engineRef.current.world, f.body);
        return false;
      }

      // User Collision Logic (Bouncing)
      if (maskCtx) {
        const mx = (1 - f.body.position.x / window.innerWidth) * maskCanvasRef.current!.width;
        const my = (f.body.position.y / window.innerHeight) * maskCanvasRef.current!.height;
        
        const pixel = maskCtx.getImageData(mx, my, 1, 1).data;
        if (pixel[3] > 50) { // If alpha > 50, it's the user
          // Apply immediate bounce force
          const bounceX = (f.body.position.x - window.innerWidth / 2) * 0.05;
          Matter.Body.setVelocity(f.body, { 
            x: f.body.velocity.x + (Math.random() - 0.5) * 5 + bounceX, 
            y: -Math.abs(f.body.velocity.y) * 0.8 - 5 
          });
        }
      }

      return true;
    });
  };

  const updateFish = (dt: number) => {
    const { palmPos, indexFingerTipPos, facePos, mode, isUserStill } = arStateRef.current;
    const time = performance.now();

    // Hover logic for TTS
    let currentlyHoveredFish: Fish | null = null;
    let minDistance = Infinity;

    if (indexFingerTipPos) {
      for (const f of fishRef.current) {
        const dx = f.x - indexFingerTipPos.x;
        const dy = f.y - indexFingerTipPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Check if within threshold and closer than previous found fish
        if (dist < f.size * 2 && dist < minDistance) {
          if ((mode === 'deep-sea' || mode === 'abyssal') && !DEEP_SEA_CREATURES.includes(f.type)) {
            continue;
          }
          minDistance = dist;
          currentlyHoveredFish = f;
        }
      }
    }

    if (currentlyHoveredFish) {
      // Check if the fish is allowed in the current mode
      const isDeepSeaFish = DEEP_SEA_CREATURES.includes(currentlyHoveredFish.type);
      const isNormalFish = NORMAL_CREATURES.includes(currentlyHoveredFish.type);
      const isAllowed = ((mode === 'deep-sea' || mode === 'abyssal') && isDeepSeaFish) || (mode === 'normal' && isNormalFish);

      if (isAllowed) {
        arStateRef.current.hoveredFishPos = { x: currentlyHoveredFish.x, y: currentlyHoveredFish.y };
        if (hoveredFishIdRef.current !== currentlyHoveredFish.id) {
          hoveredFishIdRef.current = currentlyHoveredFish.id;
          arStateRef.current.hoveredFishId = currentlyHoveredFish.id;
          hoverStartTimeRef.current = time;
          hasTriggeredHoverActionRef.current = false;
        } else if (time - hoverStartTimeRef.current > 300 && !hasTriggeredHoverActionRef.current) {
          hasTriggeredHoverActionRef.current = true;
          
          // Update Task Progress
          const task = arStateRef.current.currentTask;
          if (task && !task.completed && task.type === 'discovery') {
            if (!task.discoveredFishTypes.includes(currentlyHoveredFish.type)) {
              const newDiscovered = [...task.discoveredFishTypes, currentlyHoveredFish.type];
              const newCount = newDiscovered.length;
              const isCompleted = newCount >= task.targetCount;
              
              const updatedTask = {
                ...task,
                discoveredFishTypes: newDiscovered,
                currentCount: newCount,
                completed: isCompleted
              };
              
              arStateRef.current.currentTask = updatedTask;

              // If completed, move to next task after a delay
              if (isCompleted) {
                setTimeout(() => {
                  const nextTaskIndex = TASKS.findIndex(t => t.id === task.id) + 1;
                  if (nextTaskIndex < TASKS.length) {
                    arStateRef.current.currentTask = TASKS[nextTaskIndex];
                  }
                }, 3000);
              }
            }
          }
        }
      } else {
        hoveredFishIdRef.current = null;
        arStateRef.current.hoveredFishId = null;
        arStateRef.current.hoveredFishPos = null;
        hasTriggeredHoverActionRef.current = false;
      }
    } else {
      hoveredFishIdRef.current = null;
      arStateRef.current.hoveredFishId = null;
      arStateRef.current.hoveredFishPos = null;
      hasTriggeredHoverActionRef.current = false;
    }

    // Dynamic Spawning Logic removed - population is now fixed at 20
    
    fishRef.current.forEach((f, index) => {
      if (f.state === 'caught') {
        f.vx = 0;
        f.vy = 0;
        return;
      }
      const config = FISH_CONFIG[f.type];
      let speed = (mode === 'deep-sea' || mode === 'abyssal') ? config.speed * 0.5 : config.speed;

      // Update cooldown
      if (f.spawnCooldown > 0) f.spawnCooldown -= dt;

      // Environmental Escape Logic (Normal Mode)
      const isHighlyPolluted = mode === 'normal' && arStateRef.current.pollutionLevel > 0.3;

      // 0. Scared Logic
      if (shakeIntensityRef.current > 0.8 || isHighlyPolluted) {
        if (isHighlyPolluted && f.state !== 'scared') {
          f.state = 'scared';
          f.scaredTimer = 2000;
        }

        if (f.type === 'squid' && f.state !== 'scared') {
          // Spawn multiple ink clouds for a better effect
          for (let i = 0; i < 5; i++) {
            inkCloudsRef.current.push({
              id: Math.random().toString(),
              x: f.x + (Math.random() - 0.5) * 20,
              y: f.y + (Math.random() - 0.5) * 20,
              vx: (Math.random() - 0.5) * 1,
              vy: (Math.random() - 0.5) * 1,
              size: 40 + Math.random() * 40,
              opacity: 0.9,
              timer: 3000 + Math.random() * 1500,
            });
          }
          
          // Initial strong dash away from center
          const centerX = facePos ? facePos.x : window.innerWidth / 2;
          const centerY = facePos ? facePos.y : window.innerHeight / 2;
          const dx = f.x - centerX;
          const dy = f.y - centerY;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          
          f.vx = (dx / dist) * 25 + (Math.random() - 0.5) * 10;
          f.vy = (dy / dist) * 25 + (Math.random() - 0.5) * 10;
        }
        
        if (!isHighlyPolluted) {
          f.scaredTimer = 6000 + Math.random() * 4000; // Scared for 6-10 seconds
          f.state = 'scared';
        }
      }

      if (f.scaredTimer > 0 || isHighlyPolluted) {
        if (f.scaredTimer > 0) f.scaredTimer -= dt;
        
        if (f.scaredTimer <= 0 && !isHighlyPolluted) {
          f.state = 'idle';
          // Wander randomly instead of swimming right back to the user
          f.targetX = Math.random() * window.innerWidth;
          f.targetY = Math.random() * window.innerHeight;
        } else {
          // Scatter outwards from the center of the screen or face
          let centerX = facePos ? facePos.x : window.innerWidth / 2;
          let centerY = facePos ? facePos.y : window.innerHeight / 2;
          
          if (isHighlyPolluted) {
             // Flee towards screen edges
             centerX = window.innerWidth / 2;
             centerY = window.innerHeight / 2;
          }

          const dx = f.x - centerX;
          const dy = f.y - centerY;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          
          // Squid dashes much faster when scared
          const escapeForce = (f.type === 'squid' || isHighlyPolluted) ? 4.0 : 2.0;
          f.vx += (dx / dist) * escapeForce;
          f.vy += (dy / dist) * escapeForce;
          
          // Add some randomness to flee direction
          f.vx += (Math.random() - 0.5) * (f.type === 'squid' ? 3.0 : 1.0);
          f.vy += (Math.random() - 0.5) * (f.type === 'squid' ? 3.0 : 1.0);
          
          // Add friction to squid dash so it doesn't fly off screen instantly
          if (f.type === 'squid' || isHighlyPolluted) {
            f.vx *= 0.95;
            f.vy *= 0.95;
          }
          
          if (isHighlyPolluted) {
             // Keep swimming outwards effectively
             f.targetX = f.x + f.vx * 10;
             f.targetY = f.y + f.vy * 10;
             
             // Speed up significantly to escape
             const fleeSpeed = config.speed * 3.5;
             const currFleeSpeed = Math.sqrt(f.vx * f.vx + f.vy * f.vy);
             if (currFleeSpeed > fleeSpeed) {
                f.vx = (f.vx / currFleeSpeed) * fleeSpeed;
                f.vy = (f.vy / currFleeSpeed) * fleeSpeed;
             }
             
             f.x += f.vx;
             f.y += f.vy;
             f.rotation = Math.atan2(f.vy, f.vx);
             return; // Skip remaining behavior
          }
        }
      }

      // 0. Pause Logic
      if (f.pauseTimer > 0) {
        f.pauseTimer -= dt;
        f.vx *= 0.95;
        f.vy *= 0.95;
        f.x += f.vx;
        f.y += f.vy;
        f.rotation = Math.atan2(f.vy, f.vx);
        return;
      }

      // Separation logic to prevent clustering
      const minSeparation = f.size * 1.5;
      let separationX = 0;
      let separationY = 0;
      let separationCount = 0;

      fishRef.current.forEach((other, otherIndex) => {
        if (index === otherIndex) return;
        const dx = f.x - other.x;
        const dy = f.y - other.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < minSeparation * minSeparation && distSq > 0) {
          const dist = Math.sqrt(distSq);
          separationX += dx / dist;
          separationY += dy / dist;
          separationCount++;
        }
      });

      if (separationCount > 0) {
        f.vx += (separationX / separationCount) * 0.2;
        f.vy += (separationY / separationCount) * 0.2;
      }

      // Behavior logic
      let tx = f.targetX;
      let ty = f.targetY;
      let forceMultiplier = 0.25; // Increased responsiveness

      // Meandering logic
      let wanderStrength = f.state === 'idle' ? 0.4 : 0.15;
      if ((mode === 'deep-sea' || mode === 'abyssal') && isUserStill) {
        wanderStrength *= 0.5; // Gentler wandering in deep-sea
      }
      f.wanderAngle += (Math.random() - 0.5) * 0.3;
      f.vx += Math.cos(f.wanderAngle) * wanderStrength;
      f.vy += Math.sin(f.wanderAngle) * wanderStrength;

      // Special movement for box jellyfish
      if (f.type === 'boxjellyfish') {
        // Pulsing motion
        const pulse = Math.sin(time * 0.01) * 0.5;
        f.vx += pulse * 0.1;
        f.vy += pulse * 0.1;
        // More directed movement
        f.vx += (f.targetX - f.x) * 0.001;
        f.vy += (f.targetY - f.y) * 0.001;
      }

      // Occasional pause
      if (f.state === 'idle' && Math.random() < 0.003) {
        f.pauseTimer = 800 + Math.random() * 1200;
      }

      // 1. Food Attraction Logic
      let closestFood: Food | null = null;
      let minDist = 300; // Attraction radius

      foodRef.current.forEach(food => {
        const dx = food.body.position.x - f.x;
        const dy = food.body.position.y - f.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          minDist = dist;
          closestFood = food;
        }
      });

      if (f.state === 'scared') {
        // Handled in scared logic above, but we need to set target away
        tx = f.x + f.vx * 100;
        ty = f.y + f.vy * 100;
        forceMultiplier = 0.8;
        speed = config.speed * 4.0; // Swim much faster when scared
      } else if (closestFood) {
        tx = (closestFood as Food).body.position.x;
        ty = (closestFood as Food).body.position.y;
        f.state = 'feeding';

        // Eating logic
        if (minDist < f.size / 2 + 5) {
          const foodToEat = closestFood as Food;
          foodRef.current = foodRef.current.filter(item => item.id !== foodToEat.id);
          Matter.World.remove(engineRef.current.world, foodToEat.body);
          f.state = 'happy';
          arStateRef.current.interactionTime += 0.5;
          return;
        }
      } else if (f.state === 'spawning') {
        // Stop spawning if we switch to deep-sea mode
        if (mode === 'deep-sea' || mode === 'abyssal') {
          f.state = 'idle';
          f.spawningTimer = 0;
          return;
        }

        if (facePos) {
          tx = facePos.x + Math.sin(time * 0.002 + index) * 30;
          ty = facePos.y - 150 + Math.cos(time * 0.002 + index) * 20;
          forceMultiplier = 0.15;
        } else {
          tx = f.x;
          ty = f.y;
          forceMultiplier = 0.05;
        }
        f.spawningTimer -= dt;
        if (f.spawningTimer <= 0) {
          // Spawn eggs - even more rare
          const eggCount = Math.random() > 0.6 ? 1 : 0;
          for (let i = 0; i < eggCount; i++) {
            eggRef.current.push({
              id: Math.random().toString(),
              x: f.x,
              y: f.y,
              vx: (Math.random() - 0.5) * 3,
              vy: 0.5 + Math.random() * 2,
              stuckTo: null,
              offset: { x: 0, y: 0 }
            });
          }
          f.state = 'idle'; // Go back to idle after spawning
          f.spawningTimer = 0;
          f.spawnCooldown = 180000; // Extended cooldown to 3 minutes
        }
      } else if (f.state === 'resting' && facePos) {
        // Chance to start spawning if resting and cooldown is over
        // Only spawn in normal mode
        if (f.spawnCooldown <= 0 && mode === 'normal') {
          let spawnChance = 0.02;
          if (isUserStill) spawnChance = 0.05; 

          if (Math.random() < spawnChance) {
            f.state = 'spawning';
            f.spawningTimer = 4000; // Spawning process takes slightly longer
          }
        }
        
        // Chance to stop resting - reduced to keep them there longer
        if (Math.random() < 0.0005) {
          f.state = 'idle';
        }

        // Target head or shoulders
        const spot = index % 3;
        if (spot === 0) { // Head
          tx = facePos.x + Math.sin(time * 0.001 + index) * 50;
          ty = facePos.y - 120 + Math.cos(time * 0.001 + index) * 20;
        } else if (spot === 1) { // Left shoulder
          tx = facePos.x - 180 + Math.sin(time * 0.001 + index) * 40;
          ty = facePos.y + 150 + Math.cos(time * 0.001 + index) * 30;
        } else { // Right shoulder
          tx = facePos.x + 180 + Math.sin(time * 0.001 + index) * 40;
          ty = facePos.y + 150 + Math.cos(time * 0.001 + index) * 30;
        }
        forceMultiplier = 0.1;
      } else if (f.type === 'clownfish' && mode === 'normal' && f.state === 'perching' && f.perchedOnCoralId) {
        const coral = coralsRef.current.find(c => c.id === f.perchedOnCoralId);
        if (coral) {
          tx = coral.x + Math.sin(time * 0.001 + index) * 10;
          ty = coral.y - coral.size * 0.4 + Math.cos(time * 0.001 + index) * 5;
          forceMultiplier = 0.1;
          if (Math.random() < 0.002) {
            f.state = 'idle';
            f.perchedOnCoralId = undefined;
          }
        } else {
          f.state = 'idle';
          f.perchedOnCoralId = undefined;
        }
      } else if (palmPos) {
        tx = palmPos.x;
        ty = palmPos.y;
        f.state = 'feeding';
      } else {
        f.state = 'idle';

        // Clownfish perching chance
        if (f.type === 'clownfish' && mode === 'normal' && Math.random() < 0.01) {
          const nearbyCoral = coralsRef.current.find(c => {
            const dx = c.x - f.x;
            const dy = c.y - f.y;
            return Math.sqrt(dx * dx + dy * dy) < 250;
          });
          if (nearbyCoral) {
            f.state = 'perching';
            f.perchedOnCoralId = nearbyCoral.id;
            f.z = 1; // Ensure it's in front of the user when perching
          }
        }

        // Randomly decide to go rest/spawn on user only if user is still
        if (facePos && isUserStill && Math.random() < 0.005) {
          f.state = 'resting';
        }
        
        // Update target occasionally
        if (Math.random() * 100 < 2) {
          if (facePos && isUserStill) {
            // Gather around the user only when they are still
            f.targetX = facePos.x + (Math.random() - 0.5) * 800;
            f.targetY = facePos.y + (Math.random() - 0.5) * 600;
          } else {
            // Otherwise wander the whole screen (keeps them away if user is moving)
            f.targetX = Math.random() * window.innerWidth;
            f.targetY = Math.random() * window.innerHeight;
          }
        }
      }

      const dx = tx - f.x;
      const dy = ty - f.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Jellyfish Pulsing Movement
      if (f.type === 'jellyfish') {
        let pulseSpeed = 0.0015;
        
        // Refined behavior for deep-sea mode when user is still
        const isDeepSeaStill = (mode === 'deep-sea' || mode === 'abyssal') && isUserStill;
        if (isDeepSeaStill) {
          pulseSpeed = 0.0007; // Slower, more rhythmic pulsing
        }
        
        // Asymmetric pulse: fast contraction, slow expansion
        const pulseTime = (time * pulseSpeed + parseInt(f.id, 36) * 0.1) % (Math.PI * 2);
        const isThrusting = pulseTime < Math.PI * 0.4; // Short thrust phase
        
        if (isThrusting) {
          // During thrust, jellyfish move towards target
          forceMultiplier = isDeepSeaStill ? 0.25 : 0.6;
          speed = isDeepSeaStill ? config.speed * 1.5 : config.speed * 4;
        } else {
          // During recovery, they drift and slow down
          forceMultiplier = isDeepSeaStill ? 0.015 : 0.05; // Gentle, drifting movement
          speed = config.speed * 0.5;
        }
      }

      if (dist > 5) {
        f.vx += (dx / dist) * forceMultiplier;
        f.vy += (dy / dist) * forceMultiplier;
      }

      // Friction
      f.vx *= 0.98;
      f.vy *= 0.98;

      // Max speed
      const currSpeed = Math.sqrt(f.vx * f.vx + f.vy * f.vy);
      if (currSpeed > speed) {
        f.vx = (f.vx / currSpeed) * speed;
        f.vy = (f.vy / currSpeed) * speed;
      }

      f.x += f.vx;
      f.y += f.vy;
      f.rotation = Math.atan2(f.vy, f.vx);

      const isAnglerfishInNormalMode = mode === 'normal' && f.type === 'anglerfish';

      if (!isAnglerfishInNormalMode && !isHighlyPolluted) {
        if (f.x < -150) {
          f.x = window.innerWidth + 150;
        } else if (f.x > window.innerWidth + 150) {
          f.x = -150;
        }

        if (f.y < -150) {
          f.y = window.innerHeight + 150;
        } else if (f.y > window.innerHeight + 150) {
          f.y = -150;
        }
      } else if (isAnglerfishInNormalMode) {
        // Anglerfish in normal mode swims away to disappear
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const dx = f.x - centerX;
        const dy = f.y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        f.vx += (dx / dist) * 0.5;
        f.vy += (dy / dist) * 0.5;
      }
      // If isHighlyPolluted is true, we simply don't wrap, letting them stay exported.
    });

    // Remove anglerfish filtering - population is fixed
    fishRef.current = fishRef.current;

    // Update ink clouds
    inkCloudsRef.current.forEach(ink => {
      ink.timer -= dt;
      if (ink.timer < 2000) {
        ink.opacity = Math.max(0, ink.timer / 2000) * 0.9;
      }
      // Move ink cloud
      ink.x += ink.vx;
      ink.y += ink.vy;
      // Add friction to slow down ink cloud
      ink.vx *= 0.98;
      ink.vy *= 0.98;
      // Slowly expand
      ink.size += dt * 0.02;
    });
    inkCloudsRef.current = inkCloudsRef.current.filter(ink => ink.timer > 0);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!canvas || !maskCanvas || !videoRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { mode, isPinching, pinchPos, indexFingerTipPos } = arStateRef.current;

    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Only clear, don't re-allocate width/height every frame
    ctx.clearRect(0, 0, width, height);

    // 1. Draw Background (Webcam)
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(videoRef.current, -width, 0, width, height);
    ctx.restore();

    // 1.5 Draw Pollution Tint (Seawater turning green)
    if (pollutionAlphaRef.current > 0.01) {
      ctx.save();
      // Use a mix of green and yellow-brown for a "polluted" look
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, `rgba(46, 139, 87, ${pollutionAlphaRef.current * 0.7})`); // SeaGreen
      grad.addColorStop(1, `rgba(85, 107, 47, ${pollutionAlphaRef.current})`); // DarkOliveGreen
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      
      // Add some "murkiness" with a slight overlay
      ctx.fillStyle = `rgba(0, 50, 0, ${pollutionAlphaRef.current * 0.2})`;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    if (mode === 'deep-sea' || mode === 'abyssal') {
      const grad = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width);
      if (mode === 'abyssal') {
        grad.addColorStop(0, 'rgba(0, 5, 10, 0.92)');
        grad.addColorStop(1, 'rgba(0, 0, 5, 0.98)');
      } else {
        grad.addColorStop(0, 'rgba(10, 25, 47, 0.85)');
        grad.addColorStop(1, 'rgba(2, 12, 27, 0.95)');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      
      // Draw some glowing particles
      for (let i = 0; i < (mode === 'abyssal' ? 20 : 50); i++) {
        const x = (Math.sin(performance.now() * 0.001 + i) * 0.5 + 0.5) * width;
        const y = (Math.cos(performance.now() * 0.0008 + i) * 0.5 + 0.5) * height;
        ctx.fillStyle = 'rgba(100, 200, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(x, y, Math.random() * 2 + 1, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Ambient Underwater Bubbles for normal mode
      const time = performance.now();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      for (let i = 0; i < 20; i++) {
        const x = (Math.sin(i * 123.45) * 0.5 + 0.5) * width;
        const speed = 0.02 + (i % 5) * 0.01;
        const y = height - ((time * speed + i * 100) % height);
        const wobble = Math.sin(time * 0.002 + i) * 10;
        ctx.beginPath();
        ctx.arc(x + wobble, y, 2 + (i % 4), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 2. Draw "Behind" Fish (z = 0)
    drawFish(ctx, 0);

    // 3. Draw User Mask (Occlusion)
    if (mode === 'normal') {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(maskCanvas, -width, 0, width, height);
      ctx.globalCompositeOperation = 'destination-over';
      ctx.drawImage(videoRef.current, -width, 0, width, height);
      ctx.restore();

      // Draw Diving Mask
      drawDivingMask(ctx, width, height);

      // 3.5 Draw Corals (Normal Mode) - Draw after occlusion so they are in front of the user
      drawCorals(ctx);
    }

    // 4. Draw "Front" Fish (z = 1)
    drawFish(ctx, 1);

    // 5. Draw Food
    if (mode !== 'deep-sea') {
      ctx.fillStyle = '#FFD700';
      foodRef.current.forEach(f => {
        ctx.beginPath();
        ctx.arc(f.body.position.x, f.body.position.y, 5, 0, Math.PI * 2);
        ctx.fill();
        // Glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#FFD700';
      });
      ctx.shadowBlur = 0;
    }

    // 6. Draw Eggs
    if (mode !== 'deep-sea') {
      drawTrash(ctx);
      eggRef.current.forEach(p => {
          ctx.save();
          
          let drawX = p.x;
          let drawY = p.y;

          // Cartoon Fish Egg Style
          const radius = p.stuckTo ? 7 : 6;
          const isCleanupTask = arStateRef.current.currentTask?.type === 'cleanup';
          const grad = ctx.createRadialGradient(drawX - radius/3, drawY - radius/3, 0, drawX, drawY, radius);
          
          if (isCleanupTask) {
            // Parasite look: greenish/darker
            if (p.stuckTo) {
              grad.addColorStop(0, 'rgba(100, 255, 100, 0.9)');
              grad.addColorStop(0.6, 'rgba(50, 150, 50, 0.6)');
              grad.addColorStop(1, 'rgba(20, 80, 20, 0.3)');
            } else {
              grad.addColorStop(0, 'rgba(150, 255, 150, 0.8)');
              grad.addColorStop(0.5, 'rgba(100, 200, 100, 0.4)');
              grad.addColorStop(1, 'rgba(50, 150, 50, 0.2)');
            }
          } else {
            if (p.stuckTo) {
              // Sticky look: slightly more opaque and flattened
              grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
              grad.addColorStop(0.6, 'rgba(255, 182, 193, 0.6)'); // Pinkish tint for stickiness
              grad.addColorStop(1, 'rgba(255, 105, 180, 0.3)');
            } else {
              grad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
              grad.addColorStop(0.5, 'rgba(173, 216, 230, 0.4)');
              grad.addColorStop(1, 'rgba(100, 149, 237, 0.2)');
            }
          }
          
          ctx.beginPath();
          if (p.stuckTo) {
            // Slightly flattened when stuck
            ctx.ellipse(drawX, drawY, radius * 1.1, radius * 0.9, 0, 0, Math.PI * 2);
          } else {
            ctx.arc(drawX, drawY, radius, 0, Math.PI * 2);
          }
          ctx.fillStyle = grad;
          ctx.fill();
          
          // Nucleus
          ctx.beginPath();
          ctx.arc(drawX + radius/4, drawY + radius/4, radius/3, 0, Math.PI * 2);
          ctx.fillStyle = isCleanupTask ? 'rgba(0, 50, 0, 0.6)' : 'rgba(0, 0, 0, 0.4)';
          ctx.fill();
          
          // Sticky residue / Glisten
          if (p.stuckTo) {
            ctx.beginPath();
            ctx.arc(drawX - radius/2, drawY - radius/2, 2, 0, Math.PI * 2);
            ctx.fillStyle = isCleanupTask ? 'rgba(200, 255, 200, 0.8)' : 'rgba(255, 255, 255, 0.8)';
            ctx.fill();
          }
          
          // Stronger glow
          ctx.shadowBlur = p.stuckTo ? 25 : 15;
          if (isCleanupTask) {
            ctx.shadowColor = p.stuckTo ? '#32CD32' : '#006400';
            ctx.strokeStyle = p.stuckTo ? 'rgba(50, 205, 50, 0.6)' : 'rgba(0, 100, 0, 0.5)';
          } else {
            ctx.shadowColor = p.stuckTo ? '#FF69B4' : '#00FFFF'; 
            ctx.strokeStyle = p.stuckTo ? 'rgba(255, 105, 180, 0.6)' : 'rgba(0, 255, 255, 0.5)';
          }
          ctx.lineWidth = p.stuckTo ? 2 : 1;
          ctx.stroke();
          ctx.restore();
        });
        ctx.shadowBlur = 0;
      }

    // 6.5 Draw Ink Clouds
    if (mode !== 'deep-sea') {
      inkCloudsRef.current.forEach(ink => {
        ctx.save();
        const grad = ctx.createRadialGradient(ink.x, ink.y, 0, ink.x, ink.y, ink.size);
        grad.addColorStop(0, `rgba(0, 0, 0, ${ink.opacity})`);
        grad.addColorStop(0.5, `rgba(0, 0, 0, ${ink.opacity * 0.8})`);
        grad.addColorStop(1, `rgba(0, 0, 0, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(ink.x, ink.y, ink.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    // 7. Draw Pinch Indicator
    if (isPinching && pinchPos && mode !== 'deep-sea') {
      const { x, y } = pinchPos;
      
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 215, 0, 0.8)';
      ctx.fill();
      ctx.restore();
    }

    // 8. Draw Index Finger Tip Indicator
    if (indexFingerTipPos) {
      const { x, y } = indexFingerTipPos;
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // 9. Draw Fist Indicator (Visual Feedback for Cleanup)
    const { isFist, palmPos } = arStateRef.current;
    if (isFist && palmPos) {
      const { x, y } = palmPos;
      ctx.save();
      
      // Outer glow
      const grad = ctx.createRadialGradient(x, y, 0, x, y, 40);
      grad.addColorStop(0, 'rgba(255, 50, 50, 0.4)');
      grad.addColorStop(1, 'rgba(255, 50, 50, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, 40, 0, Math.PI * 2);
      ctx.fill();

      // Inner ring
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 100, 100, 0.8)';
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // Pulse effect
      const pulse = Math.sin(performance.now() * 0.01) * 5;
      ctx.beginPath();
      ctx.arc(x, y, 20 + pulse, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 100, 100, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      ctx.restore();
    }
  };

  const drawTrash = (ctx: CanvasRenderingContext2D) => {
    trashRef.current.forEach(t => {
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.rotation);
      
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      switch (t.type) {
        case 'bottle':
          // Plastic bottle
          ctx.fillStyle = 'rgba(173, 216, 230, 0.5)';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.beginPath();
          ctx.roundRect(-t.size/4, -t.size/2, t.size/2, t.size, 5);
          ctx.fill();
          ctx.stroke();
          // Neck
          ctx.beginPath();
          ctx.rect(-t.size/8, -t.size/2 - 8, t.size/4, 8);
          ctx.fill();
          ctx.stroke();
          // Cap
          ctx.fillStyle = '#3b82f6';
          ctx.fillRect(-t.size/6, -t.size/2 - 12, t.size/3, 6);
          break;
        case 'bag':
          // Plastic bag
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.beginPath();
          ctx.moveTo(-t.size/2, -t.size/2);
          ctx.quadraticCurveTo(0, -t.size/1.5, t.size/2, -t.size/2);
          ctx.lineTo(t.size/2, t.size/2);
          ctx.quadraticCurveTo(0, t.size/1.2, -t.size/2, t.size/2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Handles
          ctx.beginPath();
          ctx.ellipse(-t.size/4, -t.size/2, 5, 10, 0, 0, Math.PI * 2);
          ctx.ellipse(t.size/4, -t.size/2, 5, 10, 0, 0, Math.PI * 2);
          ctx.stroke();
          break;
        case 'can':
          // Aluminum can
          ctx.fillStyle = '#94a3b8';
          ctx.strokeStyle = '#475569';
          ctx.beginPath();
          ctx.roundRect(-t.size/3, -t.size/2, t.size/1.5, t.size, 4);
          ctx.fill();
          ctx.stroke();
          // Label
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(-t.size/3, -t.size/6, t.size/1.5, t.size/3);
          // Top rim
          ctx.strokeStyle = '#cbd5e1';
          ctx.beginPath();
          ctx.ellipse(0, -t.size/2, t.size/3, 4, 0, 0, Math.PI * 2);
          ctx.stroke();
          break;
        case 'straw':
          // Plastic straw
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(-t.size/2, 0);
          ctx.lineTo(t.size/2, 0);
          ctx.stroke();
          // Stripes
          ctx.strokeStyle = '#fff';
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
          break;
        case 'mask':
          // Surgical mask
          ctx.fillStyle = '#7dd3fc';
          ctx.strokeStyle = '#f1f5f9';
          ctx.beginPath();
          ctx.roundRect(-t.size/2, -t.size/4, t.size, t.size/2, 2);
          ctx.fill();
          ctx.stroke();
          // Folds
          ctx.beginPath();
          ctx.moveTo(-t.size/2, -t.size/12);
          ctx.lineTo(t.size/2, -t.size/12);
          ctx.moveTo(-t.size/2, t.size/12);
          ctx.lineTo(t.size/2, t.size/12);
          ctx.stroke();
          // Straps
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(-t.size/2, -t.size/4);
          ctx.lineTo(-t.size/2 - 8, -t.size/4 - 4);
          ctx.moveTo(-t.size/2, t.size/4);
          ctx.lineTo(-t.size/2 - 8, t.size/4 + 4);
          ctx.moveTo(t.size/2, -t.size/4);
          ctx.lineTo(t.size/2 + 8, -t.size/4 - 4);
          ctx.moveTo(t.size/2, t.size/4);
          ctx.lineTo(t.size/2 + 8, t.size/4 + 4);
          ctx.stroke();
          break;
      }
      ctx.restore();
    });
  };

  const drawDivingMask = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const { faceLandmarks } = arStateRef.current;
    if (!faceLandmarks || faceLandmarks.length === 0) return;

    // Get key landmarks (MediaPipe Face Mesh)
    const getPoint = (idx: number) => ({
      x: (1 - faceLandmarks[idx].x) * width,
      y: faceLandmarks[idx].y * height
    });

    // 33 is left eye outer (user's left, screen right)
    // 263 is right eye outer (user's right, screen left)
    const leftEye = getPoint(33); 
    const rightEye = getPoint(263); 
    const nose = getPoint(1);
    const leftCheek = getPoint(234);
    const rightCheek = getPoint(454);

    // Calculate mask dimensions and rotation
    const centerX = (leftCheek.x + rightCheek.x) / 2;
    const centerY = (leftEye.y + rightEye.y) / 2 + (nose.y - leftEye.y) * 0.3;
    
    const maskWidth = Math.sqrt(Math.pow(rightCheek.x - leftCheek.x, 2) + Math.pow(rightCheek.y - leftCheek.y, 2)) * 1.15;
    const maskHeight = maskWidth * 0.65;
    
    // Correct angle calculation: vector from right eye (screen left) to left eye (screen right)
    const angle = Math.atan2(leftEye.y - rightEye.y, leftEye.x - rightEye.x);

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(angle);

    // 1. Draw Straps (behind head)
    ctx.beginPath();
    ctx.moveTo(-maskWidth * 0.6, -maskHeight * 0.1);
    ctx.lineTo(-maskWidth * 0.9, -maskHeight * 0.2);
    ctx.moveTo(maskWidth * 0.6, -maskHeight * 0.1);
    ctx.lineTo(maskWidth * 0.9, -maskHeight * 0.2);
    ctx.lineWidth = maskHeight * 0.15;
    ctx.strokeStyle = '#1e293b'; // Slate 800
    ctx.lineCap = 'round';
    ctx.stroke();

    // 2. Silicone Skirt (Outer soft part)
    const r = maskHeight * 0.3;
    const w = maskWidth;
    const h = maskHeight;
    const x = -w / 2;
    const y = -h / 2;
    const nw = w * 0.22;
    const nh = h * 0.35;
    
    ctx.save();
    ctx.beginPath();
    // Outer bounds for clipping (much larger than mask)
    ctx.rect(-w * 2, -h * 2, w * 4, h * 4);
    
    // Inner hole (same as main frame)
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    
    // Nose pocket
    ctx.lineTo(nw/2 + 8, y + h);
    ctx.lineTo(nw/2, y + h - nh);
    ctx.quadraticCurveTo(0, y + h - nh - 10, -nw/2, y + h - nh);
    ctx.lineTo(-nw/2 - 8, y + h);
    
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
    
    // Clip using evenodd so the inner hole is excluded
    ctx.clip('evenodd');

    // Now draw the silicone skirt
    ctx.beginPath();
    ctx.ellipse(0, 0, maskWidth * 0.52, maskHeight * 0.52, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'; // Dark silicone
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#334155';
    ctx.stroke();
    ctx.restore(); // Remove the clip

    // 3. Main Frame
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    
    // Nose pocket
    ctx.lineTo(nw/2 + 8, y + h);
    ctx.lineTo(nw/2, y + h - nh);
    ctx.quadraticCurveTo(0, y + h - nh - 10, -nw/2, y + h - nh);
    ctx.lineTo(-nw/2 - 8, y + h);
    
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();

    // Frame styling
    const frameGrad = ctx.createLinearGradient(0, y, 0, y + h);
    frameGrad.addColorStop(0, '#0ea5e9'); // Sky blue
    frameGrad.addColorStop(1, '#0369a1'); // Darker blue
    ctx.lineWidth = 18; // Draw as a thick border instead of a solid fill
    ctx.strokeStyle = frameGrad;
    ctx.stroke();
    
    // Frame inner highlight
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#38bdf8';
    ctx.stroke();

    // 4. Glass Lens
    ctx.beginPath();
    const gx = x + 10;
    const gy = y + 10;
    const gw = w - 20;
    const gh = h - 20;
    const gr = r * 0.7;
    
    ctx.moveTo(gx + gr, gy);
    ctx.lineTo(gx + gw - gr, gy);
    ctx.arcTo(gx + gw, gy, gx + gw, gy + gh, gr);
    ctx.lineTo(gx + gw, gy + gh - gr);
    ctx.arcTo(gx + gw, gy + gh, gx + gw - gr, gy + gh, gr);
    
    // Inner nose pocket for glass
    const gnw = nw - 4;
    const gnh = nh - 4;
    ctx.lineTo(gnw/2 + 6, gy + gh);
    ctx.lineTo(gnw/2, gy + gh - gnh);
    ctx.quadraticCurveTo(0, gy + gh - gnh - 8, -gnw/2, gy + gh - gnh);
    ctx.lineTo(-gnw/2 - 6, gy + gh);
    
    ctx.lineTo(gx + gr, gy + gh);
    ctx.arcTo(gx, gy + gh, gx, gy + gh - gr, gr);
    ctx.lineTo(gx, gy + gr);
    ctx.arcTo(gx, gy, gx + gr, gy, gr);
    ctx.closePath();
    
    // Glass tint
    ctx.fillStyle = 'rgba(59, 130, 246, 0.35)'; // Blue transparent glass tint
    ctx.fill();
    
    // Glass reflection
    ctx.save();
    ctx.clip(); // Clip to glass area
    ctx.beginPath();
    ctx.moveTo(gx - 50, gy - 50);
    ctx.lineTo(gx + gw * 0.6, gy - 50);
    ctx.lineTo(gx + gw * 0.3, gy + gh + 50);
    ctx.lineTo(gx - 50, gy + gh + 50);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fill();
    
    // Second smaller reflection
    ctx.beginPath();
    ctx.moveTo(gx + gw * 0.7, gy - 50);
    ctx.lineTo(gx + gw * 0.85, gy - 50);
    ctx.lineTo(gx + gw * 0.55, gy + gh + 50);
    ctx.lineTo(gx + gw * 0.4, gy + gh + 50);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fill();
    ctx.restore();

    // 5. Snorkel Tube (Left side of screen -> user's right side)
    const tx = -maskWidth / 2 - 15;
    
    // Snorkel lower corrugated part
    ctx.beginPath();
    ctx.moveTo(tx + 10, h * 0.2);
    ctx.quadraticCurveTo(tx - 20, h * 0.4, tx - 10, h * 0.6);
    ctx.lineWidth = maskWidth * 0.09;
    ctx.strokeStyle = '#334155';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Mouthpiece
    ctx.beginPath();
    ctx.moveTo(tx - 10, h * 0.6);
    ctx.lineTo(0, h * 0.65); // Towards mouth
    ctx.lineWidth = maskWidth * 0.05;
    ctx.strokeStyle = '#0f172a';
    ctx.stroke();

    // Main tube (going UP)
    ctx.beginPath();
    ctx.moveTo(tx + 10, h * 0.2);
    ctx.lineTo(tx + 15, -h * 1.5);
    ctx.lineWidth = maskWidth * 0.08;
    
    // Tube gradient
    const tubeGrad = ctx.createLinearGradient(tx, 0, tx + 30, 0);
    tubeGrad.addColorStop(0, '#e2e8f0');
    tubeGrad.addColorStop(0.5, '#ffffff');
    tubeGrad.addColorStop(1, '#94a3b8');
    ctx.strokeStyle = tubeGrad;
    ctx.stroke();
    
    // Splash guard (top of snorkel)
    ctx.beginPath();
    ctx.moveTo(tx + 5, -h * 1.5);
    ctx.lineTo(tx + 25, -h * 1.5);
    ctx.lineTo(tx + 28, -h * 1.7);
    ctx.lineTo(tx + 2, -h * 1.7);
    ctx.closePath();
    ctx.fillStyle = '#f97316'; // Bright orange
    ctx.fill();
    
    // Splash guard details
    ctx.beginPath();
    ctx.moveTo(tx + 5, -h * 1.6);
    ctx.lineTo(tx + 25, -h * 1.6);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#111827';
    ctx.stroke();

    // Snorkel Bubbles (going UP from the top of the snorkel)
    const time = performance.now();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    for (let i = 0; i < 4; i++) {
      // Bubbles rise upwards (negative Y)
      const bubbleY = (time * 0.06 + i * 25) % 80;
      const bubbleX = Math.sin(time * 0.004 + i) * 8;
      ctx.beginPath();
      ctx.arc(tx + 15 + bubbleX, -h * 1.7 - bubbleY, 3 + (i % 4), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  const drawCorals = (ctx: CanvasRenderingContext2D) => {
    const isBleached = arStateRef.current.isBleached;
    coralsRef.current.forEach(coral => {
      const coralColor = isBleached ? '#FFFFFF' : coral.color;
      ctx.save();
      ctx.translate(coral.x, coral.y);
      
      // Draw base/shadow
      const baseGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 25);
      baseGrad.addColorStop(0, 'rgba(0,0,0,0.3)');
      baseGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = baseGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, 30, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      if (coral.type === 3) {
        // Fan/Shell style - Solid shape
        ctx.save();
        const time = performance.now() * 0.001;
        const sway = Math.sin(time + coral.id.length) * 0.05;
        ctx.rotate(sway);

        ctx.beginPath();
        ctx.moveTo(0, 0);
        
        const startAngle = -Math.PI * 0.85;
        const endAngle = -Math.PI * 0.15;
        const segments = 30;
        
        for (let i = 0; i <= segments; i++) {
          const t = i / segments;
          const angle = startAngle + t * (endAngle - startAngle);
          // Add some organic waviness to the edge
          const wave = Math.sin(t * Math.PI * 4 + time * 2) * 5;
          const r = coral.size * (0.9 + Math.sin(t * Math.PI) * 0.2) + wave;
          ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        }
        ctx.closePath();
        
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, coral.size * 1.2);
        grad.addColorStop(0, coralColor);
        grad.addColorStop(0.7, coralColor + 'CC');
        grad.addColorStop(1, coralColor + '66');
        ctx.fillStyle = grad;
        ctx.fill();
        
        // Add "ribs" or veins to the shell
        ctx.strokeStyle = isBleached ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1.5;
        const ribCount = 12;
        for (let i = 0; i <= ribCount; i++) {
          const t = i / ribCount;
          const angle = startAngle + t * (endAngle - startAngle);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          const r = coral.size * (0.9 + Math.sin(t * Math.PI) * 0.2);
          ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
          ctx.stroke();
        }

        // Add some highlights on the edge
        ctx.strokeStyle = isBleached ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= segments; i++) {
          const t = i / segments;
          const angle = startAngle + t * (endAngle - startAngle);
          const r = coral.size * (0.9 + Math.sin(t * Math.PI) * 0.2);
          if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
          else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        }
        ctx.stroke();

        ctx.restore();
      } else {
        // Draw branches for other types
        coral.branches.forEach(branch => {
          ctx.save();
          ctx.rotate(branch.angle);
          
          // Main branch
          const branchGrad = ctx.createLinearGradient(0, 0, branch.length, 0);
          branchGrad.addColorStop(0, coralColor);
          branchGrad.addColorStop(1, coralColor + 'AA');
          
          ctx.strokeStyle = branchGrad;
          ctx.lineWidth = branch.width;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          
          ctx.beginPath();
          ctx.moveTo(0, 0);
          // Add some waviness to the branch
          const segments = 8;
          for (let i = 1; i <= segments; i++) {
            const t = i / segments;
            const x = branch.length * t;
            const y = Math.sin(t * Math.PI + performance.now() * 0.001 + coral.id.length) * (branch.length * 0.08);
            ctx.lineTo(x, y);
          }
          ctx.stroke();
          
          // Sub branches
          if (branch.subBranches) {
            branch.subBranches.forEach((sub, idx) => {
              ctx.save();
              const t = (idx + 1) / (branch.subBranches!.length + 1);
              const xPos = branch.length * t;
              const yPos = Math.sin(t * Math.PI + performance.now() * 0.001 + coral.id.length) * (branch.length * 0.08);
              ctx.translate(xPos, yPos);
              ctx.rotate(sub.angle);
              
              ctx.lineWidth = branch.width * 0.6;
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.lineTo(sub.length, 0);
              ctx.stroke();
              
              // Tips of sub-branches
              ctx.fillStyle = coralColor;
              ctx.beginPath();
              ctx.arc(sub.length, 0, branch.width * 0.4, 0, Math.PI * 2);
              ctx.fill();
              
              // Highlight on tip
              ctx.fillStyle = 'rgba(255,255,255,0.3)';
              ctx.beginPath();
              ctx.arc(sub.length - 1, -1, branch.width * 0.2, 0, Math.PI * 2);
              ctx.fill();
              
              ctx.restore();
            });
          }
          
          // Tip of main branch
          ctx.fillStyle = coralColor;
          const lastX = branch.length;
          const lastY = Math.sin(Math.PI + performance.now() * 0.001 + coral.id.length) * (branch.length * 0.08);
          ctx.beginPath();
          ctx.arc(lastX, lastY, branch.width * 0.5, 0, Math.PI * 2);
          ctx.fill();
          
          // Highlight on main tip
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.beginPath();
          ctx.arc(lastX - 2, lastY - 2, branch.width * 0.25, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.restore();
        });
      }
      
      ctx.restore();
    });
  };

  const drawFish = (ctx: CanvasRenderingContext2D, z: number) => {
    const { mode, isUserStill } = arStateRef.current;
    const time = performance.now();
    
    // Batch process fish by layer to avoid multiple filters
    for (const f of fishRef.current) {
      if (f.z !== z) continue;
      
      ctx.save();
      
      // In deep sea mode, non-jellyfish, non-anglerfish, non-boxjellyfish, and non-mantaray are dimmed
      if ((mode === 'deep-sea' || mode === 'abyssal') && f.type !== 'jellyfish' && f.type !== 'anglerfish' && f.type !== 'boxjellyfish' && f.type !== 'mantaray') {
        ctx.globalAlpha = 0.05; // Slightly more visible but still dark
      } else if ((mode === 'deep-sea' || mode === 'abyssal') && (f.type === 'anglerfish' || f.type === 'boxjellyfish' || f.type === 'mantaray')) {
        ctx.globalAlpha = 0.9; // Keep anglerfish, boxjellyfish, and mantaray mostly visible
      }

      ctx.translate(f.x, f.y);
      ctx.rotate(f.rotation);
      
      // Mirror if swimming left
      if (Math.abs(f.rotation) > Math.PI / 2) {
        ctx.scale(1, -1);
      }

      // Identification Highlight
      if (hoveredFishIdRef.current === f.id) {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(0, 0, f.size * 1.5, f.size, 0, 0, Math.PI * 2);
        const highlightGrad = ctx.createRadialGradient(0, 0, f.size * 0.8, 0, 0, f.size * 1.5);
        highlightGrad.addColorStop(0, 'rgba(0, 255, 255, 0)');
        highlightGrad.addColorStop(0.5, 'rgba(0, 255, 255, 0.2)');
        highlightGrad.addColorStop(1, 'rgba(0, 255, 255, 0)');
        ctx.fillStyle = highlightGrad;
        ctx.fill();
        
        // Scanning ring
        const scanPos = (time * 0.002) % 1;
        ctx.beginPath();
        ctx.ellipse(0, 0, f.size * 1.5 * scanPos, f.size * scanPos, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 255, 255, ${1 - scanPos})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      // Subtle tail wag animation
      const wag = Math.sin(time * 0.01 + parseInt(f.id, 36)) * 0.1;
      
      // Draw Body
      ctx.fillStyle = f.color;
      
      // Only jellyfish glow in deep-sea mode
      if ((mode === 'deep-sea' || mode === 'abyssal') && f.type === 'jellyfish') {
        const pulse = Math.sin(time * 0.002 + parseInt(f.id, 36)) * 10;
        ctx.shadowBlur = (30 + pulse) * (mode === 'abyssal' ? 2 : 1);
        ctx.shadowColor = f.color;
      }

      // Scared indicator
      if (f.state === 'scared' && mode !== 'deep-sea') {
        ctx.save();
        ctx.translate(0, -f.size * 0.8);
        ctx.rotate(-f.rotation); // Keep bubble upright
        
        // Bubble
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // !
        ctx.fillStyle = 'red';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', 0, 0);
        ctx.restore();
      }

      // Spawning indicator
      if (f.state === 'spawning' && mode !== 'deep-sea') {
        ctx.save();
        ctx.translate(0, -f.size * 0.8);
        ctx.rotate(-f.rotation);
        
        // Progress ring
        const progress = 1 - (f.spawningTimer / 3000);
        ctx.beginPath();
        ctx.arc(0, 0, 18, -Math.PI/2, -Math.PI/2 + progress * Math.PI * 2);
        ctx.strokeStyle = '#00FFFF';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Bubble
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Cartoon Fish Egg Icon
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        const eggGrad = ctx.createRadialGradient(-4, -4, 0, 0, 0, 12);
        eggGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        eggGrad.addColorStop(0.6, 'rgba(173, 216, 230, 0.5)');
        eggGrad.addColorStop(1, 'rgba(100, 149, 237, 0.3)');
        ctx.fillStyle = eggGrad;
        ctx.fill();
        
        ctx.strokeStyle = '#00FFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Nucleus
        ctx.beginPath();
        ctx.arc(3, 3, 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fill();
        ctx.restore();

        // Glow effect on fish
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#00FFFF';
      }

      if (f.type === 'clownfish') {
        ctx.save();
        // Tail Fin
        ctx.rotate(wag);
        ctx.fillStyle = '#FF4500';
        ctx.beginPath();
        ctx.moveTo(-f.size, 0);
        ctx.lineTo(-f.size * 1.4, -f.size / 2);
        ctx.lineTo(-f.size * 1.4, f.size / 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Body
        const grad = ctx.createLinearGradient(-f.size, 0, f.size, 0);
        grad.addColorStop(0, f.color);
        grad.addColorStop(1, '#FF4500');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0, 0, f.size, f.size / 1.8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Stripes with black borders
        const drawStripe = (x: number) => {
          ctx.fillStyle = '#000';
          ctx.fillRect(x - 2, -f.size/1.8, f.size/4 + 4, f.size * 1.1);
          ctx.fillStyle = '#FFF';
          ctx.fillRect(x, -f.size/1.8, f.size/4, f.size * 1.1);
        };
        drawStripe(-f.size/3);
        drawStripe(f.size/4);

        // Fins
        ctx.fillStyle = '#FF4500';
        // Dorsal
        ctx.beginPath();
        ctx.ellipse(0, -f.size/2, f.size/2, f.size/4, 0, 0, Math.PI, true);
        ctx.fill();
        // Pectoral
        ctx.beginPath();
        ctx.ellipse(f.size/4, f.size/4, f.size/4, f.size/6, 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Eye
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(f.size/1.5, -f.size/6, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(f.size/1.4, -f.size/6, 3, 0, Math.PI * 2);
        ctx.fill();

      } else if (f.type === 'mantaray') {
        const s = f.size;
        const flap = Math.sin(time * 0.004 + parseInt(f.id, 36)) * 0.4;
        const isDeep = mode === 'deep-sea' || mode === 'abyssal';
        
        if (isDeep) {
          // Strong ethereal glow based on the image
          ctx.shadowBlur = mode === 'abyssal' ? 80 : 40;
          ctx.shadowColor = 'rgba(0, 255, 255, 0.6)';
          
          // Radial gradient for "inner light" effect
          const grad = ctx.createRadialGradient(s * 0.1, 0, 0, s * 0.1, 0, s * 0.8);
          grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)'); // Bright core
          grad.addColorStop(0.4, 'rgba(176, 224, 230, 0.8)'); // Soft cyan
          grad.addColorStop(1, 'rgba(0, 191, 255, 0.1)');    // Fading edges
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = f.color;
        }
        
        // Main Body & Wings (Ethereal Diamond Shape)
        ctx.beginPath();
        // Head with cephalic fins (the "horns")
        ctx.moveTo(s * 0.6, -s * 0.1);
        ctx.quadraticCurveTo(s * 0.85, -s * 0.25, s * 0.9, -s * 0.05); // Left horn
        ctx.lineTo(s * 0.7, 0);
        ctx.lineTo(s * 0.9, s * 0.05); // Right horn
        ctx.quadraticCurveTo(s * 0.85, s * 0.25, s * 0.6, s * 0.1);
        
        // Top Wing (Broad and flowing)
        ctx.bezierCurveTo(s * 0.3, s * 0.45, -s * 0.2, s * 1.2 * (1 + flap), -s * 0.5, 0);
        // Bottom Wing
        ctx.bezierCurveTo(-s * 0.2, -s * 1.2 * (1 + flap), s * 0.3, -s * 0.45, s * 0.6, -s * 0.1);
        ctx.fill();

        // Exquisite bioluminescent spots on the back
        if (isDeep) {
          ctx.save();
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#FFF';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
          const spotCount = 6;
          for (let i = 0; i < spotCount; i++) {
            const ratio = (i + 1) / (spotCount + 1);
            const sx = s * 0.3 - ratio * s * 0.6;
            const sy = Math.sin(time * 0.002 + i) * s * 0.05;
            ctx.beginPath();
            ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
            ctx.fill();
            
            // Symmetric spots on wings
            ctx.beginPath();
            ctx.arc(sx - s * 0.1, sy + s * 0.2, 1, 0, Math.PI * 2);
            ctx.arc(sx - s * 0.1, sy - s * 0.2, 1, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }

        // Subtle wing patterns/veins for "精美" look
        if (isDeep) {
          ctx.save();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          for (let i = 1; i <= 4; i++) {
            const ratio = i / 5;
            ctx.moveTo(s * 0.4 * ratio, -s * 0.1 * ratio);
            ctx.quadraticCurveTo(s * 0.1, -s * 0.8 * ratio * (1 + flap), -s * 0.4 * ratio, 0);
            ctx.moveTo(s * 0.4 * ratio, s * 0.1 * ratio);
            ctx.quadraticCurveTo(s * 0.1, s * 0.8 * ratio * (1 + flap), -s * 0.4 * ratio, 0);
          }
          ctx.stroke();
          ctx.restore();
        }
        
        // Shimmering trail particles in deep-sea mode
        if (isDeep) {
          ctx.save();
          ctx.globalAlpha = 0.5;
          for (let i = 0; i < 10; i++) {
            const px = -s * 0.3 - Math.random() * s * 1.5;
            const py = (Math.random() - 0.5) * s * 1.8;
            const pSize = Math.random() * 2.5 + 0.5;
            const pOpacity = Math.random() * 0.7;
            ctx.fillStyle = `rgba(255, 255, 255, ${pOpacity})`;
            ctx.beginPath();
            ctx.arc(px, py, pSize, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
        
        // Tail (Swaying/Wiggling with improved physics)
        ctx.beginPath();
        ctx.moveTo(-s * 0.5, 0);
        const tailSegments = 16;
        const tailLen = s * 2.2;
        const seed = parseInt(f.id.substr(0, 4), 36);
        for (let i = 1; i <= tailSegments; i++) {
          const t = i / tailSegments;
          const tx = -s * 0.5 - t * tailLen;
          // Sway logic: follow the body's flap but with a delay/phase shift
          // Added more complex sway for "精美" movement
          const sway = Math.sin(time * 0.0035 - t * 5 + seed) * s * 0.2 * Math.pow(t, 1.2);
          ctx.lineTo(tx, sway);
        }
        ctx.strokeStyle = isDeep ? 'rgba(255, 255, 255, 0.8)' : f.color;
        ctx.lineWidth = isDeep ? 1.5 : 1;
        ctx.lineCap = 'round';
        ctx.stroke();
        
        // Eyes (Small glowing dots)
        if (isDeep) {
          ctx.fillStyle = '#FFF';
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#FFF';
        } else {
          ctx.fillStyle = '#000';
        }
        ctx.beginPath();
        ctx.arc(s * 0.5, -s * 0.1, 2, 0, Math.PI * 2);
        ctx.arc(s * 0.5, s * 0.1, 2, 0, Math.PI * 2);
        ctx.fill();

      } else if (f.type === 'pufferfish') {
        const isPuffed = f.state === 'happy';
        const s = isPuffed ? f.size * 1.8 : f.size;
        const isDeep = mode === 'deep-sea' || mode === 'abyssal';
        
        // Tail Fin
        ctx.save();
        ctx.rotate(wag * 0.8);
        const tailGrad = ctx.createLinearGradient(-s/2, 0, -s, 0);
        tailGrad.addColorStop(0, f.color);
        tailGrad.addColorStop(1, '#DAA520');
        ctx.fillStyle = tailGrad;
        ctx.beginPath();
        ctx.moveTo(-s * 0.4, 0);
        ctx.bezierCurveTo(-s * 0.8, -s * 0.4, -s * 0.9, -s * 0.2, -s * 0.7, 0);
        ctx.bezierCurveTo(-s * 0.9, s * 0.2, -s * 0.8, s * 0.4, -s * 0.4, 0);
        ctx.fill();
        ctx.restore();

        // Pectoral Fins (Small vibrating fins on sides)
        const pecWag = Math.sin(time * 0.02) * 0.3;
        ctx.fillStyle = 'rgba(218, 165, 32, 0.6)';
        // Far side
        ctx.save();
        ctx.translate(0, -s * 0.3);
        ctx.rotate(-0.5 + pecWag);
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.2, s * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // Near side
        ctx.save();
        ctx.translate(0, s * 0.3);
        ctx.rotate(0.5 - pecWag);
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.2, s * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Body
        const bodyGrad = ctx.createRadialGradient(-s * 0.1, -s * 0.1, 0, 0, 0, s/2);
        if (isDeep) {
          const bioPulse = Math.sin(time * 0.002 + parseInt(f.id, 36)) * 0.2 + 0.8;
          bodyGrad.addColorStop(0, `rgba(255, 255, 200, ${0.9 * bioPulse})`);
          bodyGrad.addColorStop(0.6, `rgba(218, 165, 32, ${0.8 * bioPulse})`);
          bodyGrad.addColorStop(1, `rgba(139, 69, 19, ${0.7 * bioPulse})`);
        } else {
          bodyGrad.addColorStop(0, f.color);
          bodyGrad.addColorStop(0.7, '#DAA520');
          bodyGrad.addColorStop(1, '#8B4513');
        }
        
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        // Slightly oval body
        ctx.ellipse(0, 0, s * 0.55, s * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Belly (Lighter area)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.ellipse(0, s * 0.15, s * 0.4, s * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();

        // Texture Spots
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        for(let i=0; i<12; i++) {
          const ang = i * Math.PI / 6 + Math.PI;
          const r = s * 0.3;
          ctx.beginPath();
          ctx.arc(Math.cos(ang) * r, Math.sin(ang) * r * 0.8, s * 0.05, 0, Math.PI * 2);
          ctx.fill();
        }

        // Spikes (Only prominent when puffed)
        if (isPuffed) {
          ctx.strokeStyle = isDeep ? 'rgba(255, 255, 255, 0.8)' : '#FFF';
          ctx.lineWidth = 1.5;
          const spikeCount = 32;
          const spikeLen = s * 0.75;
          for (let i = 0; i < spikeCount; i++) {
            const ang = (i / spikeCount) * Math.PI * 2;
            // Skip spikes where the face is
            if (ang > -0.5 && ang < 0.5) continue;
            
            ctx.beginPath();
            const xBase = Math.cos(ang) * s * 0.45;
            const yBase = Math.sin(ang) * s * 0.4;
            ctx.moveTo(xBase, yBase);
            ctx.lineTo(Math.cos(ang) * spikeLen, Math.sin(ang) * spikeLen * 0.9);
            ctx.stroke();
            
            // Small dot at the tip of spikes in deep sea
            if (isDeep) {
              ctx.fillStyle = 'cyan';
              ctx.beginPath();
              ctx.arc(Math.cos(ang) * spikeLen, Math.sin(ang) * spikeLen * 0.9, 2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }

        // Eyes (Large and cute)
        const eyeX = s * 0.25;
        const eyeY = s * 0.18;
        
        // Eye Sclera
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(eyeX, -eyeY, s * 0.12, 0, Math.PI * 2);
        ctx.arc(eyeX, eyeY, s * 0.12, 0, Math.PI * 2);
        ctx.fill();
        
        // Pupil
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(eyeX + s * 0.03, -eyeY, s * 0.07, 0, Math.PI * 2);
        ctx.arc(eyeX + s * 0.03, eyeY, s * 0.07, 0, Math.PI * 2);
        ctx.fill();
        
        // Glint
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(eyeX + s * 0.06, -eyeY - s * 0.03, s * 0.03, 0, Math.PI * 2);
        ctx.arc(eyeX + s * 0.06, eyeY - s * 0.03, s * 0.03, 0, Math.PI * 2);
        ctx.fill();

        // Mouth (Small 'o' or smile)
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (isPuffed) {
          // Surprised 'o' mouth
          ctx.arc(s * 0.45, 0, s * 0.05, 0, Math.PI * 2);
        } else {
          // Small smile
          ctx.arc(s * 0.4, 0, s * 0.08, 0.2, -0.2, true);
        }
        ctx.stroke();

        // Deep Sea Glow
        if (isDeep) {
          ctx.shadowBlur = 15;
          ctx.shadowColor = 'rgba(255, 255, 0, 0.5)';
          // Add a faint glow ring
          ctx.strokeStyle = 'rgba(255, 255, 0, 0.2)';
          ctx.beginPath();
          ctx.arc(0, 0, s * 0.6, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

      } else if (f.type === 'jellyfish') {
        let pulseSpeed = 0.0015;
        if ((mode === 'deep-sea' || mode === 'abyssal') && isUserStill) {
          pulseSpeed = 0.0007;
        }
        const pulseTime = (time * pulseSpeed + parseInt(f.id, 36) * 0.1) % (Math.PI * 2);
        
        // Bell shape changes: narrower/taller during thrust, wider/flatter during recovery
        const isThrusting = pulseTime < Math.PI * 0.4;
        const pulseAmount = isThrusting 
          ? Math.sin(pulseTime * (Math.PI / (Math.PI * 0.4))) // 0 to 1
          : Math.cos((pulseTime - Math.PI * 0.4) * (Math.PI / (Math.PI * 1.6))) * -1 + 1; // 1 to 0 slowly

        const bellWidthScale = 1 - pulseAmount * 0.3;
        const bellHeightScale = 1 + pulseAmount * 0.2;
        
        // Swaying effect in deep-sea mode
        const swayAmount = (mode === 'deep-sea' || mode === 'abyssal') ? Math.sin(time * 0.001 + parseInt(f.id, 36)) * 0.2 : 0;
        ctx.rotate(swayAmount + Math.PI / 2); // Jellyfish swim "up" relative to their bell

        // Glow
        const isDeep = mode === 'deep-sea' || mode === 'abyssal';
        const bioPulse = isDeep ? (Math.sin(time * 0.002 + parseInt(f.id, 36)) * 0.15 + 0.85) : 1;
        
        if (isDeep) {
          // Multi-layered glow for deep sea
          const glowRadius = f.size * 2.2 * bioPulse;
          const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
          glow.addColorStop(0, `rgba(0, 255, 255, ${0.4 * bioPulse})`);
          glow.addColorStop(0.3, `rgba(0, 150, 255, ${0.2 * bioPulse})`);
          glow.addColorStop(0.6, `rgba(0, 50, 255, ${0.1 * bioPulse})`);
          glow.addColorStop(1, 'rgba(0, 20, 100, 0)');
          
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
          ctx.fill();
          
          // Core intense glow
          const coreGlow = ctx.createRadialGradient(0, -f.size/4, 0, 0, -f.size/4, f.size/1.5);
          coreGlow.addColorStop(0, `rgba(255, 255, 255, ${0.6 * bioPulse})`);
          coreGlow.addColorStop(0.5, `rgba(0, 255, 255, ${0.3 * bioPulse})`);
          coreGlow.addColorStop(1, 'rgba(0, 150, 255, 0)');
          ctx.fillStyle = coreGlow;
          ctx.beginPath();
          ctx.arc(0, -f.size/4, f.size/1.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const glowRadius = f.size * 0.8;
          const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
          glow.addColorStop(0, 'rgba(224, 176, 255, 0.5)');
          glow.addColorStop(1, 'rgba(147, 112, 219, 0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
          ctx.fill();
        }

        // Bell
        ctx.save();
        ctx.scale(bellWidthScale, bellHeightScale);
        
        // Bell Gradient
        const grad = ctx.createRadialGradient(0, -f.size/4, 0, 0, 0, f.size/2);
        if (isDeep) {
          grad.addColorStop(0, `rgba(200, 255, 255, ${0.9 * bioPulse})`);
          grad.addColorStop(0.6, `rgba(0, 180, 255, ${0.7 * bioPulse})`);
          grad.addColorStop(1, `rgba(0, 80, 200, ${0.5 * bioPulse})`);
        } else {
          grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
          grad.addColorStop(0.5, 'rgba(224, 176, 255, 0.7)');
          grad.addColorStop(1, 'rgba(147, 112, 219, 0.5)');
        }
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, f.size / 2, Math.PI, 0);
        ctx.fill();
        
        // Internal Structure (Radial Veins)
        if (isDeep) {
          ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 * bioPulse})`;
          ctx.lineWidth = 1;
          for (let i = 0; i < 8; i++) {
            const ang = (i / 8) * Math.PI + Math.PI;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(ang) * f.size/2, Math.sin(ang) * f.size/2);
            ctx.stroke();
          }
          
          // Nucleus / Core Organs
          const nucleusGrad = ctx.createRadialGradient(0, -f.size/6, 0, 0, -f.size/6, f.size/4);
          nucleusGrad.addColorStop(0, `rgba(255, 255, 255, ${0.9 * bioPulse})`);
          nucleusGrad.addColorStop(1, `rgba(0, 255, 255, ${0.4 * bioPulse})`);
          ctx.fillStyle = nucleusGrad;
          ctx.beginPath();
          ctx.arc(0, -f.size/6, f.size/5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        // Tentacles
        const isDeepSeaStill = (mode === 'deep-sea' || mode === 'abyssal') && isUserStill;
        const tentacleSwaySpeed = isDeepSeaStill ? 0.0008 : ((mode === 'deep-sea' || mode === 'abyssal') ? 0.0015 : 0.002);
        const tentacleSwayAmp = isDeepSeaStill ? 20 : ((mode === 'deep-sea' || mode === 'abyssal') ? 15 : 10);

        // Oral Arms (Thicker central tentacles)
        if (isDeep) {
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          for (let i = -1; i <= 1; i++) {
            const xStart = i * f.size * 0.1 * bellWidthScale;
            const yStart = 0;
            
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 * bioPulse})`;
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'cyan';
            
            ctx.beginPath();
            ctx.moveTo(xStart, yStart);
            const segments = 15;
            const len = f.size * 1.8;
            for(let j=1; j<=segments; j++) {
              const t = j / segments;
              const y = yStart + t * len;
              const wave = Math.sin(time * tentacleSwaySpeed * 1.5 - t * 3 + i * 2);
              ctx.lineTo(xStart + wave * 15 * t, y);
            }
            ctx.stroke();
          }
        }

        // Marginal Tentacles (Thinner edge tentacles)
        ctx.lineWidth = isDeep ? 1.5 : 1.2;
        for (let i = -5; i <= 5; i++) {
          const angle = (i / 6) * (Math.PI * 0.7);
          const xStart = Math.sin(angle) * (f.size / 2.1) * bellWidthScale;
          const yStart = Math.cos(angle) * (f.size / 8) * bellHeightScale;
          
          const opacity = isDeep ? (0.6 - Math.abs(i) * 0.05) : (0.3 - Math.abs(i) * 0.03);
          
          if (isDeep) {
            ctx.strokeStyle = `rgba(0, 255, 255, ${opacity * bioPulse})`;
            ctx.shadowBlur = 8;
            ctx.shadowColor = 'rgba(0, 255, 255, 0.8)';
          } else {
            ctx.strokeStyle = `rgba(224, 176, 255, ${opacity})`;
            ctx.shadowBlur = 0;
          }
          
          ctx.beginPath();
          ctx.moveTo(xStart, yStart);
          
          const segments = isDeep ? 18 : 8;
          const tentacleLen = f.size * (isDeep ? 3.2 : 1.5);
          const tentacleSeed = parseInt(f.id, 36) + i * 137;
          
          for(let j=1; j<=segments; j++) {
            const t = j / segments;
            const xSpread = i * 0.2 * f.size * t;
            const y = yStart + t * tentacleLen * (1 - pulseAmount * 0.1);
            const mainWave = Math.sin(time * tentacleSwaySpeed - t * 5 + i * 0.5 + tentacleSeed * 0.001);
            const xOff = mainWave * tentacleSwayAmp * t;
            ctx.lineTo(xStart + xOff + xSpread, y);
          }
          ctx.stroke();
        }
        ctx.shadowBlur = 0; // Reset shadow

      } else if (f.type === 'shark') {
        const s = f.size;
        const isDeep = mode === 'deep-sea' || mode === 'abyssal';
        
        // Tail Fin (Caudal Fin) - More organic shape
        ctx.save();
        ctx.rotate(wag * 1.5);
        const tailGrad = ctx.createLinearGradient(-s * 1.5, 0, -s, 0);
        tailGrad.addColorStop(0, '#2D3748');
        tailGrad.addColorStop(1, '#4A5568');
        ctx.fillStyle = tailGrad;
        ctx.beginPath();
        ctx.moveTo(-s * 0.8, 0);
        ctx.bezierCurveTo(-s * 1.4, -s * 0.6, -s * 1.6, -s * 0.4, -s * 1.3, 0);
        ctx.bezierCurveTo(-s * 1.6, s * 0.4, -s * 1.4, s * 0.6, -s * 0.8, 0);
        ctx.fill();
        ctx.restore();

        // Pectoral Fin (Far side - subtle)
        ctx.fillStyle = '#2D3748';
        ctx.beginPath();
        ctx.moveTo(-s * 0.2, s * 0.1);
        ctx.quadraticCurveTo(-s * 0.4, s * 0.6, -s * 0.7, s * 0.4);
        ctx.fill();

        // Body Shape - More aerodynamic with tapered nose
        const bodyGrad = ctx.createLinearGradient(0, -s/3, 0, s/3);
        bodyGrad.addColorStop(0, '#718096'); // Top (Darker)
        bodyGrad.addColorStop(0.5, '#A0AEC0'); // Middle
        bodyGrad.addColorStop(1, '#EDF2F7'); // Belly (Lighter)
        
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.moveTo(s, 0); // Nose
        ctx.bezierCurveTo(s * 0.8, -s * 0.4, -s * 0.5, -s * 0.4, -s, 0); // Top curve
        ctx.bezierCurveTo(-s * 0.5, s * 0.4, s * 0.8, s * 0.4, s, 0); // Bottom curve
        ctx.fill();

        // Lateral Line (Subtle detail)
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(s * 0.6, 0);
        ctx.quadraticCurveTo(0, s * 0.05, -s * 0.8, 0);
        ctx.stroke();

        // Gills
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1.5;
        for(let i=0; i<3; i++) {
          ctx.beginPath();
          const gx = s * 0.3 - i * s * 0.08;
          ctx.moveTo(gx, -s * 0.1);
          ctx.quadraticCurveTo(gx - s * 0.05, 0, gx, s * 0.1);
          ctx.stroke();
        }

        // Dorsal Fin - More iconic shark fin shape
        ctx.fillStyle = '#4A5568';
        ctx.beginPath();
        ctx.moveTo(-s * 0.1, -s * 0.25);
        ctx.bezierCurveTo(-s * 0.05, -s * 0.7, s * 0.1, -s * 0.6, s * 0.2, -s * 0.2);
        ctx.fill();

        // Pectoral Fin (Near side)
        ctx.save();
        ctx.translate(s * 0.2, s * 0.1);
        ctx.rotate(Math.PI * 0.1 + wag * 0.2);
        const pecGrad = ctx.createLinearGradient(0, 0, -s * 0.6, s * 0.4);
        pecGrad.addColorStop(0, '#4A5568');
        pecGrad.addColorStop(1, '#2D3748');
        ctx.fillStyle = pecGrad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-s * 0.3, s * 0.6, -s * 0.7, s * 0.5, -s * 0.5, 0);
        ctx.fill();
        ctx.restore();

        // Eye
        const eyeX = s * 0.75;
        const eyeY = -s * 0.08;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, s * 0.04, 0, Math.PI * 2);
        ctx.fill();
        
        // Eye Glint
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(eyeX + s * 0.01, eyeY - s * 0.01, s * 0.015, 0, Math.PI * 2);
        ctx.fill();

        // Mouth Line (Subtle)
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(s * 0.9, s * 0.05);
        ctx.quadraticCurveTo(s * 0.7, s * 0.15, s * 0.5, s * 0.08);
        ctx.stroke();

        // Deep Sea Glow (Bioluminescent highlights)
        if (isDeep) {
          const bioPulse = Math.sin(time * 0.002 + parseInt(f.id, 36)) * 0.3 + 0.7;
          ctx.strokeStyle = `rgba(0, 255, 255, ${0.4 * bioPulse})`;
          ctx.lineWidth = 2;
          ctx.shadowBlur = 10;
          ctx.shadowColor = 'cyan';
          
          // Glow along the top edge
          ctx.beginPath();
          ctx.moveTo(s * 0.5, -s * 0.25);
          ctx.quadraticCurveTo(0, -s * 0.35, -s * 0.5, -s * 0.25);
          ctx.stroke();
          
          ctx.shadowBlur = 0;
        }
      } else if (f.type === 'squid') {
        // Squid swims mantle-first (positive x), tentacles trail behind (negative x)
        
        // Fins at the tip of the mantle (+x)
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.moveTo(f.size * 1.2, 0); 
        ctx.lineTo(f.size * 0.6, -f.size * 0.6);
        ctx.lineTo(f.size * 0.3, 0);
        ctx.lineTo(f.size * 0.6, f.size * 0.6);
        ctx.closePath();
        ctx.fill();

        // Main mantle (bullet shape)
        ctx.beginPath();
        ctx.moveTo(f.size * 1.2, 0);
        ctx.bezierCurveTo(f.size * 1.2, -f.size * 0.5, -f.size * 0.2, -f.size * 0.5, -f.size * 0.3, 0);
        ctx.bezierCurveTo(-f.size * 0.2, f.size * 0.5, f.size * 1.2, f.size * 0.5, f.size * 1.2, 0);
        ctx.fill();

        // Mantle spots (for extra detail)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        const spotPositions = [
          {x: 0.8, y: 0.1, r: 0.08},
          {x: 0.5, y: -0.2, r: 0.1},
          {x: 0.6, y: 0.25, r: 0.06},
          {x: 0.2, y: -0.15, r: 0.07},
          {x: 0.3, y: 0.15, r: 0.09},
          {x: 0.9, y: -0.1, r: 0.05},
        ];
        spotPositions.forEach(spot => {
          ctx.beginPath();
          ctx.arc(f.size * spot.x, f.size * spot.y, f.size * spot.r, 0, Math.PI * 2);
          ctx.fill();
        });

        // Head (connects mantle and tentacles)
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.ellipse(-f.size * 0.4, 0, f.size * 0.2, f.size * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();

        // Tentacles (attached to the head, extending left / negative x)
        ctx.strokeStyle = f.color;
        ctx.lineCap = 'round';
        
        // 2 Long tentacles (clubs)
        ctx.lineWidth = f.size / 8;
        for (let i = -1; i <= 1; i += 2) {
          ctx.beginPath();
          ctx.moveTo(-f.size * 0.5, i * f.size * 0.15);
          const wiggle1 = Math.sin(time * 0.005 + i) * (f.size / 2);
          const wiggle2 = Math.cos(time * 0.004 + i) * (f.size / 2);
          ctx.bezierCurveTo(
            -f.size * 1.0, i * f.size * 0.3 + wiggle1, 
            -f.size * 1.5, i * f.size * 0.4 + wiggle2, 
            -f.size * 2.2, i * f.size * 0.2 + wiggle1
          );
          ctx.stroke();
          
          // Tentacle club (end)
          ctx.fillStyle = f.color;
          ctx.beginPath();
          ctx.ellipse(-f.size * 2.2, i * f.size * 0.2 + wiggle1, f.size / 4, f.size / 6, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        // 6 Short arms
        ctx.lineWidth = f.size / 6;
        const armCount = 6;
        for (let i = 0; i < armCount; i++) {
          ctx.beginPath();
          const yOffset = (i - armCount / 2 + 0.5) * (f.size / 3);
          ctx.moveTo(-f.size * 0.5, yOffset * 0.6);
          
          // Wiggle effect
          const wiggle = Math.sin(time * 0.006 + i) * (f.size / 4);
          ctx.quadraticCurveTo(-f.size * 0.8, yOffset + wiggle, -f.size * 1.4, yOffset * 1.2 + wiggle * 0.5);
          ctx.stroke();
        }

        // Eyes
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(-f.size * 0.35, -f.size * 0.25, f.size / 5, 0, Math.PI * 2);
        ctx.arc(-f.size * 0.35, f.size * 0.25, f.size / 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000';
        ctx.beginPath();
        // Pupils looking slightly forward (towards +x)
        ctx.arc(-f.size * 0.3, -f.size * 0.25, f.size / 10, 0, Math.PI * 2);
        ctx.arc(-f.size * 0.3, f.size * 0.25, f.size / 10, 0, Math.PI * 2);
        ctx.fill();
        
        // Eye glint
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(-f.size * 0.28, -f.size * 0.28, f.size / 25, 0, Math.PI * 2);
        ctx.arc(-f.size * 0.28, f.size * 0.22, f.size / 25, 0, Math.PI * 2);
        ctx.fill();
      } else if (f.type === 'turtle') {
        // Turtle swims towards +x
        const shellLength = f.size * 1.2;
        const shellWidth = f.size * 0.95;
        
        // Flippers animation
        const isCaught = f.state === 'caught';
        const flipperSpeed = isCaught ? 0.015 : 0.002; // Rapid sliding if caught
        const flipperAngle = Math.sin(time * flipperSpeed) * 0.6; 
        
        // Back flippers
        ctx.fillStyle = '#1E5631'; // Darker green
        
        ctx.save();
        ctx.translate(-shellLength * 0.45, shellWidth * 0.35);
        ctx.rotate(-0.5 + flipperAngle * 0.3);
        ctx.beginPath();
        ctx.ellipse(0, 0, f.size * 0.35, f.size * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        
        ctx.save();
        ctx.translate(-shellLength * 0.45, -shellWidth * 0.35);
        ctx.rotate(0.5 - flipperAngle * 0.3);
        ctx.beginPath();
        ctx.ellipse(0, 0, f.size * 0.35, f.size * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        
        // Front flippers (large)
        ctx.save();
        ctx.translate(shellLength * 0.25, shellWidth * 0.35);
        ctx.rotate(0.6 + flipperAngle);
        ctx.beginPath();
        ctx.ellipse(0, f.size * 0.35, f.size * 0.18, f.size * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        
        ctx.save();
        ctx.translate(shellLength * 0.25, -shellWidth * 0.35);
        ctx.rotate(-0.6 - flipperAngle);
        ctx.beginPath();
        ctx.ellipse(0, -f.size * 0.35, f.size * 0.18, f.size * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // If caught, show a scared indicator
        if (isCaught) {
          ctx.save();
          ctx.translate(0, -f.size * 0.8);
          ctx.rotate(-f.rotation);
          
          // Bubble
          ctx.fillStyle = 'white';
          ctx.beginPath();
          ctx.arc(0, 0, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'red';
          ctx.lineWidth = 2;
          ctx.stroke();
          
          // !
          ctx.fillStyle = 'red';
          ctx.font = 'bold 16px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('!', 0, 0);
          ctx.restore();
        }
        
        // Tail
        ctx.fillStyle = '#2E8B57';
        ctx.beginPath();
        ctx.moveTo(-shellLength * 0.4, 0);
        ctx.lineTo(-shellLength * 0.65, f.size * 0.1);
        ctx.lineTo(-shellLength * 0.65, -f.size * 0.1);
        ctx.fill();
        
        // Head
        ctx.beginPath();
        ctx.ellipse(shellLength * 0.55, 0, f.size * 0.3, f.size * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Eyes
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(shellLength * 0.65, f.size * 0.15, f.size * 0.06, 0, Math.PI * 2);
        ctx.arc(shellLength * 0.65, -f.size * 0.15, f.size * 0.06, 0, Math.PI * 2);
        ctx.fill();
        
        // Eye glints
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(shellLength * 0.67, f.size * 0.13, f.size * 0.02, 0, Math.PI * 2);
        ctx.arc(shellLength * 0.67, -f.size * 0.17, f.size * 0.02, 0, Math.PI * 2);
        ctx.fill();
        
        // Shell (Carapace)
        const shellGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, shellLength * 0.6);
        shellGrad.addColorStop(0, '#4CAF50'); // Lighter green center
        shellGrad.addColorStop(0.8, '#2E7D32');
        shellGrad.addColorStop(1, '#1B5E20'); // Dark edge
        
        ctx.fillStyle = shellGrad;
        ctx.beginPath();
        ctx.ellipse(0, 0, shellLength * 0.5, shellWidth * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Shell edge (marginal scutes)
        ctx.strokeStyle = '#1B5E20';
        ctx.lineWidth = 4;
        ctx.stroke();
        
        // Shell pattern (scutes)
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        
        // Draw central row of hexagonal scutes
        const scuteR = f.size * 0.25;
        for (let i = -1; i <= 1; i++) {
          const cx = i * scuteR * 1.6;
          ctx.beginPath();
          for (let j = 0; j < 6; j++) {
            const angle = (j * Math.PI) / 3;
            const px = cx + Math.cos(angle) * scuteR;
            const py = Math.sin(angle) * scuteR * 1.2;
            if (j === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
        }
      } else if (f.type === 'anglerfish') {
        const s = f.size;
        const isDeep = mode === 'deep-sea' || mode === 'abyssal';
        
        // Tail Fin (Ragged)
        ctx.save();
        ctx.rotate(wag * 1.2);
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.moveTo(-s * 0.5, 0);
        ctx.lineTo(-s * 1.1, -s * 0.5);
        ctx.lineTo(-s * 0.9, -s * 0.2);
        ctx.lineTo(-s * 1.2, 0);
        ctx.lineTo(-s * 0.9, s * 0.2);
        ctx.lineTo(-s * 1.1, s * 0.5);
        ctx.fill();
        ctx.restore();

        // Dorsal Fin (Spiky)
        ctx.fillStyle = '#1A252F';
        ctx.beginPath();
        ctx.moveTo(-s * 0.2, -s * 0.5);
        ctx.lineTo(-s * 0.4, -s * 0.8);
        ctx.lineTo(-s * 0.5, -s * 0.4);
        ctx.lineTo(-s * 0.7, -s * 0.6);
        ctx.lineTo(-s * 0.7, -s * 0.2);
        ctx.fill();

        // Pectoral Fin
        ctx.save();
        ctx.translate(-s * 0.1, s * 0.2);
        ctx.rotate(wag * 0.5 - 0.2);
        ctx.fillStyle = '#1A252F';
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.3, s * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
        // Fin rays
        ctx.strokeStyle = '#2C3E50';
        ctx.lineWidth = 1;
        for(let i=-1; i<=1; i++) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(s * 0.25, i * s * 0.1);
          ctx.stroke();
        }
        ctx.restore();

        // Main Body (Bulbous and irregular)
        const bodyGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.8);
        bodyGrad.addColorStop(0, '#34495E');
        bodyGrad.addColorStop(0.7, f.color);
        bodyGrad.addColorStop(1, '#111');
        
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.moveTo(s * 0.6, 0);
        ctx.bezierCurveTo(s * 0.7, -s * 0.6, -s * 0.2, -s * 0.8, -s * 0.7, -s * 0.2);
        ctx.bezierCurveTo(-s * 0.8, s * 0.5, -s * 0.2, s * 0.9, s * 0.5, s * 0.5);
        ctx.fill();

        // Body Spots / Warts
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        const spots = [
          {x: -0.3, y: -0.2, r: 0.08}, {x: -0.1, y: -0.4, r: 0.05},
          {x: -0.4, y: 0.2, r: 0.06}, {x: -0.2, y: 0.4, r: 0.09},
          {x: 0.1, y: 0.3, r: 0.04}, {x: -0.5, y: -0.05, r: 0.07}
        ];
        spots.forEach(spot => {
          ctx.beginPath();
          ctx.arc(s * spot.x, s * spot.y, s * spot.r, 0, Math.PI * 2);
          ctx.fill();
        });

        // Jaw / Mouth (Huge underbite)
        ctx.fillStyle = '#0a0a0a';
        ctx.beginPath();
        ctx.moveTo(s * 0.6, -s * 0.1);
        ctx.lineTo(s * 0.1, s * 0.1);
        ctx.lineTo(s * 0.5, s * 0.5);
        ctx.fill();

        // Sharp Teeth (Translucent)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        // Top teeth (pointing down and slightly back)
        for (let i = 0; i < 5; i++) {
          const tx = s * 0.55 - i * (s * 0.09);
          const ty = -s * 0.05 + i * (s * 0.03);
          ctx.moveTo(tx, ty);
          ctx.lineTo(tx - s * 0.02, ty + s * 0.18);
          ctx.lineTo(tx - s * 0.06, ty);
        }
        // Bottom teeth (pointing up and out)
        for (let i = 0; i < 4; i++) {
          const tx = s * 0.45 - i * (s * 0.09);
          const ty = s * 0.45 - i * (s * 0.08);
          ctx.moveTo(tx, ty);
          ctx.lineTo(tx + s * 0.05, ty - s * 0.2);
          ctx.lineTo(tx - s * 0.04, ty - s * 0.02);
        }
        ctx.fill();

        // Eye (Small, pale, creepy, no pupil)
        ctx.fillStyle = '#E0F7FA';
        ctx.beginPath();
        ctx.arc(s * 0.25, -s * 0.25, s * 0.06, 0, Math.PI * 2);
        ctx.fill();
        // Eye glow
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#E0F7FA';
        ctx.stroke();
        ctx.shadowBlur = 0;

        // The Lure (Illicium)
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.beginPath();
        // Starts from forehead
        ctx.moveTo(s * 0.1, -s * 0.55);
        // Arcs forward and down
        ctx.quadraticCurveTo(s * 0.6, -s * 0.9, s * 0.85, -s * 0.2);
        ctx.stroke();

        // Lure Bulb (Esca) - Glowing
        const bulbX = s * 0.85;
        const bulbY = -s * 0.2;
        
        const pulse = isDeep ? Math.sin(time * 0.003 + parseInt(f.id, 36)) * 0.5 + 0.5 : 0.2;
        
        // Glow effect
        ctx.shadowBlur = isDeep ? (25 + pulse * 25) * (mode === 'abyssal' ? 2 : 1) : 5;
        ctx.shadowColor = '#00FFFF'; // Cyan glow
        
        // Outer aura
        ctx.fillStyle = `rgba(0, 255, 255, ${0.3 + pulse * 0.3})`;
        ctx.beginPath();
        ctx.arc(bulbX, bulbY, s * 0.15, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner bright spot
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(bulbX, bulbY, s * 0.06, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0; // Reset shadow
      } else if (f.type === 'boxjellyfish') {
        const s = f.size;
        const isDeep = mode === 'deep-sea' || mode === 'abyssal';
        
        // Bell (Rounded Cube)
        ctx.save();
        // Bioluminescence effect
        ctx.shadowBlur = mode === 'abyssal' ? 40 : 15;
        ctx.shadowColor = '#00FFFF';
        
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, s/2);
        grad.addColorStop(0, 'rgba(200, 255, 255, 0.8)');
        grad.addColorStop(0.5, 'rgba(0, 200, 255, 0.4)');
        grad.addColorStop(1, 'rgba(0, 100, 200, 0.1)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        const r = s * 0.25;
        ctx.moveTo(-s/2 + r, -s/2);
        ctx.lineTo(s/2 - r, -s/2);
        ctx.arcTo(s/2, -s/2, s/2, -s/2 + r, r);
        ctx.lineTo(s/2, s/2 - r);
        ctx.arcTo(s/2, s/2, s/2 - r, s/2, r);
        ctx.lineTo(-s/2 + r, s/2);
        ctx.arcTo(-s/2, s/2, -s/2, s/2 - r, r);
        ctx.lineTo(-s/2, -s/2 + r);
        ctx.arcTo(-s/2, -s/2, -s/2 + r, -s/2, r);
        ctx.fill();
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        // Tentacles
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)';
        ctx.lineWidth = 0.8;
        for (let i = -4; i <= 4; i++) {
          ctx.beginPath();
          ctx.moveTo(i * s/10, s/2);
          let curX = i * s/10;
          let curY = s/2;
          const tentacleLength = 10 + Math.abs(i) * 2;
          for(let j=1; j<=tentacleLength; j++) {
            const t = j / tentacleLength;
            const wave = Math.sin(time * 0.003 + i + t * 8) * (5 + t * 5);
            curX += wave * 0.3;
            curY += s * 0.15;
            ctx.lineTo(curX, curY);
          }
          ctx.stroke();
        }
      }

      ctx.restore();

      // Draw hover indicator
      if (hoveredFishIdRef.current === f.id) {
        ctx.save();
        ctx.translate(f.x, f.y);
        
        const hoverDuration = time - hoverStartTimeRef.current;
        const progress = Math.min(hoverDuration / 2000, 1);
        
        ctx.beginPath();
        ctx.arc(0, 0, f.size * 1.5, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Draw background ring
        ctx.beginPath();
        ctx.arc(0, 0, f.size * 1.5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
        ctx.lineWidth = 4;
        ctx.stroke();
        
        ctx.restore();
      }
    }
  };

  return (
    <div className={cn(
      "relative w-full h-screen overflow-hidden transition-colors duration-1000",
      arState.mode === 'abyssal' ? "bg-black" : (arState.mode === 'deep-sea' ? "bg-blue-950" : "bg-black")
    )}>
      {!isStarted && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm text-white p-4 sm:p-8 overflow-y-auto">
          <div className="max-w-lg w-full glass-panel p-6 sm:p-8 rounded-3xl flex flex-col items-center text-center gap-6 my-auto">
            <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mb-2 shrink-0">
              <Waves className="w-8 h-8 text-blue-400" />
            </div>
            <h1 className="text-3xl font-serif italic text-blue-100">海洋之镜 AR</h1>
            <p className="text-blue-200/70 text-sm leading-relaxed">
              步入互动的海底生态系统。请允许访问相机，让虚拟海洋生物与你互动。
            </p>
            
            <div className="w-full flex flex-col gap-4 text-left bg-black/20 p-5 rounded-2xl border border-white/5">
              <h2 className="text-xs font-mono uppercase tracking-widest text-blue-300 mb-1 text-center">玩法说明</h2>
              
              <div className="flex items-start gap-4">
                <span className="text-2xl leading-none">🤌</span>
                <div>
                  <p className="font-medium text-blue-100 text-sm">捏合手指</p>
                  <p className="text-xs text-blue-200/60 mt-0.5">捏合食指和拇指来投放食物，喂食饥饿的鱼。</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <span className="text-2xl leading-none">↔️</span>
                <div>
                  <p className="font-medium text-blue-100 text-sm">手掌左滑</p>
                  <p className="text-xs text-blue-200/60 mt-0.5">在镜头前快速向左挥动手掌，即可在普通模式和发光的深海模式之间切换。</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="10" cy="10" r="7" fill="#FFB6C1" fillOpacity="0.4" stroke="#FF69B4" strokeWidth="1.5"/>
                    <circle cx="7" cy="7" r="2" fill="white" fillOpacity="0.8"/>
                    <circle cx="16" cy="16" r="5" fill="#FFB6C1" fillOpacity="0.3" stroke="#FF69B4" strokeWidth="1"/>
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-blue-100 text-sm">鱼卵</p>
                  <p className="text-xs text-blue-200/60 mt-0.5">鱼偶尔会产卵，这些卵会粘在你的头上或肩膀上。</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <span className="text-2xl leading-none">👋</span>
                <div>
                  <p className="font-medium text-blue-100 text-sm">摇头或挥手</p>
                  <p className="text-xs text-blue-200/60 mt-0.5">摇晃头部或者在鱼卵附近挥手，可以把它们清除掉。</p>
                </div>
              </div>
            </div>

            {cameraError && (
              <div className="w-full p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-sm">
                {cameraError}
              </div>
            )}

            <button 
              onClick={() => {
                setCameraError(null);
                setIsStarted(true);
              }}
              className="w-full py-4 bg-blue-500 hover:bg-blue-400 text-white rounded-xl font-medium transition-colors mt-2"
            >
              开始体验
            </button>
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        className="hidden"
        playsInline
        muted
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
      <canvas
        ref={maskCanvasRef}
        className="hidden"
        width={1280}
        height={720}
      />

      {/* UI Overlay */}
      {arState.currentTask && !(arState.currentTask.id === 'task-3' && arState.currentTask.completed) ? (
        <GuidancePanel task={arState.currentTask} />
      ) : (
        <AnimatePresence>
          {showFreeExplore && arState.currentTask?.id === 'task-3' && arState.currentTask.completed && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="absolute bottom-32 left-1/2 -translate-x-1/2 z-50"
            >
              <div className="glass-panel p-8 rounded-3xl border-2 border-emerald-400/50 bg-emerald-900/20 backdrop-blur-xl text-center max-w-xl shadow-2xl shadow-emerald-900/40">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                  <Waves className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-white font-black text-3xl mb-3">任务全部完成！</h3>
                <p className="text-emerald-100 text-xl leading-relaxed">
                  海洋恢复了往日的纯净。现在，请引导玩家尽情探索这片美丽的海洋，与各种海洋生物进行自由互动吧！
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
      
      {/* Pollution Warning */}
      <AnimatePresence>
        {arState.pollutionLevel > 0.1 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-32 left-1/2 -translate-x-1/2 z-[60]"
          >
            <div className="bg-red-500/20 backdrop-blur-xl border-2 border-red-500/50 p-4 rounded-2xl flex items-center gap-4 shadow-2xl shadow-red-900/40">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <Trash2 className="text-red-400" />
              </div>
              <div>
                <h4 className="text-red-200 font-black text-2xl mb-1">水质正在变差！</h4>
                <p className="text-red-100 text-lg font-medium">海洋垃圾太多了，快引导玩家清理垃圾来改善水质吧。</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fish Info Bubble */}
      <AnimatePresence>
        {arState.hoveredFishId && arState.hoveredFishPos && (() => {
          const bubbleWidth = 500;
          const bubbleHeight = 300;
          let left = arState.hoveredFishPos.x;
          let top = arState.hoveredFishPos.y - 160;

          if (left < bubbleWidth / 2) left = bubbleWidth / 2;
          if (left > window.innerWidth - bubbleWidth / 2) left = window.innerWidth - bubbleWidth / 2;

          if (top < 0) top = arState.hoveredFishPos.y + 50;
          if (top + bubbleHeight > window.innerHeight) top = window.innerHeight - bubbleHeight;

          return (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: 20 }}
              animate={{ 
                opacity: 1, 
                scale: 1, 
                y: 0,
                left: left,
                top: top
              }}
              exit={{ opacity: 0, scale: 0.5, y: 20 }}
              className="absolute z-[100] pointer-events-none"
              style={{ transform: 'translateX(-50%)' }}
            >
              <div className="relative bg-black/20 backdrop-blur-2xl p-8 rounded-3xl border-2 border-blue-400/50 min-w-[400px] max-w-[500px] shadow-2xl shadow-blue-900/40">
                {/* Bubble Tail */}
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-black/20 backdrop-blur-2xl border-r-2 border-b-2 border-blue-400/50 rotate-45" />
                
                {(() => {
                  const hoveredFish = fishRef.current.find(f => f.id === arState.hoveredFishId);
                  if (!hoveredFish) return null;
                  const config = FISH_CONFIG[hoveredFish.type];
                  const name = {
                    clownfish: '小丑鱼',
                    pufferfish: '河豚',
                    jellyfish: '水母',
                    shark: '鲨鱼',
                    squid: '乌贼',
                    turtle: '海龟',
                    anglerfish: '灯笼鱼',
                    boxjellyfish: '箱水母',
                    mantaray: '魔鬼鱼'
                  }[hoveredFish.type];
                  
                  return (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full animate-pulse" 
                          style={{ backgroundColor: config.color }}
                        />
                        <h3 className="text-white font-black text-3xl tracking-tight">{name}</h3>
                      </div>
                      <p className="text-white text-lg leading-relaxed font-medium">
                        {FISH_INFO[hoveredFish.type]}
                      </p>
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-8">
        {/* Top Bar */}
        <div className="flex justify-between items-start">
            <div className="flex gap-4">
              <div className="glass-panel p-4 rounded-2xl flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Waves className="text-emerald-400" />
                </div>
                <div>
                  <h1 className="text-sm font-mono uppercase tracking-widest opacity-50">生态系统</h1>
                  <p className="text-xl font-medium">生态系统运行中</p>
                </div>
              </div>

              <AnimatePresence>
                {(arState.mode === 'deep-sea' || arState.mode === 'abyssal') && (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="glass-panel p-4 rounded-2xl flex items-center gap-4 border-blue-400/50 bg-blue-900/40"
                  >
                    <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <Info className="text-blue-300" />
                    </div>
                    <div>
                      <h1 className="text-sm font-mono uppercase tracking-widest text-blue-300">当前区域</h1>
                      <p className="text-xl font-medium text-white">
                        {arState.mode === 'deep-sea' ? '深海带 (1000m - 4000m)' : '深渊带 (4000m - 6000m)'}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {arState.isSpawning && (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="glass-panel p-4 rounded-2xl flex items-center gap-4 border-cyan-500/50"
                  >
                    <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center animate-pulse">
                      <Zap className="text-cyan-400" />
                    </div>
                    <div>
                      <h1 className="text-sm font-mono uppercase tracking-widest text-cyan-400">状态</h1>
                      <p className="text-xl font-medium text-cyan-100">鱼群产卵中！</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {arState.swipeDirection && (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="glass-panel p-4 rounded-2xl flex items-center gap-4 border-blue-400/50 bg-blue-500/10"
                  >
                    <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <Maximize2 className="text-blue-400" />
                    </div>
                    <div>
                      <h1 className="text-sm font-mono uppercase tracking-widest text-blue-400">手势识别</h1>
                      <p className="text-xl font-medium text-blue-100">
                        {arState.swipeDirection === 'left' ? '向左滑动' : '向右滑动'}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          <div className="flex flex-col items-end gap-2">
            {/* Fish Info Box removed - moved to bubble near fish */}
          </div>
        </div>

        {/* Interaction Hints */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-8">
            <div className="flex flex-col items-center gap-2">
              <div className={cn(
                "w-12 h-12 rounded-full border flex items-center justify-center transition-all duration-300",
                arState.isPinching ? "bg-white text-black scale-110" : "border-white/30 text-white/30"
              )}>
                <Zap size={20} />
              </div>
              <span className="text-[10px] uppercase tracking-tighter opacity-50">捏合喂食</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className={cn(
                "w-12 h-12 rounded-full border flex items-center justify-center transition-all duration-300",
                arState.palmPos ? "bg-white text-black scale-110" : "border-white/30 text-white/30"
              )}>
                <Info size={20} />
              </div>
              <span className="text-[10px] uppercase tracking-tighter opacity-50">手掌互动</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className={cn(
                "w-12 h-12 rounded-full border flex items-center justify-center transition-all duration-300",
                "border-white/30 text-white/30"
              )}>
                <Maximize2 size={20} />
              </div>
              <span className="text-[10px] uppercase tracking-tighter opacity-50">
                {arState.mode === 'normal' ? '向左滑动进入深海带' : 
                 arState.mode === 'deep-sea' ? '向左滑动进入深渊带' : '向左滑动返回浅海'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Deep Sea Transition Overlay */}
      <AnimatePresence mode="wait">
        {(arState.mode === 'deep-sea' || arState.mode === 'abyssal') && (
          <motion.div
            key={arState.mode}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{ times: [0, 0.1, 0.8, 1], duration: 4 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none flex items-center justify-center z-40"
          >
            <div className="text-center">
              <motion.h2 
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                className="text-5xl font-serif italic text-blue-200 mb-4 drop-shadow-[0_0_15px_rgba(147,197,253,0.6)]"
              >
                {arState.mode === 'deep-sea' ? '深海带' : '深渊带'}
              </motion.h2>
              <p className="text-2xl font-mono uppercase tracking-[0.3em] text-blue-400/80">
                {arState.mode === 'deep-sea' ? '1000m - 4000m' : '4000m - 6000m'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Background Music */}
      <audio
        ref={audioRef}
        src="https://raw.githubusercontent.com/lucaibing/-/main/%E6%B5%B7%E9%B8%A5%E5%8F%AB.mp3"
        loop
      />
    </div>
  );
}
