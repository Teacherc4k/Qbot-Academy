import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Brain, LayoutGrid, ChevronRight, Download, GraduationCap, AlertTriangle, Award, RefreshCw, Shield, Lock, Share2, Copy, X, ExternalLink } from 'lucide-react';
import GameScene from './components/GameScene';
import BlockEditor from './components/BlockEditor';
import { INITIAL_LEVELS, ANIMATION_SPEED } from './constants';
import { LevelData, GridPos, Direction, CodeBlock, BlockType, GameStatus } from './types';
import { generateLevel } from './services/geminiService';

// Fix for Missing JSX Intrinsic Elements in TypeScript
declare global {
  namespace JSX {
    interface IntrinsicElements {
      div: any;
      header: any;
      h1: any;
      h2: any;
      h3: any;
      p: any;
      span: any;
      button: any;
      img: any;
      label: any;
      textarea: any;
      svg: any;
      polyline: any;
      input: any;
      strong: any;
      path: any;
      rect: any;
      text: any;
      tspan: any;
      g: any;
    }
  }
}

// Robust Unicode Base64 Encoding/Decoding
const encodeLevel = (level: LevelData) => {
  try {
    const json = JSON.stringify(level);
    const text = new TextEncoder().encode(json);
    const binString = Array.from(text, (byte) => String.fromCodePoint(byte)).join("");
    return btoa(binString);
  } catch (e) {
    console.error("Encoding failed", e);
    return "";
  }
};

const decodeLevel = (encoded: string): LevelData | null => {
  try {
    // Handle URL encoded chars if present
    const cleanEncoded = decodeURIComponent(encoded);
    const binString = atob(cleanEncoded);
    const bytes = Uint8Array.from(binString, (m) => m.codePointAt(0)!);
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json);
  } catch (e) {
    console.error("Decoding failed", e);
    return null;
  }
};

