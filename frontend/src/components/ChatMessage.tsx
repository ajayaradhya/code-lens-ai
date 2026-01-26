import { MarkdownRenderer } from "./MarkdownRenderer";
import { Info, Cpu } from "lucide-react";

interface ChatMessageProps {
  m: any;
  isStreaming: boolean;
  isLast: boolean;
  getGithubLink: (path: string, line?: number) => string;
  onOpenInspector: () => void;
}

export function ChatMessage({ m, isStreaming, isLast, getGithubLink, onOpenInspector }: ChatMessageProps) {
  const isAI = m.role === 'ai';

  return (
    <div className="group flex gap-4 md:gap-6 py-10 border-b border-[#2d2f31] last:border-0 animate-in fade-in slide-in-from-bottom-2">
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-[10px] shadow-sm ${
        m.role === 'user' ? 'bg-[#3c4043] text-white' : 'bg-[#1a73e8] text-white'
      }`}>
        {m.role === 'user' ? "U" : "AI"}
      </div>
      
      {/* Content Area */}
      <div className="flex-1 min-w-0">
        <div className="prose prose-invert max-w-none">
          <MarkdownRenderer content={m.content} getGithubLink={getGithubLink} />
        </div>
        
        {/* Streaming Indicator */}
        {isStreaming && isLast && isAI && <LoadingPulse />}

        {/* Retrieval Metadata Footer */}
        {!isStreaming && isAI && m.metadata && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/5">
            <button 
              onClick={onOpenInspector}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1e1f20] border border-[#3c4043] text-[10px] font-bold text-[#8ab4f8] hover:bg-[#2d2f31] hover:border-[#4f5255] transition-all group/btn"
            >
              <Info size={14} className="group-hover/btn:rotate-12 transition-transform" />
              SOURCES & RETRIEVAL DETAILS
              <span className="bg-[#8ab4f8]/10 px-1.5 rounded text-[9px] ml-1">
                {m.metadata.snippets?.length || 0}
              </span>
            </button>

            <div className="flex items-center gap-2 text-[9px] font-mono text-[#5f6368] uppercase tracking-widest bg-white/5 px-2 py-1 rounded">
              <Cpu size={12} />
              {m.metadata.model?.split('/').pop() || 'GEMINI-PRO'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingPulse() {
  return (
    <div className="mt-4 flex gap-1.5 items-center">
      <div className="w-1.5 h-1.5 bg-[#8ab4f8] rounded-full animate-bounce [animation-delay:-0.3s]" />
      <div className="w-1.5 h-1.5 bg-[#8ab4f8] rounded-full animate-bounce [animation-delay:-0.15s]" />
      <div className="w-1.5 h-1.5 bg-[#8ab4f8] rounded-full animate-bounce" />
    </div>
  );
}