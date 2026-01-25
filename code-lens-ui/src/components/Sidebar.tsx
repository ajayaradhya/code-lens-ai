import { Github, Database, CheckCircle2, Loader2, History } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function Sidebar({ 
  repoUrl, setRepoUrl, status, history, onIndex, onSelectSession 
}: any) {
  return (
    <aside className="w-[320px] bg-[#1e1f20] flex flex-col p-6 border-r border-white/5 shrink-0">
      <div className="flex items-center gap-3 mb-10 px-1">
        <img src="/code-lens-logo.svg" alt="Logo" className="w-8 h-8 drop-shadow-[0_0_8px_rgba(138,180,248,0.3)]" />
        <h1 className="font-bold text-xl tracking-tighter bg-gradient-to-r from-white to-[#9aa0a6] bg-clip-text text-transparent italic">
          CodeLens AI
        </h1>
      </div>

      <div className="space-y-4 mb-10">
        <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] ml-1">Connect Source</label>
        <Input
          placeholder="GitHub URL..."
          disabled={status === 'indexing'}
          className="bg-[#131314] border-white/10 rounded-xl h-11 focus-visible:ring-[#8ab4f8]/30 text-sm"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onIndex()}
        />
        <Button 
          onClick={onIndex} 
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
        {history.map((item: any, i: number) => (
          <div 
            key={i} 
            onClick={() => onSelectSession(item)}
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
  );
}