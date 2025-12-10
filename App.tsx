import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Brain, LayoutGrid, ChevronRight, Download, GraduationCap, AlertTriangle, Award, RefreshCw, Shield, Lock, Share2 } from 'lucide-react';
import GameScene from './components/GameScene';
import BlockEditor from './components/BlockEditor';
import { INITIAL_LEVELS, ANIMATION_SPEED } from './constants';
import { LevelData, GridPos, Direction, CodeBlock, BlockType, GameStatus } from './types';
import { generateLevel } from './services/geminiService';

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

  // UI State
  const [shareBtnText, setShareBtnText] = useState("Share");

  // Initialize Level
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
        setLevels([...levels, newLevel]);
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

  const handleShare = async () => {
    const shareData = {
      title: 'Qbo Academy',
      text: 'Check out this 3D coding game! Can you solve the puzzles?',
      url: window.location.href
    };

    try {
      if (navigator.share && /mobile|android|iphone/i.test(navigator.userAgent)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setShareBtnText("Copied!");
        setTimeout(() => setShareBtnText("Share"), 2000);
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  const isLastLevel = currentLevelIdx === levels.length - 1;
  const isOrientationComplete = earnedBadges.includes(6); // Assuming Level 6 ID is 6

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
               // Locking Logic: Level 0 is always open. Level N is open if N-1 is in earnedBadges.
               const isLocked = idx > 0 && !earnedBadges.includes(levels[idx - 1].id);
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
            title="Share Game"
          >
            <Share2 size={18} />
            <span className="hidden sm:inline">{shareBtnText}</span>
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
              <img src="logo.png" alt="Code 4 Kids" className="h-12 w-auto drop-shadow-sm" />
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
                         {Array.from({ length: currentLevelIdx + 1 }).map((_, i) => (
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
                      } else {
                        const next = currentLevelIdx + 1;
                        setCurrentLevelIdx(next);
                        setCurrentLevel(levels[next]);
                        setCode([]);
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

      {/* AI Modal */}
      {showAiModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
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