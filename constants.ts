import { LevelData } from './types';

export const CELL_SIZE = 1.5;
export const ANIMATION_SPEED = 800; // ms per step - Increased for "float & pause" feel

export const INITIAL_LEVELS: LevelData[] = [
  {
    id: 1,
    name: "Module 1: Forward Motion",
    description: "Orientation: Program Qbo to move forward to the goal.",
    startDir: 1, // Facing East
    par: 3,
    grid: [
      [0, 0, 0, 0, 0],
      [0, 2, 1, 1, 3],
      [0, 0, 0, 0, 0],
    ]
  },
  {
    id: 2,
    name: "Module 2: Turning",
    description: "Orientation: Qbo needs to turn to reach the destination.",
    startDir: 1,
    par: 4,
    grid: [
      [0, 0, 0, 0, 0, 0],
      [0, 2, 1, 1, 0, 0],
      [0, 0, 0, 1, 0, 0],
      [0, 0, 0, 3, 0, 0],
      [0, 0, 0, 0, 0, 0],
    ]
  },
  {
    id: 3,
    name: "Module 3: Obstacles",
    description: "Orientation: Avoid the walls! Navigate Qbo around the obstacles.",
    startDir: 1,
    par: 6,
    grid: [
      [0, 0, 0, 0, 0, 0],
      [0, 2, 1, 4, 1, 3],
      [0, 0, 1, 4, 1, 0],
      [0, 0, 1, 1, 1, 0],
      [0, 0, 0, 0, 0, 0],
    ]
  },
  {
    id: 4,
    name: "Module 4: Jumping",
    description: "Orientation: Use the Jump module to cross the gaps.",
    startDir: 1,
    par: 5,
    grid: [
      [0, 0, 0, 0, 0, 0],
      [0, 2, 1, 0, 1, 3],
      [0, 0, 0, 0, 0, 0],
    ]
  },
  {
    id: 5,
    name: "Module 5: Advanced Maneuvers",
    description: "Orientation: Combine turning and jumping to solve this pattern.",
    startDir: 2, // South
    par: 9,
    grid: [
      [0, 2, 0, 0, 0, 0],
      [0, 1, 0, 1, 1, 3],
      [0, 1, 0, 1, 0, 0],
      [0, 1, 1, 1, 0, 0],
      [0, 0, 0, 0, 0, 0]
    ]
  },
  {
      id: 6,
      name: "Module 6: Final Exam",
      description: "Orientation: Prove your skills. Navigate walls and voids to earn your Badge.",
      startDir: 1,
      par: 12,
      grid: [
          [0, 0, 0, 0, 0, 0, 0],
          [0, 2, 1, 1, 4, 3, 0], // Wall blocking direct path
          [0, 0, 0, 1, 4, 1, 0],
          [0, 0, 0, 1, 0, 1, 0], // Gap to jump
          [0, 0, 0, 1, 1, 1, 0],
          [0, 0, 0, 0, 0, 0, 0]
      ]
  }
];

export const COLORS = {
  blockMove: '#2563eb', // Blue 400
  blockLeft: '#a855f7', // Purple
  blockRight: '#f97316', // Orange
  blockJump: '#84cc16', // Green
  gridBase: '#cbd5e1', // Slate 300
  gridPath: '#f1f5f9', // Slate 100
  gridStart: '#93c5fd', // Blue 200
  gridGoal: '#2563eb', // Blue 500 (Badge/Coin Color)
  gridWall: '#475569', // Slate 600
  player: '#f97316',   // Orange to stand out
};