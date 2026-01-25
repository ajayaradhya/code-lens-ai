import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from "lucide-react";
import { useState } from "react";

export function CodeBlock({ language, content }: { language: string, content: string }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-lg overflow-hidden border border-[#3c4043] bg-[#1e1f20]">
      <div className="flex items-center justify-between px-4 py-2 bg-[#2d2f31] border-b border-[#3c4043]">
        <span className="text-xs font-mono text-[#bdc1c6] uppercase tracking-wider">{language}</span>
        <button onClick={copyToClipboard} className="text-[#bdc1c6] hover:text-white transition-colors flex items-center gap-1.5 text-xs">
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {/* Scrollable Container */}
      <div className="overflow-x-auto custom-scrollbar">
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          PreTag="div"
          customStyle={{
            margin: 0,
            padding: '1rem',
            background: 'transparent',
            fontSize: '13px',
            lineHeight: '1.5',
            minWidth: '100%', // Ensures background covers full scroll width
          }}
        >
          {content}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}