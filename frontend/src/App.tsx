import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { api } from "./lib/api.ts";

// Components
import { Sidebar } from "./components/Sidebar";
import { ChatList } from "./components/ChatList";
import { ChatInput } from "./components/ChatInput";
import { InspectorSidebar } from "./components/InspectorSidebar"; 

export type AppStatus = 'idle' | 'indexing' | 'ready';

interface RepoHistory {
  url: string;
  branch: string;
}

export interface Message {
  role: 'user' | 'ai';
  content: string;
  metadata?: any; // Stores the retrieval details
}

export default function App() {
  // --- State ---
  const [repoUrl, setRepoUrl] = useState("");
  const [activeBranch, setActiveBranch] = useState("main");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<AppStatus>('idle');
  const [history, setHistory] = useState<RepoHistory[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  
  // --- Inspector State ---
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [activeInspectorData, setActiveInspectorData] = useState<any>(null);

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
      } catch (e) { console.error("History parse failed", e); }
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
  const getGithubLink = useCallback((path: string, line?: number) => {
    if (!repoUrl) return "#";
    const cleanPath = path.replace(/\\/g, '/').replace(/^\/+/, '');
    const base = repoUrl.trim().replace(/\.git$/, "").replace(/\/$/, "");
    return `${base}/blob/${activeBranch}/${cleanPath}${line ? `#L${line}` : ""}`;
  }, [repoUrl, activeBranch]);

  // --- Handlers ---
  const handleIndex = async (force: boolean = false) => {
    if (!repoUrl || status === 'indexing') return;
    setStatus('indexing');
    if (force) setMessages([]); 
    
    const toastId = "ingest-progress";
    toast.loading(force ? "Force re-indexing..." : "Analyzing codebase...", { id: toastId });

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
          toast.success("Index Ready", { id: toastId });
          return;
        }
        if (update.status === 'error') {
          setStatus('idle');
          toast.error(update.message || "Indexing failed", { id: toastId });
          return;
        }
        toast.loading(update.message, { id: toastId });
      }, force);
    } catch (err) {
      setStatus('idle');
      toast.error("Network error", { id: toastId });
    }
  };

  const submitQuery = async (overrideQuery?: string) => {
    const targetQuery = overrideQuery || query;
    if (!targetQuery.trim() || status !== 'ready' || isStreaming) return;

    setQuery("");
    setMessages(prev => [...prev, { role: 'user', content: targetQuery }]);
    setIsStreaming(true);
    setActiveInspectorData(null); // Reset inspector for new query

    try {
      let accumulatedContent = "";
      let hasAddedPlaceholder = false;

      await api.query(repoUrl, targetQuery, (chunk) => {
        accumulatedContent += chunk;

        // 1. Check for Quota Error in raw chunk
        if (accumulatedContent.startsWith("ERR_BRAIN_QUOTA")) {
          toast.error("Quota Exceeded", { description: "Please wait 30s." });
          return;
        }

        // 2. Add AI placeholder if first valid chunk
        if (!hasAddedPlaceholder) {
          setMessages(prev => [...prev, { role: 'ai', content: "" }]);
          hasAddedPlaceholder = true;
        }

        // 3. Metadata Interception Logic
        const marker = "METADATA_BATCH:";
        if (accumulatedContent.includes(marker)) {
          const [textPart, metadataPart] = accumulatedContent.split(marker);
          
          setMessages(prev => {
            const newMsgs = [...prev];
            const last = newMsgs[newMsgs.length - 1];
            if (last.role === 'ai') {
              last.content = textPart.trim();
              try {
                // Only try to parse if metadata looks complete
                if (metadataPart.includes('}')) {
                  const meta = JSON.parse(metadataPart.trim());
                  last.metadata = meta;
                  setActiveInspectorData(meta);
                }
              } catch (e) { /* partial JSON */ }
            }
            return newMsgs;
          });
        } else {
          // Normal text stream
          setMessages(prev => {
            const newMsgs = [...prev];
            const last = newMsgs[newMsgs.length - 1];
            if (last.role === 'ai') last.content = accumulatedContent;
            return newMsgs;
          });
        }
      });
    } catch (err) {
      toast.error("Connection lost");
    } finally {
      setIsStreaming(false);
    }
  };

  const openInspector = (data: any) => {
    setActiveInspectorData(data);
    setInspectorOpen(true);
  };

  // ... rest of handlers (handleDeleteIndex, handleClearHistory, etc.) remain same ...

  return (
    <div className="flex w-screen h-screen bg-[#131314] text-[#e3e3e3] overflow-hidden font-sans">
      <Sidebar 
        repoUrl={repoUrl}
        setRepoUrl={setRepoUrl}
        status={status}
        history={history}
        onIndex={handleIndex} 
        onSelectSession={(item) => { setRepoUrl(item.url); setActiveBranch(item.branch); setStatus('ready'); setMessages([]); }}
        onDeleteSession={(url) => { /* api.delete logic */ }}
        onClearHistory={() => { setHistory([]); setRepoUrl(""); setStatus('idle'); }}
      />

      <main className="flex-1 flex flex-col min-w-0 bg-[#131314] relative border-r border-white/5">
        <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar pb-44">
          <ChatList 
            messages={messages}
            status={status}           // Pass status
            repoUrl={repoUrl}         // Pass repoUrl
            activeBranch={activeBranch} // Pass activeBranch
            isStreaming={isStreaming}
            getGithubLink={getGithubLink}
            onSuggestQuery={submitQuery}
            onOpenInspector={openInspector} 
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

      {/* New Inspector Sidebar */}
      {inspectorOpen && (
        <InspectorSidebar 
          data={activeInspectorData} 
          onClose={() => setInspectorOpen(false)} 
        />
      )}
    </div>
  );
}