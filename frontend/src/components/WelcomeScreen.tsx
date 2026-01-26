import { Terminal, Database, Zap, Github } from "lucide-react";

interface WelcomeScreenProps {
  status: 'idle' | 'indexing' | 'ready';
  repoUrl: string;
  activeBranch: string;
  onQuery: (prompt: string) => void;
}

export function WelcomeScreen({ status, repoUrl, activeBranch, onQuery }: WelcomeScreenProps) {
  const repoName = repoUrl.split('/').pop() || "Repository";

  const starterPrompts = [
    { 
      label: "Architecture", 
      icon: <Database size={16} />, 
      prompt: "Give me a high-level overview of this project's architecture and folder structure." 
    },
    { 
      label: "Entry Point", 
      icon: <Zap size={16} />, 
      prompt: "Where is the main entry point of the application and how does it initialize?" 
    },
    { 
      label: "Logic Flow", 
      icon: <Github size={16} />, 
      prompt: "Explain the core logic flow of the most important features in this codebase." 
    }
  ];

  return (
    <div className="h-[75vh] flex flex-col items-center justify-center text-center px-4 animate-in fade-in duration-700">
      {/* Icon Header */}
      <div className="w-16 h-16 bg-[#1e1f20] rounded-2xl flex items-center justify-center mb-8 border border-white/5 shadow-2xl">
        <Terminal className="text-[#8ab4f8]" size={32} />
      </div>

      {/* Title State */}
      <h2 className="text-4xl font-light text-white mb-2 italic tracking-tight">
        {status === 'ready' ? "Context Loaded." : "Hello, Developer."}
      </h2>
      
      <p className="text-[#9aa0a6] mb-12 text-sm max-w-md mx-auto leading-relaxed">
        {status === 'ready' 
          ? `I've mapped out ${repoName} on branch ${activeBranch}. What would you like to explore?` 
          : "Connect a GitHub repository to begin a deep-dive analysis of its internal logic."}
      </p>

      {/* Suggestion Grid */}
      {status === 'ready' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full max-w-2xl animate-in slide-in-from-bottom-4 duration-500">
          {starterPrompts.map((q, i) => (
            <button
              key={i}
              onClick={() => onQuery(q.prompt)}
              className="flex flex-col items-start p-5 rounded-2xl bg-[#1e1f20] border border-white/5 hover:border-[#8ab4f8]/40 hover:bg-[#252629] transition-all text-left group"
            >
              <div className="mb-4 p-2 rounded-lg bg-[#131314] text-[#8ab4f8] group-hover:text-white transition-colors">
                {q.icon}
              </div>
              <span className="text-sm font-medium text-[#c4c7c5] group-hover:text-white">
                {q.label}
              </span>
              <span className="text-[10px] text-[#5f6368] mt-1 line-clamp-2">
                {q.prompt}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}