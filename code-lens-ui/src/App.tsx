import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Zap, Github, Send, Loader2, Plus, MessageSquare, Settings2, Info } from "lucide-react";
import { api } from "@/lib/api";

export default function App() {
  const [repoUrl, setRepoUrl] = useState("");
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string }[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleQuery = async () => {
    if (!query.trim()) return;
    const userMsg = { role: 'user' as const, content: query };
    setMessages(prev => [...prev, userMsg, { role: 'ai', content: "" }]);
    setQuery("");
    setIsStreaming(true);

    await api.query(query, (chunk) => {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        const rest = prev.slice(0, -1);
        return [...rest, { ...last, content: last.content + chunk }];
      });
    });
    setIsStreaming(false);
  };

  return (
    <div className="flex w-full h-screen bg-[#131314] text-[#e3e3e3] font-sans overflow-hidden m-0 p-0">
      
      {/* Sidebar: Gemini Dark Slate */}
      <aside className="w-[280px] bg-[#1e1f20] flex flex-col p-4 border-r border-white/5 shrink-0">
        <div className="flex items-center gap-3 px-3 py-4 mb-6">
          <Zap className="text-gemini-accent" fill="#8ab4f8" size={20} />
          <span className="font-semibold text-lg tracking-tight">CodeLens AI</span>
        </div>

        <Button variant="ghost" className="justify-start gap-3 rounded-full h-12 hover:bg-white/5 mb-8 text-gemini-subtext">
          <Plus size={20} /> <span className="text-sm">New Chat</span>
        </Button>

        <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar">
          <p className="text-[11px] font-bold text-[#9aa0a6] uppercase tracking-widest px-3 mb-2">History</p>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 text-sm border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
            <Github size={14} className="text-gemini-subtext" />
            <span className="truncate text-gemini-subtext">veridian-atlas</span>
          </div>
        </div>

        <div className="mt-auto pt-4 border-t border-white/5 flex flex-col gap-2">
          <Input 
            placeholder="GitHub Repo URL..." 
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            className="bg-[#131314] border-white/10 rounded-xl text-xs"
          />
          <Button onClick={() => api.ingest(repoUrl)} variant="outline" className="rounded-xl border-white/10 h-10 text-xs hover:bg-white/5">
            Index Codebase
          </Button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative">
        
        {/* Fixed Header */}
        <header className="h-16 flex items-center justify-between px-8 border-b border-white/5 shrink-0 bg-[#131314]/80 backdrop-blur-md z-20">
          <div className="flex items-center gap-2 font-medium">
            Gemini <span className="text-gemini-accent font-light italic">for Code</span>
          </div>
          <Settings2 size={18} className="text-[#9aa0a6] cursor-pointer" />
        </header>

        {/* Scrollable Content: This is the answer side fix */}
        <div 
          ref={scrollRef} 
          className="flex-1 overflow-y-auto custom-scrollbar flex flex-col"
        >
          <div className="max-w-[840px] w-full mx-auto px-6 py-12 flex flex-col gap-12 flex-grow">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center pb-20">
                <h2 className="text-4xl font-normal text-white mb-6">Hello, developer.</h2>
                <p className="text-[#c4c7c5] text-lg max-w-md font-light leading-relaxed">
                  I can analyze your indexed codebase to find bugs, explain logic, or document APIs.
                </p>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`flex gap-6 ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-500`}>
                  {m.role === 'ai' && (
                    <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-[#8ab4f8] to-[#4285f4] flex items-center justify-center shadow-lg shadow-blue-500/10">
                      <Zap size={16} fill="white" className="text-white" />
                    </div>
                  )}
                  
                  <div className={`flex-1 min-w-0 ${m.role === 'user' ? 'max-w-[80%] bg-[#1e1f20] p-4 rounded-2xl border border-white/5 text-[#e3e3e3]' : ''}`}>
                    <div className="prose prose-invert prose-gemini max-w-none">
                       {/* The ReactMarkdown with the custom code block goes here */}
                       <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ /* ... code logic from above ... */ }}>
                        {m.content || "..."}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* Spacer to allow scrolling past the floating input */}
          <div className="h-32 shrink-0" />
        </div>

        {/* Floating Input: Capsule Style */}
        <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-[#131314] via-[#131314] to-transparent z-10">
          <div className="max-w-[840px] mx-auto relative group">
            <div className="bg-[#1e1f20] border border-white/10 rounded-[32px] p-2 flex items-center shadow-2xl focus-within:border-[#8ab4f8]/50 transition-all duration-300">
              <Input
                placeholder="Ask about the architecture..."
                className="border-none bg-transparent h-12 px-6 focus-visible:ring-0 text-lg placeholder:text-[#9aa0a6] placeholder:font-light"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isStreaming && handleQuery()}
              />
              <Button 
                size="icon" 
                onClick={handleQuery}
                disabled={isStreaming || !query}
                className="rounded-full h-10 w-10 bg-transparent hover:bg-white/5 text-gemini-accent"
              >
                {isStreaming ? <Loader2 className="animate-spin" /> : <Send size={20} />}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}