const App: React.FC = () => {
  // Game State
  const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
  const [levels, setLevels] = useState<LevelData[]>(INITIAL_LEVELS);
  const [currentLevel, setCurrentLevel] = useState<LevelData>(INITIAL_LEVELS[0]);
  
  // Player State
  const [botPos, setBotPos] = useState<GridPos>({ x: 0, y: 0, z: 0 });
  const [botDir, setBotDir] = useState<Direction>(Direction.EAST);
  const [isJumping, setIsJumping] = useState(false);
  const [collectedBadges, setCollectedBadges] = useState<Set<string>>(new Set());
  const [earnedBadges, setEarnedBadges] = useState<(number | string)[]>([]);
  
  // Execution State
  const [code, setCode] = useState<CodeBlock[]>([]);
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.IDLE);
  const [activeLine, setActiveLine] = useState<number>(-1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // AI Generator State
  const [aiPrompt, setAiPrompt] = useState("");
  const [showAiModal, setShowAiModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Sharing State
  const [showShareModal, setShowShareModal] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  const [copyFeedback, setCopyFeedback] = useState("Copy Link");

  // Load level from URL on mount
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;

      // 1. Custom Level (#c=...)
      if (hash.startsWith('#c=')) {
        const encodedData = hash.substring(3);
        const customLevel = decodeLevel(encodedData);
        if (customLevel) {
          setLevels(prev => {
            // Avoid duplicates
            if (prev.find(l => l.id === customLevel.id)) return prev;
            return [...prev, customLevel];
          });
          setCurrentLevel(customLevel);
          // We can't easily know the index in 'levels' state during mount, 
          // so we set it to INITIAL_LEVELS length as a safe bet for "new" content
          setCurrentLevelIdx(INITIAL_LEVELS.length); 
        }
      } 
      // 2. Standard Level (#level=X)
      else if (hash.startsWith('#level=')) {
        const lvlNum = parseInt(hash.split('=')[1]);
        if (!isNaN(lvlNum) && lvlNum >= 1 && lvlNum <= INITIAL_LEVELS.length) {
          const idx = lvlNum - 1;
          setCurrentLevelIdx(idx);
          setCurrentLevel(INITIAL_LEVELS[idx]);
        }
      }
    };

    // Run on mount
    handleHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Initialize Level State when level changes
  useEffect(() => {
    resetLevelState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLevel]);

  const resetLevelState = () => {
    // Find start pos
    let startPos = { x: 0, y: 0, z: 0 };
    currentLevel.grid.forEach((row, z) => {
      row.forEach((cell, x) => {
        if (cell === 2) startPos = { x, y: 0, z };
      });
    });

    setBotPos(startPos);
    setBotDir(currentLevel.startDir);
    setGameStatus(GameStatus.IDLE);
    setActiveLine(-1);
    setIsJumping(false);
    setErrorMsg(null);
    setCollectedBadges(new Set());
  };

  const getNextPos = (pos: GridPos, dir: Direction, dist: number = 1): GridPos => {
    let newX = pos.x;
    let newZ = pos.z;

    switch (dir) {
      case Direction.NORTH: newZ -= dist; break;
      case Direction.SOUTH: newZ += dist; break;
      case Direction.EAST: newX += dist; break;
      case Direction.WEST: newX -= dist; break;
    }
    return { x: newX, y: 0, z: newZ };
  };

  const runCode = async () => {
    setGameStatus(GameStatus.RUNNING);
    setErrorMsg(null);
    
    // Reset position first
    resetLevelState();
    // Wait for reset to render
    await new Promise(r => setTimeout(r, 100));

    let currentPos = { ...botPos }; 
    // Re-find start pos for authoritative state
    currentLevel.grid.forEach((row, z) => {
      row.forEach((cell, x) => {
        if (cell === 2) currentPos = { x, y: 0, z };
      });
    });
    let currentDir = currentLevel.startDir;
    
    const runCollected = new Set<string>();
    // Check if start pos has a badge (unlikely but possible)
    if (currentLevel.grid[currentPos.z][currentPos.x] === 3) {
      runCollected.add(`${currentPos.x},${currentPos.z}`);
      setCollectedBadges(new Set(runCollected));
    }

    // Execution Loop
    for (let i = 0; i < code.length; i++) {
      setActiveLine(i);
      const block = code[i];

      let nextPos = { ...currentPos };
      let nextDir = currentDir;
      let isJumpAction = false;

      switch (block.type) {
        case BlockType.MOVE:
          nextPos = getNextPos(currentPos, currentDir, 1);
          break;
        case BlockType.JUMP:
          nextPos = getNextPos(currentPos, currentDir, 2); // Jump over 1 square
          isJumpAction = true;
          break;
        case BlockType.TURN_LEFT:
          nextDir = (currentDir - 1 + 4) % 4;
          break;
        case BlockType.TURN_RIGHT:
          nextDir = (currentDir + 1) % 4;
          break;
      }

      // Check Bounds & Collision
      const gridHeight = currentLevel.grid.length;
      const gridWidth = currentLevel.grid[0].length;

      // Logic check for Move/Jump
      if (block.type === BlockType.MOVE || block.type === BlockType.JUMP) {
        // Out of bounds?
        if (nextPos.x < 0 || nextPos.x >= gridWidth || nextPos.z < 0 || nextPos.z >= gridHeight) {
          setGameStatus(GameStatus.LOST);
          setErrorMsg("Qbo fell off the world!");
          return;
        }

        // Get cell type
        const cellType = currentLevel.grid[nextPos.z][nextPos.x];

        // Hit void?
        if (cellType === 0) {
           setGameStatus(GameStatus.LOST);
           setErrorMsg("Qbo fell into the void!");
           return;
        }

        // Hit Wall?
        if (cellType === 4) {
          setGameStatus(GameStatus.LOST);
          setErrorMsg("Qbo crashed into a wall!");
          return;
        }
      }

      // 1. Update State to Start Animation
      currentPos = nextPos;
      currentDir = nextDir;
      
      setBotPos(currentPos);
      setBotDir(currentDir);
      
      if (isJumpAction) {
          setIsJumping(true);
          // Jump duration matches movement duration to allow full arc
          setTimeout(() => setIsJumping(false), ANIMATION_SPEED * 0.95);
      }

      // 2. Wait for "Arrival"
      // Wait 20% of the step time (approx 160ms).
      // With the smoother (slower) bot movement, this ensures coin vanishes as the bot *begins* to enter the space.
      await new Promise(r => setTimeout(r, ANIMATION_SPEED * 0.2));

      // 3. Collection Check (Trigger Visual)
      if (currentLevel.grid[currentPos.z][currentPos.x] === 3) {
          const key = `${currentPos.x},${currentPos.z}`;
          if (!runCollected.has(key)) {
            runCollected.add(key);
            setCollectedBadges(new Set(runCollected));
          }
      }

      // 4. Wait remaining time for the "Pause" effect (80% remaining)
      // This allows the bot to fully settle (float) into position before the next move.
      await new Promise(r => setTimeout(r, ANIMATION_SPEED * 0.8));
    }

    // End of Code
    // Small delay after last action before showing result
    await new Promise(r => setTimeout(r, 500)); 
    setActiveLine(-1);

    // Win Check: Must collect ALL badges
    const totalBadges = currentLevel.grid.flat().filter(c => c === 3).length;
    
    if (runCollected.size === totalBadges) {
      setGameStatus(GameStatus.WON);
      if (!earnedBadges.includes(currentLevel.id)) {
        setEarnedBadges(prev => [...prev, currentLevel.id]);
      }
    } else {
      setGameStatus(GameStatus.LOST);
      setErrorMsg(`Goal not reached.`);
    }
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt) return;
    setIsGenerating(true);
    try {
      const newLevel = await generateLevel(aiPrompt);
      if (newLevel) {
        setLevels(prev => [...prev, newLevel]);
        setCurrentLevelIdx(levels.length); // Index of the new one
        setCurrentLevel(newLevel);
        setShowAiModal(false);
      }
    } catch (e) {
      setErrorMsg("Failed to generate level.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Qbo Academy - ${currentLevel.name}</title>
  <style>
    body { font-family: sans-serif; padding: 2rem; background: #f8fafc; color: #1e3a8a; }
    h1 { color: #2563eb; }
    .block { padding: 10px; margin: 5px; color: white; border-radius: 5px; font-weight: bold; width: fit-content; }
    .MOVE { background-color: #2563eb; }
    .TURN_LEFT { background-color: #a855f7; }
    .TURN_RIGHT { background-color: #f97316; }
    .JUMP { background-color: #84cc16; }
  </style>
</head>
<body>
  <h1>Level Solved: ${currentLevel.name}</h1>
  <p><strong>Status:</strong> ${gameStatus === GameStatus.WON ? "SUCCESS" : "IN PROGRESS"}</p>
  <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
  <hr/>
  <h2>Your Code:</h2>
  <div>
    ${code.map((b, i) => `<div class="block ${b.type}">${i + 1}. ${b.type.replace('_', ' ')}</div>`).join('')}
  </div>
</body>
</html>
    `;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qbo-${currentLevel.name.replace(/\s+/g, '-').toLowerCase()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleShare = () => {
    // Construct base URL without hash or query params
    const baseUrl = window.location.origin + window.location.pathname;
    let shareUrl = "";

    // Check if it's a generated/custom level
    if (typeof currentLevel.id === 'string' && currentLevel.id.startsWith('gen-')) {
       const encodedData = encodeLevel(currentLevel);
       // Use hash #c= for custom levels to avoid sending huge data to server (431 error)
       shareUrl = `${baseUrl}#c=${encodeURIComponent(encodedData)}`;
    } else {
       // Standard level
       shareUrl = `${baseUrl}#level=${currentLevelIdx + 1}`;
    }

    setGeneratedLink(shareUrl);
    setCopyFeedback("Copy Link");
    setShowShareModal(true);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopyFeedback("Copied!");
      setTimeout(() => setCopyFeedback("Copy Link"), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
      setCopyFeedback("Failed");
    }
  };

  const isLastLevel = currentLevelIdx === levels.length - 1;
  const isOrientationComplete = earnedBadges.includes(6); // Assuming Level 6 ID is 6
  const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  return (
    <div className="h-screen flex flex-col font-sans text-c4k-slate-700 bg-c4k-slate-50">
      
      {/* Top Navigation */}
      <header className="h-16 bg-white border-b border-c4k-slate-200 flex items-center justify-between px-6 z-20 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-c4k-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-c4k-blue-200">
            Q
          </div>
          <h1 className="text-xl font-bold tracking-tight text-c4k-slate-800">Qbo <span className="text-c4k-blue-500">Academy</span>: Orientation</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 mr-4">
            {levels.map((lvl, idx) => {
               // Logic: Standard levels lock. Generated levels are just append to end and don't affect locking.
               const isStandard = typeof lvl.id === 'number';
               
               // Locking Logic: Level 0 is always open. Level N is open if N-1 is in earnedBadges.
               // We only lock standard levels for now.
               const isLocked = isStandard && idx > 0 && idx < INITIAL_LEVELS.length && !earnedBadges.includes(levels[idx - 1].id);
               
               const isCompleted = earnedBadges.includes(lvl.id);
               
               return (
               <button 
                 key={lvl.id}
                 disabled={isLocked}
                 onClick={() => {
                   if (isLocked) return;
                   setCurrentLevelIdx(idx);
                   setCurrentLevel(levels[idx]);
                   setCode([]);
                   // Clear query params if switching to standard levels
                   if (isStandard) {
                       window.location.hash = `level=${idx + 1}`;
                   }
                 }}
                 className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all relative
                   ${currentLevelIdx === idx ? 'bg-c4k-blue-500 text-white scale-110 shadow-lg' : 
                     isLocked ? 'bg-c4k-slate-200 text-c4k-slate-400 cursor-not-allowed' :
                     isCompleted ? 'bg-c4k-secondary-green/20 text-c4k-secondary-green border-2 border-c4k-secondary-green/50 hover:bg-c4k-secondary-green hover:text-white' :
                     'bg-c4k-slate-100 text-c4k-slate-400 hover:bg-c4k-slate-200'
                   }
                   `}
                 title={isLocked ? "Complete previous module to unlock" : lvl.name}
               >
                 {isLocked ? <Lock size={12} /> : idx + 1}
               </button>
            )})}
          </div>

          <button 
            onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2 text-c4k-slate-600 bg-c4k-slate-100 hover:bg-c4k-slate-200 rounded-lg font-bold transition-colors"
            title="Get Shareable Link"
          >
            <Share2 size={18} />
            <span className="hidden sm:inline">Share</span>
          </button>

          <button
            onClick={handleDownload}
            disabled={code.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-c4k-blue-600 bg-c4k-blue-50 hover:bg-c4k-blue-100 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Download Solution HTML"
          >
            <Download size={18} />
            <span className="hidden sm:inline">Save</span>
          </button>
          
          <button 
            onClick={() => setShowAiModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-c4k-secondary-purple to-c4k-secondary-pink text-white rounded-full font-bold shadow-md hover:opacity-90 transition-opacity"
          >
            <Sparkles size={16} />
            <span>AI Designer</span>
          </button>
        </div>
      </header>

      {/* Main Game Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left: 3D View */}
        <div className="flex-1 relative bg-c4k-slate-50 flex flex-col">
          <div className="flex-1 relative">
            <GameScene 
              level={currentLevel} 
              botPos={botPos} 
              botDir={botDir} 
              isJumping={isJumping}
              collectedBadges={collectedBadges}
            />
            
            {/* Level Info Overlay */}
            <div className="absolute top-6 left-6 bg-white/90 backdrop-blur p-4 rounded-xl shadow-lg max-w-sm border border-c4k-slate-200">
              <h2 className="text-xl font-bold text-c4k-blue-700 mb-1">{currentLevel.name}</h2>
              <p className="text-c4k-slate-500 text-sm mb-3">{currentLevel.description}</p>
            </div>

            {/* Company Logo Watermark - Discreet Bottom Right */}
            <div className="absolute bottom-6 right-6 opacity-60 hover:opacity-100 transition-opacity pointer-events-none select-none z-10">
              <svg width="200" height="50" viewBox="0 0 200 50" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-10 w-auto drop-shadow-sm">
                <path d="M10 10H40C42.7614 10 45 12.2386 45 15V35C45 37.7614 42.7614 40 40 40H10C7.23858 40 5 37.7614 5 35V15C5 12.2386 7.23858 10 10 10Z" fill="#3b82f6"/>
                <path d="M18 18L25 25L18 32" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M32 32L25 25L32 18" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                <text x="55" y="33" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="24" fill="#1e3a8a" letterSpacing="-0.5">
                  Code<tspan fill="#84cc16">4</tspan>Kids
                </text>
              </svg>
            </div>

            {/* Status Overlay */}
            {gameStatus === GameStatus.WON && (
              <div className="absolute inset-0 bg-c4k-secondary-green/20 backdrop-blur-sm flex items-center justify-center z-10">
                <div className="bg-white p-8 rounded-2xl shadow-2xl text-center border-4 border-c4k-secondary-green max-w-md w-full mx-4">
                  {/* Visual Reward Area */}
                  <div className="flex justify-center mb-6 min-h-[64px] items-center">
                    {isLastLevel ? (
                      // Level 6: Show Badge
                      <div className="flex flex-col items-center gap-2">
                        <div className="relative">
                           <Shield size={80} className="text-c4k-secondary-green drop-shadow-md" fill="currentColor" />
                           <div className="absolute inset-0 flex items-center justify-center">
                              <Sparkles className="text-white animate-pulse" size={40} />
                           </div>
                        </div>
                        <span className="text-c4k-secondary-green font-bold text-sm tracking-widest uppercase">Badge Earned</span>
                      </div>
                    ) : (
                      // Levels 1-5: Show Coins corresponding to level count
                      <div className="flex gap-2">
                         {Array.from({ length: Math.min(6, currentLevelIdx + 1) }).map((_, i) => (
                            <div key={i} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-c4k-blue-500 border-2 border-white shadow-lg animate-in zoom-in duration-500" style={{ animationDelay: `${i * 100}ms` }} />
                         ))}
                      </div>
                    )}
                  </div>

                  <h2 className="text-3xl sm:text-4xl font-extrabold text-c4k-secondary-green mb-2">
                    {isLastLevel ? "Orientation Complete!" : "Module Complete!"}
                  </h2>
                  <p className="text-c4k-slate-600 mb-6">
                    {isLastLevel 
                      ? "Congratulations! You have earned the Orientation Badge." 
                      : "Excellent work. Proceed to the next training module."}
                  </p>
                  <button 
                    onClick={() => {
                      if (isLastLevel) {
                        // Restart
                        setCurrentLevelIdx(0);
                        setCurrentLevel(levels[0]);
                        setCode([]);
                        window.location.hash = 'level=1';
                      } else {
                        const next = currentLevelIdx + 1;
                        if (next < levels.length) {
                            setCurrentLevelIdx(next);
                            setCurrentLevel(levels[next]);
                            setCode([]);
                            window.location.hash = `level=${next + 1}`;
                        } else {
                           // End of all levels
                        }
                      }
                    }}
                    className="px-8 py-3 bg-c4k-secondary-green text-white rounded-xl font-bold text-lg hover:bg-green-600 transition-colors flex items-center gap-2 mx-auto"
                  >
                    {isLastLevel ? (
                      <>Restart Orientation <RefreshCw size={20} /></>
                    ) : (
                      <>Next Module <ChevronRight size={20} /></>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Error Toast (Non-blocking) */}
            {gameStatus === GameStatus.LOST && (
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="bg-white px-6 py-4 rounded-xl shadow-2xl border-l-8 border-c4k-secondary-red flex items-center gap-4">
                  <div className="bg-c4k-secondary-red/10 text-c4k-secondary-red p-3 rounded-full">
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-c4k-secondary-red text-lg">System Failure</h3>
                    <p className="text-c4k-slate-600 font-medium">{errorMsg || "Try again."}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Footer: Badges / Certification */}
          <div className="h-20 bg-white border-t border-c4k-slate-200 flex items-center px-6 gap-6 shrink-0 justify-between">
             <div className="flex flex-col">
               <span className="text-xs font-bold text-c4k-slate-400 uppercase tracking-wider">Certifications</span>
               <span className="text-lg font-bold text-c4k-slate-800">My Badges</span>
             </div>
             
             <div className="flex items-center gap-4">
                {/* Orientation Badge - Only shows when Level 6 is complete */}
                <div className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${isOrientationComplete ? 'opacity-100' : 'opacity-40 grayscale'}`}>
                    <div className="w-12 h-12 bg-c4k-blue-100 rounded-full flex items-center justify-center border-2 border-c4k-blue-500 shadow-sm relative overflow-hidden">
                       <Shield size={24} className="text-c4k-blue-600" fill="currentColor" />
                       {isOrientationComplete && (
                         <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" className="w-3 h-3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                         </div>
                       )}
                    </div>
                    <span className="text-xs font-bold text-c4k-blue-900">Orientation</span>
                </div>
                
                {/* Placeholder for future badges */}
                 <div className="flex flex-col items-center gap-1 p-2 rounded-lg opacity-20 grayscale">
                    <div className="w-12 h-12 bg-c4k-slate-100 rounded-full flex items-center justify-center border-2 border-c4k-slate-300">
                       <div className="w-6 h-6 rounded-full bg-c4k-slate-300" />
                    </div>
                    <span className="text-xs font-bold text-c4k-slate-900">Navigation</span>
                </div>
             </div>
          </div>
        </div>

        {/* Right: Code Editor */}
        <div className="w-[450px] shadow-2xl z-10">
          <BlockEditor 
            code={code} 
            setCode={setCode} 
            onRun={runCode} 
            onReset={resetLevelState}
            isRunning={gameStatus === GameStatus.RUNNING}
            gameStatus={gameStatus}
            activeLine={activeLine}
          />
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-c4k-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-c4k-slate-800 flex items-center gap-2">
                <Share2 size={20} className="text-c4k-blue-500" />
                Share Level
              </h3>
              <button 
                onClick={() => setShowShareModal(false)}
                className="text-c4k-slate-400 hover:text-c4k-slate-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-c4k-slate-600">
                Send this link to anyone. They can play this exact level instantly, no account required.
              </p>
              
              <div className="flex gap-2">
                <input 
                  type="text" 
                  readOnly 
                  value={generatedLink}
                  className="flex-1 bg-c4k-slate-50 border border-c4k-slate-300 rounded-lg px-4 py-3 text-sm text-c4k-slate-600 focus:outline-none select-all"
                  onClick={(e) => e.currentTarget.select()}
                />
                <button 
                  onClick={copyToClipboard}
                  className="bg-c4k-blue-500 hover:bg-c4k-blue-600 text-white font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-2 min-w-[120px] justify-center"
                >
                  <Copy size={18} />
                  {copyFeedback}
                </button>
              </div>

              {isLocalhost && (
                <div className="flex items-start gap-3 bg-amber-50 p-4 rounded-lg border border-amber-200 text-amber-800 text-sm">
                   <AlertTriangle className="shrink-0 mt-0.5" size={16} />
                   <div>
                     <strong>You are on localhost.</strong> The link above will only work for you. To share with others, you must deploy this app to the web (e.g., GitHub Pages, Vercel).
                   </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Modal */}
      {showAiModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-c4k-secondary-purple to-c4k-secondary-pink p-6">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                <Sparkles />
                AI Level Architect
              </h3>
              <p className="text-white/80 text-sm mt-1">Powered by Google Gemini</p>
            </div>
            
            <div className="p-6 space-y-4">
               <div>
                <label className="block text-sm font-bold text-c4k-slate-700 mb-1">Describe Training Simulation</label>
                <textarea 
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g., A spiral maze that requires jumping over voids, very hard difficulty."
                  className="w-full border border-c4k-slate-300 rounded-lg p-3 h-32 focus:ring-2 focus:ring-c4k-secondary-purple focus:border-transparent outline-none transition-all resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setShowAiModal(false)}
                  className="flex-1 py-3 bg-c4k-slate-100 text-c4k-slate-600 font-bold rounded-lg hover:bg-c4k-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAiGenerate}
                  disabled={!aiPrompt || isGenerating}
                  className="flex-1 py-3 bg-c4k-secondary-purple text-white font-bold rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Designing...
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      Generate Level
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;