import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ExternalLink, Copy, FileCode } from "lucide-react";

export function ChatMessage({ m, isStreaming, isLast, getGithubLink }: any) {
  
  // REGEX: Matches [path/to/file.ext:line] or [path\to\file.ext:line]
  const citationRegex = /\[([\w\.\-\/\\]+\.[a-z0-9]+):(\d+)\]/g;

  const MarkdownComponents = {
    // Override paragraph to catch and replace citations without backtick loops
    p({ children }: any) {
      if (typeof children !== 'string' && !Array.isArray(children)) return <p>{children}</p>;

      const processText = (text: string) => {
        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = citationRegex.exec(text)) !== null) {
          // Push text before the match
          parts.push(text.substring(lastIndex, match.index));

          const fileName = match[1];
          const line = match[2];
          const url = getGithubLink(fileName, parseInt(line));

          // Push the Custom Citation Component
          parts.push(
            <a
              key={`${fileName}-${line}-${match.index}`}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20 no-underline hover:bg-blue-500/20 transition-all font-mono text-[11px] font-bold mx-0.5"
            >
              <FileCode size={10} />
              {fileName.split(/[/\\]/).pop()}:{line}
              <ExternalLink size={10} className="opacity-50" />
            </a>
          );
          lastIndex = citationRegex.lastIndex;
        }
        parts.push(text.substring(lastIndex));
        return parts;
      };

      // Handle both single strings and arrays of children from ReactMarkdown
      const newChildren = Array.isArray(children) 
        ? children.map(child => typeof child === 'string' ? processText(child) : child)
        : typeof children === 'string' ? processText(children) : children;

      return <p className="mb-4 last:mb-0 leading-relaxed text-[#e3e3e3]">{newChildren}</p>;
    },

    code({ inline, className, children, ...props }: any) {
      const content = String(children).replace(/\n$/, '');
      const match = /language-(\w+)/.exec(className || '');

      if (!inline && match) {
        return (
          <div className="rounded-xl overflow-hidden my-6 border border-white/5 shadow-2xl group text-sm">
            <div className="bg-[#2a2b2e] px-4 py-2 text-[10px] font-bold font-mono text-[#9aa0a6] border-b border-white/5 flex justify-between uppercase tracking-widest">
              <span>{match[1]}</span>
              <button onClick={() => navigator.clipboard.writeText(content)} className="opacity-0 group-hover:opacity-100 hover:text-white transition-opacity flex items-center gap-1">
                <Copy size={10} /> Copy
              </button>
            </div>
            <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" customStyle={{ margin: 0, background: '#1e1f20', padding: '1.5rem' }} {...props}>
              {content}
            </SyntaxHighlighter>
          </div>
        );
      }
      return <code className="bg-white/10 px-1.5 py-0.5 rounded text-[#e3e3e3] font-mono text-[13px]" {...props}>{children}</code>;
    }
  };

  return (
    <div className="flex gap-6 mb-12 animate-in fade-in slide-in-from-bottom-3 duration-500">
      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold tracking-widest ${
        m.role === 'user' ? 'bg-[#3c4043] text-[#e3e3e3] border border-white/10' : 'bg-[#1e1f20] border border-blue-500/20'
      }`}>
        {m.role === 'user' ? "YOU" : <img src="/code-lens-logo.svg" className="w-5 h-5" alt="AI" />}
      </div>
      <div className="flex-1 min-w-0 pt-1">
        <div className="prose prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
            {/* NO processContent call here - we handle it in the 'p' component */}
            {m.content}
          </ReactMarkdown>
          {isStreaming && isLast && m.role === 'ai' && (
            <span className="inline-block w-2 h-4 bg-blue-500 ml-1 animate-pulse align-middle" />
          )}
        </div>
      </div>
    </div>
  );
}