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
  const getGithubLink = (path: string, line?: number) => {
    if (!repoUrl) return "#";

    // Standardize slashes for GitHub (must be forward)
    const cleanPath = path.replace(/\\/g, '/').replace(/^\/+/, '');
    const base = repoUrl.trim().replace(/\.git$/, "").replace(/\/$/, "");
    const lineAnchor = line ? `#L${line}` : "";
    
    return `${base}/blob/${activeBranch}/${cleanPath}${lineAnchor}`;
  };

  // --- Handlers ---
  
  /**
   * Updated handleIndex to accept a force parameter.
   * If force is true, it tells the backend to bypass cache and wipe the collection.
   */
  const handleIndex = async (force: boolean = false) => {
    if (!repoUrl || status === 'indexing') return;
    
    const toastId = "ingest-progress";
    setStatus('indexing');
    
    // Clear messages for a fresh start if forcing a re-index
    if (force) setMessages([]); 
    
    toast.loading(force ? "Force re-indexing codebase..." : "Analyzing codebase architecture...", { id: toastId });

    try {
      // Pass the force flag to the API call
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
      }, force); // Parameter added here
    } catch (err) {
      setStatus('idle');
      toast.error("Network error. Is the backend running?", { id: toastId });
    }
  };

  const submitQuery = async (overrideQuery?: string) => {
    const targetQuery = overrideQuery || query;
    if (!targetQuery.trim() || status !== 'ready' || isStreaming) return;

    setQuery("");
    // 1. We don't add the AI message immediately to the state 
    // until we confirm it's not a quota error
    const tempUserMsg = { role: 'user' as const, content: targetQuery };
    setMessages(prev => [...prev, tempUserMsg]);
    setIsStreaming(true);

    try {
      let isFirstChunk = true;

      await api.query(repoUrl, targetQuery, (chunk) => {
        // 2. Catch the specific error code from the backend
        if (isFirstChunk && chunk.startsWith("ERR_BRAIN_QUOTA")) {
          toast.error("Gemini API Quota Exceeded", {
            description: "Free tier limit reached. Please wait 30s before trying again.",
            duration: 5000,
          });
          // Remove the empty AI message if we haven't added it yet
          return;
        }

        if (isFirstChunk) {
          // It's a valid response, add the placeholder AI message now
          setMessages(prev => [...prev, { role: 'ai', content: "" }]);
          isFirstChunk = false;
        }

        setMessages(prev => {
          const newMessages = [...prev];
          const last = newMessages[newMessages.length - 1];
          if (last.role === 'ai') {
            last.content += chunk;
          }
          return newMessages;
        });
      });
    } catch (err) {
        toast.error("Connection lost. Is the backend awake?");
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

  const handleDeleteIndex = async (url: string) => {
    try {
      await api.deleteIndex(url);
      const newHistory = history.filter(item => item.url !== url);
      setHistory(newHistory);
      
      if (repoUrl === url) {
        setRepoUrl("");
        setStatus('idle');
        setMessages([]);
      }
      toast.success("Index wiped from storage");
    } catch (err) {
      toast.error("Failed to delete index");
    }
  };

  const handleClearHistory = () => {
    if (window.confirm("This will clear your local history. Actual indexes will remain on the server. Continue?")) {
      setHistory([]);
      setRepoUrl("");
      setStatus('idle');
      localStorage.removeItem("codelens_history");
    }
  };

  return (
    <div className="flex w-screen h-screen bg-[#131314] text-[#e3e3e3] overflow-hidden font-sans">
      
      <Sidebar 
        repoUrl={repoUrl}
        setRepoUrl={setRepoUrl}
        status={status}
        history={history}
        onIndex={handleIndex} 
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteIndex}
        onClearHistory={handleClearHistory}
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