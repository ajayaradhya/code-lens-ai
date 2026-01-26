import { ChatMessage } from "./ChatMessage";
import { WelcomeScreen } from "./WelcomeScreen";

interface ChatListProps {
  messages: any[];
  status: 'idle' | 'indexing' | 'ready'; // Required for WelcomeScreen
  repoUrl: string;                       // Required for WelcomeScreen
  activeBranch: string;                  // Required for WelcomeScreen
  isStreaming: boolean;
  getGithubLink: (path: string, line?: number) => string;
  onSuggestQuery: (prompt: string) => void;
  onOpenInspector: (metadata: any) => void;
}

export function ChatList({ 
  messages, 
  status, 
  repoUrl, 
  activeBranch, 
  isStreaming, 
  getGithubLink, 
  onSuggestQuery,
  onOpenInspector
}: ChatListProps) {
  
  // If no messages, show the Welcome state using the passed props
  if (messages.length === 0) {
    return (
      <WelcomeScreen 
        status={status} 
        repoUrl={repoUrl} 
        activeBranch={activeBranch} 
        onQuery={onSuggestQuery} 
      />
    );
  }

  return (
    <div className="max-w-[850px] mx-auto px-6 md:px-12 py-10 md:py-20">
      {messages.map((m, i) => (
        <ChatMessage 
          key={i} 
          m={m} 
          isStreaming={isStreaming} 
          isLast={i === messages.length - 1} 
          getGithubLink={getGithubLink} 
          onOpenInspector={() => onOpenInspector(m.metadata)}
        />
      ))}

      {/* RAG Search Indicator */}
      {isStreaming && messages[messages.length - 1]?.role === 'user' && (
        <div className="flex gap-4 mt-8 animate-pulse text-[#9aa0a6] text-xs font-medium italic">
           <div className="w-8 h-8 rounded-full bg-[#3c4043]" />
           <div className="pt-2">Querying vector index & analyzing snippets...</div>
        </div>
      )}
    </div>
  );
}