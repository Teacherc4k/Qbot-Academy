import React from 'react';
import { BlockType, CodeBlock, GameStatus } from '../types';
import { COLORS } from '../constants';
import { ArrowUp, ArrowLeft, ArrowRight, Upload, Play, RefreshCw, Trash2, Plus } from 'lucide-react';

// Fix for Missing JSX Intrinsic Elements in TypeScript
declare global {
  namespace JSX {
    interface IntrinsicElements {
      div: any;
      button: any;
      span: any;
      h2: any;
      h3: any;
      p: any;
    }
  }
}

interface BlockEditorProps {
  code: CodeBlock[];
  setCode: (code: CodeBlock[]) => void;
  onRun: () => void;
  onReset: () => void;
  isRunning: boolean;
  gameStatus: GameStatus;
  activeLine: number;
}

const BlockButton: React.FC<{ type: BlockType; onClick: () => void; color: string; icon: React.ReactNode; label: string }> = ({ onClick, color, icon, label }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 px-4 py-3 rounded-lg shadow-md hover:scale-105 transition-transform text-white font-bold w-full mb-2"
    style={{ backgroundColor: color }}
  >
    {icon}
    <span>{label}</span>
  </button>
);

const BlockEditor: React.FC<BlockEditorProps> = ({ code, setCode, onRun, onReset, isRunning, gameStatus, activeLine }) => {
  
  const addBlock = (type: BlockType) => {
    if (isRunning) return;
    const newBlock: CodeBlock = {
      id: Math.random().toString(36).substr(2, 9),
      type,
    };
    setCode([...code, newBlock]);
  };

  const removeBlock = (index: number) => {
    if (isRunning) return;
    const newCode = [...code];
    newCode.splice(index, 1);
    setCode(newCode);
  };

  const getBlockColor = (type: BlockType) => {
    switch (type) {
      case BlockType.MOVE: return COLORS.blockMove;
      case BlockType.TURN_LEFT: return COLORS.blockLeft;
      case BlockType.TURN_RIGHT: return COLORS.blockRight;
      case BlockType.JUMP: return COLORS.blockJump;
      default: return '#ccc';
    }
  };

  const getBlockLabel = (type: BlockType) => {
    switch (type) {
      case BlockType.MOVE: return 'Move Forward';
      case BlockType.TURN_LEFT: return 'Turn Left';
      case BlockType.TURN_RIGHT: return 'Turn Right';
      case BlockType.JUMP: return 'Jump';
    }
  };

  const getBlockIcon = (type: BlockType) => {
     switch (type) {
      case BlockType.MOVE: return <ArrowUp size={18} />;
      case BlockType.TURN_LEFT: return <ArrowLeft size={18} />;
      case BlockType.TURN_RIGHT: return <ArrowRight size={18} />;
      case BlockType.JUMP: return <Upload size={18} />;
    }
  };

  // Run is only allowed when IDLE (not running, not lost, not won) and code exists
  const canRun = gameStatus === GameStatus.IDLE && code.length > 0;

  return (
    <div className="flex flex-col h-full bg-white border-l border-c4k-slate-200">
      {/* Header */}
      <div className="p-4 bg-c4k-blue-50 border-b border-c4k-blue-100">
        <h2 className="text-xl font-bold text-c4k-blue-700 flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-c4k-secondary-orange animate-pulse"/>
          Program
        </h2>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Palette (Left Side of Editor) */}
        <div className="w-48 bg-c4k-slate-50 p-4 border-r border-c4k-slate-200 overflow-y-auto">
          <h3 className="text-xs font-bold text-c4k-slate-400 uppercase mb-4 tracking-wider">Actions</h3>
          <BlockButton 
            type={BlockType.MOVE} 
            color={COLORS.blockMove} 
            icon={<ArrowUp size={18} />}
            label="Move"
            onClick={() => addBlock(BlockType.MOVE)} 
          />
          <BlockButton 
            type={BlockType.TURN_LEFT} 
            color={COLORS.blockLeft} 
            icon={<ArrowLeft size={18} />}
            label="Left"
            onClick={() => addBlock(BlockType.TURN_LEFT)} 
          />
          <BlockButton 
            type={BlockType.TURN_RIGHT} 
            color={COLORS.blockRight} 
            icon={<ArrowRight size={18} />}
            label="Right"
            onClick={() => addBlock(BlockType.TURN_RIGHT)} 
          />
           <BlockButton 
            type={BlockType.JUMP} 
            color={COLORS.blockJump} 
            icon={<Upload size={18} />}
            label="Jump"
            onClick={() => addBlock(BlockType.JUMP)} 
          />
        </div>

        {/* Workspace (Right Side of Editor) */}
        <div className="flex-1 p-4 bg-c4k-slate-100 overflow-y-auto relative">
           {code.length === 0 && (
             <div className="absolute inset-0 flex items-center justify-center text-c4k-slate-400 pointer-events-none">
               <div className="text-center">
                 <Plus size={48} className="mx-auto mb-2 opacity-20" />
                 <p>Add blocks to start coding</p>
               </div>
             </div>
           )}

           <div className="space-y-2">
             <div className="flex items-center gap-2 p-2 bg-c4k-slate-700 text-white rounded-t-md font-mono text-sm">
               <div className="w-3 h-3 rounded-full bg-red-500" />
               <div className="w-3 h-3 rounded-full bg-yellow-500" />
               <div className="w-3 h-3 rounded-full bg-green-500" />
               <span className="ml-2">main()</span>
             </div>
             
             <div className="min-h-[300px] p-2 bg-c4k-slate-200/50 rounded-b-md border-2 border-dashed border-c4k-slate-300">
               {code.map((block, index) => (
                 <div 
                  key={block.id} 
                  className={`relative flex items-center gap-3 p-3 mb-2 rounded-md shadow-sm transition-all text-white font-medium cursor-pointer group ${activeLine === index ? 'ring-4 ring-yellow-400 scale-105 z-10' : ''}`}
                  style={{ backgroundColor: getBlockColor(block.type) }}
                 >
                   <span className="opacity-50 font-mono text-xs">{index + 1}</span>
                   {getBlockIcon(block.type)}
                   <span>{getBlockLabel(block.type)}</span>
                   
                   {!isRunning && (
                     <button 
                      onClick={() => removeBlock(index)}
                      className="absolute right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-white/20 rounded"
                     >
                       <Trash2 size={16} />
                     </button>
                   )}
                 </div>
               ))}
             </div>
           </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="p-4 bg-white border-t border-c4k-slate-200 flex items-center justify-between">
         <div className="text-sm text-c4k-slate-500">
           {code.length} Blocks Used
         </div>
         <div className="flex gap-2">
           <button 
            onClick={onReset}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-2 text-c4k-slate-600 bg-c4k-slate-100 hover:bg-c4k-slate-200 rounded-lg font-bold transition-colors disabled:opacity-50"
           >
             <RefreshCw size={18} />
             Reset
           </button>
           <button 
            onClick={onRun}
            disabled={!canRun}
            className={`flex items-center gap-2 px-6 py-2 text-white rounded-lg font-bold shadow-lg transition-all 
              ${!canRun ? 'bg-c4k-slate-300 cursor-not-allowed' : 'bg-c4k-secondary-green hover:bg-green-600 hover:-translate-y-1'}
            `}
           >
             <Play size={18} fill="currentColor" />
             {isRunning ? 'Running...' : 'Run Code'}
           </button>
         </div>
      </div>
    </div>
  );
};

export default BlockEditor;