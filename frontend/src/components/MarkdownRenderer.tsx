import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { CitationBadge } from "./CitationBadge";
import { CodeBlock } from "./CodeBlock";

export function MarkdownRenderer({ content, getGithubLink }: any) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{
        // Match our custom tag
        cite: ({ node, ...props }: any) => (
          <CitationBadge 
            file={props.file} 
            line={props.line} 
            getGithubLink={getGithubLink} 
          />
        ),
        code: ({ inline, className, children }: any) => {
          const match = /language-(\w+)/.exec(className || '');
          return !inline && match ? (
            <CodeBlock language={match[1]} content={String(children).replace(/\n$/, '')} />
          ) : (
            <code className="bg-[#3c4043] px-1.5 py-0.5 rounded text-[#e8eaed] font-mono text-xs">
              {children}
            </code>
          );
        },
        // Gemini-style layout
        p: ({ children }) => <p className="mb-4 leading-7 text-[#e8eaed]">{children}</p>,
        table: ({ children }) => (
          <div className="overflow-x-auto my-4 border border-[#3c4043] rounded-lg">
            <table className="w-full border-collapse">{children}</table>
          </div>
        )
      }}
    >
      {content}
    </ReactMarkdown>
  );
}