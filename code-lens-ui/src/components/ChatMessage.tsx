import { MarkdownRenderer } from "./MarkdownRenderer";

export function ChatMessage({ m, isStreaming, isLast, getGithubLink }: any) {
  return (
    <div className="flex gap-4 md:gap-6 py-10 border-b border-[#2d2f31] last:border-0 animate-in fade-in slide-in-from-bottom-2">
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-[10px] ${
        m.role === 'user' ? 'bg-[#3c4043] text-white' : 'bg-[#1a73e8] text-white'
      }`}>
        {m.role === 'user' ? "U" : "AI"}
      </div>
      
      {/* Content Area */}
      <div className="flex-1 min-w-0">
        <div className="prose prose-invert max-w-none">
          <MarkdownRenderer content={m.content} getGithubLink={getGithubLink} />
        </div>
        
        {isStreaming && isLast && m.role === 'ai' && (
          <div className="mt-4 flex gap-1 animate-pulse">
             <div className="w-2 h-2 bg-[#8ab4f8] rounded-full" />
             <div className="w-2 h-2 bg-[#8ab4f8] rounded-full" />
             <div className="w-2 h-2 bg-[#8ab4f8] rounded-full" />
          </div>
        )}
      </div>
    </div>
  );
}