import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, MathUtils } from 'three';
import { GridPos, Direction } from '../types';
import { CELL_SIZE, COLORS } from '../constants';

// Fix for Missing JSX Intrinsic Elements in TypeScript
declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      boxGeometry: any;
      meshStandardMaterial: any;
      planeGeometry: any;
      meshBasicMaterial: any;
    }
  }
}

interface BotProps {
  pos: GridPos;
  dir: Direction;
  isJumping: boolean;
}

const Bot: React.FC<BotProps> = ({ pos, dir, isJumping }) => {
  const groupRef = useRef<Group>(null);
  
  // Initialize with the starting position to prevent flying in from (0,0,0)
  // We use state to ensure this prop never updates, handing control to useFrame
  const [initialPos] = useState<[number, number, number]>([
    pos.x * CELL_SIZE, 
    0.75, 
    pos.z * CELL_SIZE
  ]);

  // Track animation state
  const prevTargetX = useRef(pos.x);
  const prevTargetZ = useRef(pos.z);
  const startPosRef = useRef({ x: pos.x * CELL_SIZE, z: pos.z * CELL_SIZE });

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Target World Coordinates
    const targetX = pos.x * CELL_SIZE;
    const targetZ = pos.z * CELL_SIZE;

    // 1. Detect New Move or Reset
    if (pos.x !== prevTargetX.current || pos.z !== prevTargetZ.current) {
        const dist = Math.hypot(targetX - groupRef.current.position.x, targetZ - groupRef.current.position.z);
        
        // Teleport/Reset Logic: If distance is too large (likely a level reset), snap instantly
        if (dist > 4.0) { 
            groupRef.current.position.x = targetX;
            groupRef.current.position.z = targetZ;
            // Reset rotation too if needed, but usually fine
            
            // Reset Arc Start
            startPosRef.current = { x: targetX, z: targetZ };
        } else {
            // Normal Move: Set start of Arc to the PREVIOUS target grid center
            // This ensures consistent arc shapes regardless of current mesh lag
            startPosRef.current = { 
                x: prevTargetX.current * CELL_SIZE, 
                z: prevTargetZ.current * CELL_SIZE 
            };
        }
        
        prevTargetX.current = pos.x;
        prevTargetZ.current = pos.z;
    }

    // 2. Horizontal Movement (Smooth Damping)
    // Increased decay to 6.0 to ensure the bot reaches the target center quickly and accurately
    const decay = 6.0; 
    const alpha = 1 - Math.exp(-decay * delta);

    let nextX = MathUtils.lerp(groupRef.current.position.x, targetX, alpha);
    let nextZ = MathUtils.lerp(groupRef.current.position.z, targetZ, alpha);

    // Snap to target if very close (within 0.02 units) to prevent visual drift and ensure perfect centering
    if (Math.abs(targetX - nextX) < 0.02) nextX = targetX;
    if (Math.abs(targetZ - nextZ) < 0.02) nextZ = targetZ;

    groupRef.current.position.x = nextX;
    groupRef.current.position.z = nextZ;

    // 3. Vertical Movement (Jump Arc)
    let targetY = 0.75; // Base Hover Height

    if (isJumping) {
        // Calculate Arc
        const startX = startPosRef.current.x;
        const startZ = startPosRef.current.z;
        const totalDist = Math.hypot(targetX - startX, targetZ - startZ);
        
        // Avoid division by zero for stationary jumps
        if (totalDist > 0.1) {
             const currentDist = Math.hypot(targetX - nextX, targetZ - nextZ);
             
             // Progress goes 0.0 (start) -> 1.0 (target)
             const rawProgress = 1 - (currentDist / totalDist);
             const progress = Math.max(0, Math.min(1, rawProgress));
             
             // Parabolic Sine Wave for smoother peak
             // Peak height 2.5 units
             const jumpOffset = Math.sin(progress * Math.PI) * 2.5;
             targetY += jumpOffset;
             
             // Direct assignment locks Y to horizontal progress, preventing "drag"
             groupRef.current.position.y = targetY;
        } else {
            // Fallback for weird zero-distance jumps
            groupRef.current.position.y = MathUtils.lerp(groupRef.current.position.y, 2.0, alpha);
        }
    } else {
        // Normal Hover / Landing
        // Use lerp for smooth settling, with snap
        groupRef.current.position.y = MathUtils.lerp(groupRef.current.position.y, targetY, alpha);
        if (Math.abs(targetY - groupRef.current.position.y) < 0.02) {
            groupRef.current.position.y = targetY;
        }
    }

    // 4. Rotation Logic
    const targetRotY = (2 - dir) * (Math.PI / 2);
    let currentY = groupRef.current.rotation.y;
    let diff = targetRotY - currentY;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    groupRef.current.rotation.y += diff * alpha;
  });

  return (
    <group ref={groupRef} position={initialPos}>
      {/* Main Cube Body */}
      <mesh castShadow receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[0.8, 0.8, 0.8]} />
        <meshStandardMaterial color={COLORS.player} />
      </mesh>

      {/* Eyes */}
      <group position={[0, 0.1, 0.41]}>
        <mesh position={[0.2, 0, 0]}>
          <planeGeometry args={[0.15, 0.15]} />
          <meshBasicMaterial color="white" />
        </mesh>
        <mesh position={[0.2, 0, 0.01]}>
          <planeGeometry args={[0.08, 0.08]} />
          <meshBasicMaterial color="#1e3a8a" />
        </mesh>
        <mesh position={[-0.2, 0, 0]}>
          <planeGeometry args={[0.15, 0.15]} />
          <meshBasicMaterial color="white" />
        </mesh>
         <mesh position={[-0.2, 0, 0.01]}>
          <planeGeometry args={[0.08, 0.08]} />
          <meshBasicMaterial color="#1e3a8a" />
        </mesh>
      </group>
    </group>
  );
};

export default Bot;