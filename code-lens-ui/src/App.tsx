import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Zap, Github, Send, Loader2, Database, 
  ExternalLink, History, CheckCircle2, AlertCircle, Terminal
} from "lucide-react";
import { api } from "@/lib/api";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

type AppStatus = 'idle' | 'indexing' | 'ready';

interface RepoHistory {
  url: string;
  branch: string;
}

export default function App() {
  const [repoUrl, setRepoUrl] = useState("");
  const [activeBranch, setActiveBranch] = useState("main");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<AppStatus>('idle');
  const [history, setHistory] = useState<RepoHistory[]>([]);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string }[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. Hydrate state from LocalStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("codelens_history");
    if (saved) {
      try {
        const parsedHistory: RepoHistory[] = JSON.parse(saved);
        setHistory(parsedHistory);
        if (parsedHistory.length > 0) {
          setRepoUrl(parsedHistory[0].url);
          setActiveBranch(parsedHistory[0].branch);
          // We assume it's ready if it's in history, 
          // but handleIndex will re-verify if they click "Index" again.
          setStatus('ready'); 
        }
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // 2. Persist history changes
  useEffect(() => {
    localStorage.setItem("codelens_history", JSON.stringify(history));
  }, [history]);

  // 3. Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const getGithubLink = (path: string) => {
    const cleanPath = path.replace(/['`]/g, "").trim();
    const base = repoUrl.replace(/\/$/, '');
    return `${base}/blob/${activeBranch}/${cleanPath}`;
  };

  const handleIndex = async () => {
    if (!repoUrl || status === 'indexing') return;
    
    const toastId = "ingest-progress";
    setStatus('indexing');
    setMessages([]); 

    toast.loading("Analyzing codebase architecture...", { id: toastId });

    try {
      await api.ingest(repoUrl, (update) => {
        // Check for success: either a 'ready' status or a summary object
        if (update.status === 'ready' || update.summary) {
          
          // --- THE FIX ---
          // 1. Check the summary root (where backend sends 'branch' for new indexes)
          // 2. Check update.branch (if your SSE sender puts it at top level)
          // 3. Check the cached metadata field we just added to the backend
          const detectedBranch = update.summary?.branch || update.branch || "main";
          
          setStatus('ready');
          setActiveBranch(detectedBranch);

          setHistory(prev => {
            const filtered = prev.filter(item => item.url !== repoUrl);
            // Save the actual detected branch so future clicks work
            return [{ url: repoUrl, branch: detectedBranch }, ...filtered];
          });
          
          toast.success(update.summary?.cached ? "Restored from Index" : "Ready for questions", { 
            id: toastId, 
            description: `Active branch: ${detectedBranch}` 
          });
          return;
        }

        if (update.status === 'error') {
          setStatus('idle');
          const errorMsg = update.message?.toUpperCase() || "";
          
          if (errorMsg.includes("429") || errorMsg.includes("QUOTA") || errorMsg.includes("EXHAUSTED")) {
            toast.error("Gemini is exhausted.", { id: toastId });
            setMessages([{
                role: 'ai',
                content: "### 🛑 Brain Freeze (Quota 429)\n\nI've been thinking too hard... Google's free tier has put me in timeout. \n\n**Give me about 30 seconds** to cool my circuits. Even AI needs to blink occasionally."
            }]);
          } else {
            toast.error(update.message || "Indexing failed", { id: toastId });
          }
          return;
        }

        // Live updates (Cloning, Processing, etc.)
        toast.loading(update.message, { id: toastId });
      });
    } catch (err: any) {
      setStatus('idle');
      toast.error("Network hiccup. Is the backend running?", { id: toastId });
    }
  };

  const submitQuery = async (overrideQuery?: string) => {
    const targetQuery = overrideQuery || query;
    if (!targetQuery.trim() || status !== 'ready' || isStreaming) return;

    setQuery("");
    setMessages(prev => [...prev, { role: 'user', content: targetQuery }, { role: 'ai', content: "" }]);
    setIsStreaming(true);

    try {
      await api.query(repoUrl, targetQuery, (chunk) => {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          const rest = prev.slice(0, -1);
          return [...rest, { ...last, content: last.content + chunk }];
        });
      });
    } catch (err: any) {
        toast.error("Response failed. Try again in a few seconds.");
    } finally {
      setIsStreaming(false);
    }
  };

  const MarkdownComponents = {
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const content = String(children).replace(/\n$/, '');
      const isFilePath = content.includes('.') && !content.includes(' ') && content.length < 60;

      if (!inline && match) {
        return (
          <div className="rounded-xl overflow-hidden my-6 border border-white/5 shadow-2xl group">
            <div className="bg-[#2a2b2e] px-4 py-2 text-[10px] font-bold font-mono text-[#9aa0a6] border-b border-white/5 flex justify-between tracking-widest uppercase">
              <span>{match[1]}</span>
              <button 
                onClick={() => navigator.clipboard.writeText(content)}
                className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-white"
              >
                Copy
              </button>
            </div>
            <SyntaxHighlighter
              style={vscDarkPlus}
              language={match[1]}
              PreTag="div"
              customStyle={{ margin: 0, background: '#1e1f20', padding: '1.5rem', fontSize: '13px' }}
              {...props}
            >
              {content}
            </SyntaxHighlighter>
          </div>
        );
      }
      
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
      return <code className="bg-white/10 px-1.5 py-0.5 rounded text-[#e3e3e3]" {...props}>{children}</code>;
    }
  };

  return (
    <div className="flex w-screen h-screen bg-[#131314] text-[#e3e3e3] overflow-hidden font-sans">
      
      {/* SIDEBAR */}
      <aside className="w-[320px] bg-[#1e1f20] flex flex-col p-6 border-r border-white/5 shrink-0">
        <div className="flex items-center gap-3 mb-10 px-1">
          <div className="w-8 h-8 flex items-center justify-center">
            <img src="/code-lens-logo.svg" alt="Logo" className="w-full h-full drop-shadow-[0_0_8px_rgba(138,180,248,0.3)]" />
          </div>
          <h1 className="font-bold text-xl tracking-tighter bg-gradient-to-r from-white to-[#9aa0a6] bg-clip-text text-transparent italic">
            CodeLens AI
          </h1>
        </div>

        <div className="space-y-4 mb-10">
          <label className="text-[10px] font-bold text-[#9aa0a6] uppercase tracking-[0.2em] ml-1 text-white/40">Connect Source</label>
          <Input
            placeholder="GitHub URL..."
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
                ? 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20' 
                : 'bg-white text-black hover:bg-[#e3e3e3]'
            }`}
          >
            {status === 'indexing' ? (
              <><Loader2 className="animate-spin mr-2" size={18} /> Mapping...</>
            ) : status === 'ready' ? (
              <><CheckCircle2 className="mr-2" size={18} /> Indexed & Ready</>
            ) : (
              <><Database className="mr-2" size={18} /> Index Architecture</>
            )}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="flex items-center gap-2 text-[#9aa0a6] mb-4">
            <History size={14} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Sessions</span>
          </div>
          {history.map((item, i) => (
            <div 
              key={i} 
              onClick={() => { 
                setRepoUrl(item.url); 
                setActiveBranch(item.branch);
                setStatus('ready');
                setMessages([]);
              }}
              className={`p-3 mb-2 rounded-xl border cursor-pointer transition-all text-xs truncate ${
                repoUrl === item.url ? 'bg-[#8ab4f8]/10 border-[#8ab4f8]/20 text-[#8ab4f8]' : 'bg-white/5 border-transparent hover:border-white/10 text-[#c4c7c5]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="truncate flex-1 font-medium">
                  <Github size={12} className="inline mr-2 opacity-50" />
                  {item.url.split('/').pop()}
                </span>
                <span className="text-[9px] opacity-40 ml-2 font-mono uppercase bg-white/5 px-1 rounded">{item.branch}</span>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* CHAT AREA */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#131314] relative">
        <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar pb-44">
          <div className="max-w-[850px] mx-auto px-8 py-20">
            
            {messages.length === 0 ? (
                <div className="h-[70vh] flex flex-col items-center justify-center animate-in fade-in duration-1000">
                    <div className="w-16 h-16 bg-[#1e1f20] rounded-2xl flex items-center justify-center mb-8 border border-white/5 shadow-xl">
                       <Terminal className="text-[#8ab4f8]" size={32} />
                    </div>
                    <h2 className="text-4xl font-light text-white mb-2 tracking-tight italic text-center">
                        {status === 'ready' ? "Context Loaded." : "Hello, Developer."}
                    </h2>
                    <p className="text-[#9aa0a6] mb-12 text-sm">
                        {status === 'ready' 
                           ? `Currently exploring ${repoUrl.split('/').pop()} on branch ${activeBranch}` 
                           : "Index a repository to start a technical deep-dive."}
                    </p>
                    
                    {status === 'ready' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full max-w-2xl animate-in slide-in-from-bottom-4 duration-500">
                        {[
                            { label: "Overview", icon: <Database size={16} />, prompt: "Give me a high-level overview of this project's architecture." },
                            { label: "Entry Point", icon: <Zap size={16} />, prompt: "Where is the main entry point and how does the app initialize?" },
                            { label: "Logic Flow", icon: <Github size={16} />, prompt: "Explain the core logic flow of the main data processing features." }
                        ].map((q, i) => (
                            <button
                            key={i}
                            onClick={() => submitQuery(q.prompt)}
                            className="flex flex-col items-start p-5 rounded-2xl bg-[#1e1f20] border border-white/5 hover:border-[#8ab4f8]/40 hover:bg-[#252629] transition-all text-left group"
                            >
                            <div className="mb-4 p-2 rounded-lg bg-[#131314] text-[#8ab4f8] group-hover:text-white transition-colors">{q.icon}</div>
                            <span className="text-sm font-medium text-[#c4c7c5] group-hover:text-white">{q.label}</span>
                            </button>
                        ))}
                        </div>
                    )}
                </div>
            ) : (
                messages.map((m, i) => (
                    <div key={i} className="flex gap-6 mb-12 animate-in fade-in slide-in-from-bottom-3 duration-500">
                        <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold tracking-widest ${
                        m.role === 'user' ? 'bg-[#3c4043] text-[#e3e3e3] border border-white/10' : 'bg-[#1e1f20] border border-[#8ab4f8]/20'
                        }`}>
                        {m.role === 'user' ? "YOU" : <img src="/code-lens-logo.svg" className="w-5 h-5" alt="AI" />}
                        </div>
                        <div className="flex-1 min-w-0 pt-1">
                            <div className="prose prose-invert prose-gemini max-w-none">
                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                                    {m.content}
                                </ReactMarkdown>
                                {isStreaming && i === messages.length - 1 && m.role === 'ai' && (
                                  <span className="inline-block w-2 h-4 bg-[#8ab4f8] ml-1 animate-pulse" />
                                )}
                            </div>
                        </div>
                    </div>
                ))
            )}
          </div>
        </div>

        {/* INPUT BAR */}
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
                onKeyDown={(e) => e.key === 'Enter' && submitQuery()}
              />
              <Button onClick={() => submitQuery()} size="icon" className="rounded-full h-11 w-11 bg-transparent text-[#8ab4f8] hover:bg-white/5 transition-colors">
                {isStreaming ? <Loader2 className="animate-spin" /> : <Send size={22} />}
              </Button>
            </div>
            <p className="text-center text-[10px] text-[#5f6368] mt-4 tracking-wider uppercase">
               Powered by Gemini 2.5 Flash • Context-Aware Code Analysis
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}