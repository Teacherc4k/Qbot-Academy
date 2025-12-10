import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { LevelData, GridPos, Direction } from '../types';
import { CELL_SIZE, COLORS } from '../constants';
import Bot from './Bot';

interface GameSceneProps {
  level: LevelData;
  botPos: GridPos;
  botDir: Direction;
  isJumping: boolean;
  collectedBadges: Set<string>;
}

// Custom modification to rotate geometry in place for the Coin so Y-axis rotation spins it properly
const RotatingCoin: React.FC<{ isCollected: boolean }> = ({ isCollected }) => {
     // Structure: Group (Bobbing) -> Group (Spinning Y) -> Mesh (Rotated X 90)
     const groupRef = useRef<THREE.Group>(null);
     
     useFrame((state, delta) => {
        if(groupRef.current) {
            // Scale logic - drastically increased speed for snappier disappearance
            const targetScale = isCollected ? 0 : 1;
            const currentScale = groupRef.current.scale.x;
            const newScale = THREE.MathUtils.lerp(currentScale, targetScale, delta * 30);
            groupRef.current.scale.set(newScale, newScale, newScale);
            
            // Bobbing - lowered base height to 0.75 to align with Bot center
            groupRef.current.position.y = 0.75 + Math.sin(state.clock.elapsedTime * 3) * 0.1;
            
            // Spinning
            groupRef.current.rotation.y += delta * 3;
        }
     });

     return (
        <group ref={groupRef} position={[0, 0, 0]}>
            <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.35, 0.35, 0.08, 32]} />
                <meshStandardMaterial 
                    color={COLORS.gridGoal} 
                    metalness={0.8} 
                    roughness={0.2} 
                    emissive={COLORS.gridGoal} 
                    emissiveIntensity={0.4} 
                />
            </mesh>
            <pointLight distance={2} intensity={2} color={COLORS.gridGoal} position={[0, 0, 0]} />
        </group>
     )
}


const GridCell: React.FC<{ type: number; x: number; z: number; isCollected?: boolean }> = ({ type, x, z, isCollected }) => {
  if (type === 0) return null; // Void

  let color = COLORS.gridPath;
  let height = 0.5;
  let yPos = 0;
  
  if (type === 2) color = COLORS.gridStart;
  if (type === 3) color = COLORS.gridPath; // Goal sits on a path
  
  // Wall Logic
  if (type === 4) {
      color = COLORS.gridWall;
      height = 1.5; // Taller
      yPos = 0.5; // Shift up because geometry is centered
  }

  return (
    <group position={[x * CELL_SIZE, yPos, z * CELL_SIZE]}>
      <mesh receiveShadow castShadow position={[0, 0, 0]}>
        <boxGeometry args={[CELL_SIZE * 0.95, height, CELL_SIZE * 0.95]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {type === 3 && (
        <RotatingCoin isCollected={!!isCollected} />
      )}
    </group>
  );
};

const GameScene: React.FC<GameSceneProps> = ({ level, botPos, botDir, isJumping, collectedBadges }) => {
  return (
    <Canvas shadows>
      <PerspectiveCamera makeDefault position={[10, 12, 10]} fov={50} />
      <OrbitControls enableZoom={true} enablePan={true} maxPolarAngle={Math.PI / 2.2} />
      
      <ambientLight intensity={0.5} />
      <directionalLight 
        position={[10, 20, 5]} 
        intensity={1.2} 
        castShadow 
        shadow-mapSize={[1024, 1024]}
      />
      
      {/* Background/Environment */}
      <Environment preset="city" />
      <color attach="background" args={['#f1f5f9']} />

      {/* Grid Generation */}
      <group position={[-(level.grid[0].length * CELL_SIZE)/2, 0, -(level.grid.length * CELL_SIZE)/2]}>
        {level.grid.map((row, z) => 
          row.map((cellType, x) => (
            <GridCell 
              key={`${x}-${z}`} 
              type={cellType} 
              x={x} 
              z={z}
              isCollected={collectedBadges.has(`${x},${z}`)}
            />
          ))
        )}
        
        {/* The Player */}
        <Bot pos={botPos} dir={botDir} isJumping={isJumping} />
      </group>

      {/* Floor Plane for infinite feel */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color={COLORS.gridBase} />
      </mesh>
    </Canvas>
  );
};

export default GameScene;