import { FileCode, ExternalLink } from "lucide-react";

export const CitationBadge = ({ file, line, getGithubLink }: any) => {
  const fileName = file.split(/[/\\]/).pop();
  const url = getGithubLink(file, line);

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 bg-[#2d2f31] hover:bg-[#3c4043] text-[#8ab4f8] px-2 py-0.5 rounded-full border border-[#444746] no-underline transition-all text-[11px] font-medium mx-1 group"
    >
      <FileCode size={12} className="text-[#8ab4f8]/80" />
      <span>{fileName}:{line}</span>
      <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
    </a>
  );
};