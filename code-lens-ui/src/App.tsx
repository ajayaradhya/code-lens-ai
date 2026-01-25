import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Zap, Github, Send, Loader2, Database, ExternalLink, History, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

type AppStatus = 'idle' | 'indexing' | 'ready';

export default function App() {
  // State Management
  const [repoUrl, setRepoUrl] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<AppStatus>('idle');
  const [history, setHistory] = useState<string[]>([]);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string }[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // --- ACTIONS ---

  const handleIndex = async () => {
    if (!repoUrl || status === 'indexing') return;
    setStatus('indexing');
    setMessages([]); 
    
    try {
      const response = await api.ingest(repoUrl);
      if (response) {
        setStatus('ready');
        if (!history.includes(repoUrl)) setHistory(prev => [repoUrl, ...prev]);
        setMessages([{ 
          role: 'ai', 
          content: `Successfully indexed **${repoUrl.split('/').pop()}**. You can now ask about the codebase.` 
        }]);
      }
    } catch (err) {
      setStatus('idle');
    }
  };

  const submitQuery = async () => {
    if (!query.trim() || status !== 'ready' || isStreaming) return;

    const userMsg = { role: 'user' as const, content: query };
    setMessages(prev => [...prev, userMsg, { role: 'ai', content: "" }]);
    const currentQuery = query;
    setQuery("");
    setIsStreaming(true);

    try {
      await api.query(currentQuery, (chunk) => {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          const rest = prev.slice(0, -1);
          return [...rest, { ...last, content: last.content + chunk }];
        });
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const getGithubLink = (path: string) => {
    const cleanPath = path.replace(/['`]/g, "").trim();
    
    // Remove trailing slashes from base URL
    const base = repoUrl.replace(/\/$/, '');
    const branch = "master"; 

    return `${base}/blob/${branch}/${cleanPath}`;
  };

  const starterQueries = [
    { label: "Architecture Overview", icon: <Database size={16} />, prompt: "Give me a high-level overview of this project's architecture." },
    { label: "Entry Point", icon: <Zap size={16} />, prompt: "Where is the main entry point of the app and how does it start?" },
    { label: "Logic Flow", icon: <Github size={16} />, prompt: "Explain the data flow for the main features of this repo." }
  ];

  return (
    <div className="flex w-screen h-screen bg-[#131314] text-[#e3e3e3] overflow-hidden font-sans">
      
      {/* SIDEBAR: Step 1 - Repository Configuration */}
      <aside className="w-[320px] bg-[#1e1f20] flex flex-col p-6 border-r border-white/5 shrink-0">
        <div className="flex items-center gap-3 mb-10 px-1">
          <div className="w-8 h-8 shrink-0 flex items-center justify-center">
            <img 
              src="/code-lens-logo.svg" 
              alt="CodeLens AI" 
              className="w-full h-full object-contain drop-shadow-[0_0_8px_rgba(138,180,248,0.3)]"
            />
          </div>
          <h1 className="font-bold text-xl tracking-tighter bg-gradient-to-r from-white to-[#9aa0a6] bg-clip-text text-transparent italic">
            CodeLens AI
          </h1>
        </div>

        <div className="space-y-4 mb-10">
          <label className="text-[10px] font-bold text-[#9aa0a6] uppercase tracking-[0.2em] ml-1">
            Connect Source
          </label>
          <Input
            placeholder="Paste GitHub URL..."
            disabled={status === 'indexing'}
            className="bg-[#131314] border-white/10 rounded-xl h-11 focus-visible:ring-[#8ab4f8]/30 text-sm"
            value={repoUrl}
            onChange={(e) => {
              setRepoUrl(e.target.value);
              if (status === 'ready') setStatus('idle');
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleIndex()}
          />
          <Button 
            onClick={handleIndex} 
            disabled={status === 'indexing' || !repoUrl}
            className={`w-full h-11 rounded-xl font-bold transition-all duration-300 ${
              status === 'ready' 
                ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                : 'bg-white text-black hover:bg-[#e3e3e3]'
            }`}
          >
            {status === 'indexing' ? (
              <><Loader2 className="animate-spin mr-2" size={18} /> Indexing...</>
            ) : status === 'ready' ? (
              <><CheckCircle2 className="mr-2" size={18} /> Indexed Successfully</>
            ) : (
              <><Database className="mr-2" size={18} /> Index Architecture</>
            )}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="flex items-center gap-2 text-[#9aa0a6] mb-4">
            <History size={14} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Recent Sessions</span>
          </div>
          {history.map((url, i) => (
            <div 
              key={i} 
              onClick={() => { setRepoUrl(url); setStatus('idle'); }}
              className={`p-3 mb-2 rounded-xl border cursor-pointer transition-all text-xs truncate ${
                repoUrl === url ? 'bg-[#8ab4f8]/10 border-[#8ab4f8]/20 text-[#8ab4f8]' : 'bg-white/5 border-transparent hover:border-white/10 text-[#c4c7c5]'
              }`}
            >
              <Github size={12} className="inline mr-2 opacity-50" />
              {url.split('/').pop()}
            </div>
          ))}
        </div>
      </aside>

      {/* MAIN CONTENT: Step 2 - Chat & Analysis */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#131314] relative">
        <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar pb-40">
          <div className="max-w-[850px] mx-auto px-8 py-12">
            
            {/* 1. INITIAL EMPTY STATE + STARTER CARDS */}
            {messages.length === 0 ? (
              <div className="h-[70vh] flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-[#1e1f20] rounded-3xl flex items-center justify-center mb-6 border border-white/5 shadow-xl">
                   <img src="/code-lens-logo.svg" className="w-8 h-8 opacity-40" />
                </div>
                <h2 className="text-4xl font-light text-white mb-8 tracking-tight italic">How can I help you today?</h2>
                
                {status === 'ready' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {[
                      { label: "Overview", icon: <Database size={16} />, prompt: "Give me a high-level overview of this project's architecture." },
                      { label: "Entry Point", icon: <Zap size={16} />, prompt: "Where is the main entry point and how does the app initialize?" },
                      { label: "Logic Flow", icon: <Github size={16} />, prompt: "Explain the core logic flow of the main data processing features." }
                    ].map((q, i) => (
                      <button
                        key={i}
                        onClick={() => { setQuery(q.prompt); }}
                        className="flex flex-col items-start p-5 rounded-2xl bg-[#1e1f20] border border-white/5 hover:border-[#8ab4f8]/40 hover:bg-[#252629] transition-all text-left group"
                      >
                        <div className="mb-4 p-2 rounded-lg bg-[#131314] text-[#8ab4f8] group-hover:text-white transition-colors">
                          {q.icon}
                        </div>
                        <span className="text-sm font-medium text-[#c4c7c5] group-hover:text-white">{q.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className="flex gap-6 mb-12 animate-in fade-in slide-in-from-bottom-3 duration-500">
                  {/* AVATARS */}
                  <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold tracking-widest ${
                    m.role === 'user' 
                      ? 'bg-[#3c4043] text-[#e3e3e3] border border-white/10' 
                      : 'bg-[#1e1f20] border border-[#8ab4f8]/20 shadow-[0_0_15px_rgba(138,180,248,0.1)]'
                  }`}>
                    {m.role === 'user' ? (
                      "YOU"
                    ) : (
                      <img src="/code-lens-logo.svg" className="w-5 h-5 drop-shadow-[0_0_3px_#8ab4f8]" alt="AI" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="prose prose-invert prose-gemini max-w-none">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          // ... (Keep your code highlighter and link logic exactly as is)
                          code({ node, inline, className, children, ...props }: any) {
                            /* keep existing code logic here */
                            return <code className={className} {...props}>{children}</code>;
                          }
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                      
                      {/* FIX: Move the blinking dot OUTSIDE of ReactMarkdown for reliable rendering */}
                      {isStreaming && i === messages.length - 1 && m.role === 'ai' && (
                        <span className="streaming-dot" />
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* FLOATING INPUT CAPSULE */}
        <div className="absolute bottom-0 left-0 w-full p-8 bg-gradient-to-t from-[#131314] via-[#131314] to-transparent">
          <div className="max-w-[850px] mx-auto">
            <div className={`flex items-center p-2 rounded-[32px] border transition-all duration-700 shadow-2xl ${
              status === 'ready' ? 'bg-[#1e1f20] border-white/10 focus-within:border-[#8ab4f8]/40' : 'bg-[#131314] border-white/5 opacity-40 grayscale'
            }`}>
              <Input
                placeholder={status === 'ready' ? "Ask about code architecture..." : "Index a repo in the sidebar to start chatting"}
                disabled={status !== 'ready' || isStreaming}
                className="border-none bg-transparent h-14 px-6 focus-visible:ring-0 text-lg placeholder:text-[#5f6368] font-light"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitQuery()}
              />
              <Button 
                onClick={submitQuery}
                disabled={status !== 'ready' || isStreaming || !query}
                size="icon" 
                className="rounded-full h-11 w-11 bg-transparent text-[#8ab4f8] hover:bg-white/5 transition-colors"
              >
                {isStreaming ? <Loader2 className="animate-spin" /> : <Send size={22} />}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}