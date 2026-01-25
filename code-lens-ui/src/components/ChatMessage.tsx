import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ExternalLink } from "lucide-react";

export function ChatMessage({ m, isStreaming, isLast, getGithubLink }: any) {
  const MarkdownComponents = {
    code({ inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const content = String(children).replace(/\n$/, '');
      const isFilePath = content.includes('.') && !content.includes(' ') && content.length < 60;

      if (!inline && match) {
        return (
          <div className="rounded-xl overflow-hidden my-6 border border-white/5 shadow-2xl group text-sm">
            <div className="bg-[#2a2b2e] px-4 py-2 text-[10px] font-bold font-mono text-[#9aa0a6] border-b border-white/5 flex justify-between tracking-widest uppercase">
              <span>{match[1]}</span>
              <button onClick={() => navigator.clipboard.writeText(content)} className="opacity-0 group-hover:opacity-100 hover:text-white transition-opacity">Copy</button>
            </div>
            <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" customStyle={{ margin: 0, background: '#1e1f20', padding: '1.5rem' }} {...props}>
              {content}
            </SyntaxHighlighter>
          </div>
        );
      }
      
      if (isFilePath) {
        return (
          <a href={getGithubLink(content)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 bg-[#8ab4f8]/10 text-[#8ab4f8] px-2.5 py-0.5 rounded-lg border border-[#8ab4f8]/20 no-underline hover:bg-[#8ab4f8]/20 transition-all font-mono text-[13px]">
            {content} <ExternalLink size={12} />
          </a>
        );
      }
      return <code className="bg-white/10 px-1.5 py-0.5 rounded text-[#e3e3e3]" {...props}>{children}</code>;
    }
  };

  return (
    <div className="flex gap-6 mb-12 animate-in fade-in slide-in-from-bottom-3 duration-500">
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
          {isStreaming && isLast && m.role === 'ai' && (
            <span className="inline-block w-2 h-4 bg-[#8ab4f8] ml-1 animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}