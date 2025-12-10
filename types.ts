export enum BlockType {
  MOVE = 'MOVE',
  TURN_LEFT = 'TURN_LEFT',
  TURN_RIGHT = 'TURN_RIGHT',
  JUMP = 'JUMP',
}

export interface CodeBlock {
  id: string;
  type: BlockType;
}

export interface GridPos {
  x: number;
  y: number; // Vertical height in 3D
  z: number;
}

export interface LevelData {
  id: number | string;
  name: string;
  description: string;
  grid: number[][]; // 0: Empty, 1: Path, 2: Start, 3: Goal, 4: Wall
  startDir: number; // 0: North (-z), 1: East (+x), 2: South (+z), 3: West (-x)
  par: number; // Ideal number of blocks
}

export enum GameStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  WON = 'WON',
  LOST = 'LOST',
  GENERATING = 'GENERATING',
}

export enum Direction {
  NORTH = 0,
  EAST = 1,
  SOUTH = 2,
  WEST = 3,
}