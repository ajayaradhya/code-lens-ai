import { Send, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ChatInput({ query, setQuery, status, isStreaming, onSubmit }: any) {
  return (
    <div className="absolute bottom-0 left-0 w-full p-8 bg-gradient-to-t from-[#131314] via-[#131314] to-transparent">
      <div className="max-w-[850px] mx-auto">
        <div className={`flex items-center p-2 rounded-[32px] border transition-all duration-500 shadow-2xl ${
          status === 'ready' ? 'bg-[#1e1f20] border-white/10 focus-within:border-[#8ab4f8]/50' : 'bg-[#1e1f20]/50 opacity-40 pointer-events-none'
        }`}>
          <Input
            placeholder={status === 'ready' ? "Ask about code..." : "Index a repo to begin"}
            disabled={status !== 'ready' || isStreaming}
            className="border-none bg-transparent h-14 px-6 focus-visible:ring-0 text-lg placeholder:text-[#5f6368] font-light"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          />
          <Button onClick={() => onSubmit()} size="icon" className="rounded-full h-11 w-11 bg-transparent text-[#8ab4f8] hover:bg-white/5">
            {isStreaming ? <Loader2 className="animate-spin" /> : <Send size={22} />}
          </Button>
        </div>
        <p className="text-center text-[10px] text-[#5f6368] mt-4 tracking-wider uppercase">
          Powered by Gemini 1.5 Flash • Context-Aware Code Analysis
        </p>
      </div>
    </div>
  );
}