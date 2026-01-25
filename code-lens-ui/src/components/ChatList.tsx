import { ChatMessage } from "./ChatMessage";
import { WelcomeScreen } from "./WelcomeScreen";

interface ChatListProps {
  messages: any[];
  status: 'idle' | 'indexing' | 'ready';
  repoUrl: string;
  activeBranch: string;
  isStreaming: boolean;
  getGithubLink: (path: string) => string;
  onSuggestQuery: (prompt: string) => void;
}

export function ChatList({ 
  messages, 
  status, 
  repoUrl, 
  activeBranch, 
  isStreaming, 
  getGithubLink, 
  onSuggestQuery 
}: ChatListProps) {
  
  // If no messages, show the Welcome/Empty State
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

  // Otherwise, map through the conversation
  return (
    <div className="max-w-[850px] mx-auto px-8 py-20">
      {messages.map((m, i) => (
        <ChatMessage 
          key={i} 
          m={m} 
          isStreaming={isStreaming} 
          isLast={i === messages.length - 1} 
          getGithubLink={getGithubLink} 
        />
      ))}
    </div>
  );
}