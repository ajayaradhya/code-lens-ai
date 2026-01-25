import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Zap, Github, Send, Loader2, Database, ExternalLink, History, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";

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

  return (
    <div className="flex w-screen h-screen bg-[#131314] text-[#e3e3e3] overflow-hidden">
      
      {/* SIDEBAR: Step 1 - Configuration */}
      <aside className="w-[320px] bg-[#1e1f20] flex flex-col p-6 border-r border-white/5 shrink-0">
        <div className="flex items-center gap-3 mb-10">
          <Zap className="text-[#8ab4f8]" fill="#8ab4f8" size={22} />
          <h1 className="font-bold text-xl tracking-tighter italic">CodeLens AI</h1>
        </div>

        <div className="space-y-4 mb-10">
          <label className="text-[10px] font-bold text-[#9aa0a6] uppercase tracking-[0.2em] ml-1">
            1. Connect Source
          </label>
          <Input
            placeholder="Paste GitHub URL..."
            disabled={status === 'indexing'}
            className="bg-[#131314] border-white/10 rounded-xl h-11 focus-visible:ring-[#8ab4f8]/30 text-sm"
            value={repoUrl}
            onChange={(e) => {
              setRepoUrl(e.target.value);
              if (status === 'ready') setStatus('idle'); // Reset if URL changes
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

      {/* MAIN CONTENT: Step 2 - Chat */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#131314] relative">
        <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar pb-32">
          <div className="max-w-[850px] mx-auto px-8 py-12">
            {messages.length === 0 ? (
              <div className="h-[65vh] flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-[#1e1f20] rounded-3xl flex items-center justify-center mb-6 border border-white/5">
                  <Database size={32} className="text-[#3c4043]" />
                </div>
                <h2 className="text-4xl font-light text-white mb-4 tracking-tight">Ready to explore.</h2>
                <p className="text-[#9aa0a6] max-w-sm leading-relaxed">
                  Once your repository is indexed, you can ask questions about its logic, dependencies, and structure.
                </p>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className="flex gap-8 mb-12 animate-in fade-in slide-in-from-bottom-3 duration-500">
                  <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                    m.role === 'user' ? 'bg-[#3c4043] border-white/10' : 'bg-gradient-to-br from-[#8ab4f8] to-[#4285f4] border-none text-white shadow-lg shadow-blue-500/10'
                  }`}>
                    {m.role === 'user' ? 'YOU' : <Zap size={16} fill="white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="prose prose-invert prose-gemini max-w-none">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code({ children, className }) {
                            const content = String(children);
                            const isFilePath = content.includes('.') && !content.includes(' ') && content.length < 60;
                            
                            if (isFilePath && status === 'ready') {
                              return (
                                <a 
                                  href={getGithubLink(content)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 bg-[#8ab4f8]/10 text-[#8ab4f8] px-2.5 py-0.5 rounded-lg border border-[#8ab4f8]/20 no-underline hover:bg-[#8ab4f8]/20 transition-all font-mono text-[13px]"
                                >
                                  {content} <ExternalLink size={12} />
                                </a>
                              );
                            }
                            return <code className={className}>{children}</code>;
                          }
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* BOTTOM INPUT: Floating Capsule */}
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
                className="rounded-full h-11 w-11 bg-transparent text-[#8ab4f8] hover:bg-white/5"
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