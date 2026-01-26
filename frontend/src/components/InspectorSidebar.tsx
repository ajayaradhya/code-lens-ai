import { X, FileText, Hash } from "lucide-react";
import { CodeBlock } from "./CodeBlock"; // Reuse your existing CodeBlock

export function InspectorSidebar({ data, onClose }: { data: any; onClose: () => void }) {
  if (!data) return null;

  return (
    <aside className="w-[450px] h-screen bg-[#1e1f20] border-l border-[#3c4043] flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 z-50">
      {/* Header */}
      <div className="p-4 border-b border-[#3c4043] flex items-center justify-between bg-[#131314]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-500/10 rounded">
            <FileText size={16} className="text-blue-400" />
          </div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">Retrieved Context</h2>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
          <X size={20} />
        </button>
      </div>

      {/* Info Stats */}
      <div className="p-4 grid grid-cols-2 gap-2 bg-[#1a1b1c] border-b border-[#3c4043]">
        <div className="bg-[#2a2b2e] p-2 rounded border border-white/5">
          <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest">Snippets Used</p>
          <p className="text-lg font-mono text-[#8ab4f8]">{data.snippets?.length || 0}</p>
        </div>
        <div className="bg-[#2a2b2e] p-2 rounded border border-white/5">
          <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest">Model</p>
          <p className="text-[11px] font-mono text-[#e3e3e3] truncate">{data.model?.split('/').pop()}</p>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-8 custom-scrollbar">
        {data.snippets?.map((s: any, i: number) => (
          <div key={i} className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 overflow-hidden">
                <Hash size={14} className="text-[#8ab4f8] shrink-0" />
                <span className="text-xs font-mono font-bold text-[#e3e3e3] truncate">{s.file}</span>
                <span className="text-[10px] text-gray-500 bg-white/5 px-1.5 rounded shrink-0">L{s.lines}</span>
              </div>
            </div>
            
            <div className="text-[12px]">
              <CodeBlock 
                language={s.file.split('.').pop() || 'text'} 
                content={s.content} 
              />
            </div>
            
            {s.score !== undefined && (
              <div className="flex items-center gap-2 px-2">
                <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500" 
                    style={{ width: `${Math.min(s.score * 100, 100)}%` }} 
                  />
                </div>
                <span className="text-[10px] text-gray-500 font-mono">Similarity: {s.score.toFixed(4)}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}