import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";

// Components
import { Sidebar } from "./components/Sidebar";
import { ChatList } from "./components/ChatList";
import { ChatInput } from "./components/ChatInput";

export type AppStatus = 'idle' | 'indexing' | 'ready';

interface RepoHistory {
  url: string;
  branch: string;
}

export default function App() {
  // --- State ---
  const [repoUrl, setRepoUrl] = useState("");
  const [activeBranch, setActiveBranch] = useState("main");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<AppStatus>('idle');
  const [history, setHistory] = useState<RepoHistory[]>([]);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string }[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // --- Effects ---
  useEffect(() => {
    const saved = localStorage.getItem("codelens_history");
    if (saved) {
      try {
        const parsedHistory = JSON.parse(saved);
        setHistory(parsedHistory);
        if (parsedHistory.length > 0) {
          setRepoUrl(parsedHistory[0].url);
          setActiveBranch(parsedHistory[0].branch);
          setStatus('ready'); 
        }
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("codelens_history", JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  // --- Helpers ---
  const getGithubLink = (path: string) => {
    const cleanPath = path.replace(/['`]/g, "").trim();
    const base = repoUrl.replace(/\/$/, '');
    return `${base}/blob/${activeBranch}/${cleanPath}`;
  };

  // --- Handlers ---
  const handleIndex = async () => {
    if (!repoUrl || status === 'indexing') return;
    
    const toastId = "ingest-progress";
    setStatus('indexing');
    setMessages([]); 
    toast.loading("Analyzing codebase architecture...", { id: toastId });

    try {
      await api.ingest(repoUrl, (update) => {
        if (update.status === 'ready' || update.summary) {
          const detectedBranch = update.summary?.branch || update.branch || "main";
          
          setStatus('ready');
          setActiveBranch(detectedBranch);
          setHistory(prev => {
            const filtered = prev.filter(item => item.url !== repoUrl);
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
          if (errorMsg.includes("429") || errorMsg.includes("QUOTA")) {
            setMessages([{
                role: 'ai',
                content: "### 🛑 Brain Freeze (Quota 429)\n\nGoogle's API has put me in timeout. Give me ~30s to cool down."
            }]);
          }
          toast.error(update.message || "Indexing failed", { id: toastId });
          return;
        }
        toast.loading(update.message, { id: toastId });
      });
    } catch (err) {
      setStatus('idle');
      toast.error("Network error. Is the backend running?", { id: toastId });
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
    } catch (err) {
        toast.error("Response failed. Try again in a few seconds.");
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSelectSession = (item: RepoHistory) => {
    setRepoUrl(item.url); 
    setActiveBranch(item.branch);
    setStatus('ready');
    setMessages([]);
  };

  // --- Render ---
  return (
    <div className="flex w-screen h-screen bg-[#131314] text-[#e3e3e3] overflow-hidden font-sans">
      
      <Sidebar 
        repoUrl={repoUrl}
        setRepoUrl={setRepoUrl}
        status={status}
        history={history}
        onIndex={handleIndex}
        onSelectSession={handleSelectSession}
      />

      <main className="flex-1 flex flex-col min-w-0 bg-[#131314] relative">
        <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar pb-44">
          <ChatList 
            messages={messages}
            status={status}
            repoUrl={repoUrl}
            activeBranch={activeBranch}
            isStreaming={isStreaming}
            getGithubLink={getGithubLink}
            onSuggestQuery={submitQuery}
          />
        </div>

        <ChatInput 
          query={query}
          setQuery={setQuery}
          status={status}
          isStreaming={isStreaming}
          onSubmit={submitQuery}
        />
      </main>
    </div>
  );
}