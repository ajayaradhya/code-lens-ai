import { 
  Github, Database, CheckCircle2, Loader2, 
  History, Trash2, RotateCcw 
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  repoUrl: string;
  setRepoUrl: (url: string) => void;
  status: 'idle' | 'indexing' | 'ready';
  history: Array<{ url: string; branch: string }>;
  onIndex: (force?: boolean) => void; // Updated signature
  onSelectSession: (item: any) => void;
  onDeleteSession: (url: string) => void;
  onClearHistory: () => void;
}

export function Sidebar({ 
  repoUrl, 
  setRepoUrl, 
  status, 
  history, 
  onIndex, 
  onSelectSession, 
  onDeleteSession, 
  onClearHistory 
}: SidebarProps) {
  
  const repoNameFromUrl = (url: string) => url.split('/').pop() || "repository";

  return (
    <aside className="w-[320px] bg-[#1e1f20] flex flex-col p-6 border-r border-white/5 shrink-0">
      {/* Brand Header */}
      <div className="flex items-center gap-3 mb-10 px-1">
        <div className="w-8 h-8 flex items-center justify-center">
          <img src="/code-lens-logo.svg" alt="Logo" className="w-full h-full drop-shadow-[0_0_8px_rgba(138,180,248,0.3)]" />
        </div>
        <h1 className="font-bold text-xl tracking-tighter bg-gradient-to-r from-white to-[#9aa0a6] bg-clip-text text-transparent italic">
          CodeLens AI
        </h1>
      </div>

      {/* Connection Group */}
      <div className="space-y-4 mb-10">
        <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] ml-1">
          Source Control
        </label>
        
        <Input
          placeholder="GitHub URL..."
          disabled={status === 'indexing'}
          className="bg-[#131314] border-white/10 rounded-xl h-11 focus-visible:ring-[#8ab4f8]/30 text-sm"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onIndex(false)}
        />

        <div className="flex gap-2">
          {/* Main Index Button (force: false) */}
          <Button 
            onClick={() => onIndex(false)} 
            disabled={status === 'indexing' || !repoUrl}
            className={`flex-1 h-11 rounded-xl font-bold transition-all duration-300 ${
              status === 'ready' 
                ? 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20' 
                : 'bg-white text-black hover:bg-[#e3e3e3]'
            }`}
          >
            {status === 'indexing' ? (
              <><Loader2 className="animate-spin mr-2" size={18} /> Mapping...</>
            ) : status === 'ready' ? (
              <><CheckCircle2 className="mr-2" size={18} /> Indexed</>
            ) : (
              <><Database className="mr-2" size={18} /> Index Repo</>
            )}
          </Button>

          {/* Redo/Refresh Button (force: true) */}
          {status === 'ready' && (
            <Button 
              onClick={() => onIndex(true)}
              variant="outline"
              size="icon"
              className="h-11 w-11 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-[#9aa0a6]"
              title="Force re-index (Wipe cache)"
            >
              <RotateCcw size={18} />
            </Button>
          )}
        </div>
      </div>

      {/* Sessions History */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between text-[#9aa0a6] mb-4 pr-1">
          <div className="flex items-center gap-2">
            <History size={14} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Sessions</span>
          </div>
          {history.length > 0 && (
            <button 
              onClick={onClearHistory}
              className="text-[9px] hover:text-red-400 transition-colors uppercase font-bold tracking-tighter opacity-50 hover:opacity-100"
            >
              Clear All
            </button>
          )}
        </div>

        <div className="space-y-2">
          {history.map((item, i) => (
            <div 
              key={i} 
              className={`group flex items-center gap-2 p-3 rounded-xl border transition-all truncate ${
                repoUrl === item.url 
                  ? 'bg-[#8ab4f8]/10 border-[#8ab4f8]/20 text-[#8ab4f8]' 
                  : 'bg-white/5 border-transparent hover:border-white/10 text-[#c4c7c5]'
              }`}
            >
              {/* Clickable Area */}
              <div 
                className="flex-1 flex items-center min-w-0 cursor-pointer"
                onClick={() => onSelectSession(item)}
              >
                <Github size={12} className="shrink-0 mr-2 opacity-50" />
                <div className="flex flex-col truncate">
                  <span className="text-xs font-medium truncate">
                    {repoNameFromUrl(item.url)}
                  </span>
                  <span className="text-[9px] opacity-40 font-mono uppercase">
                    {item.branch}
                  </span>
                </div>
              </div>

              {/* Individual Delete */}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSession(item.url);
                }}
                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-all"
                title="Delete index"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}