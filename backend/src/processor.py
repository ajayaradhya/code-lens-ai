from langchain_text_splitters import Language

from .parsers.treesitter_parser import TreeSitterParser
from .parsers.python_ast import PythonASTParser
from .parsers.fallback import FallbackParser

import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("CodeLensAI")

class CodeProcessor:
    def __init__(self, chunk_size=1000, chunk_overlap=100):
        self.extension_map = {
            '.py': Language.PYTHON, '.js': Language.JS, 
            '.ts': Language.TS, '.go': Language.GO
        }
        # 1. Define specific parsers
        self.python_parser = PythonASTParser()
        self.js_parser = TreeSitterParser(language='javascript')
        self.ts_parser = TreeSitterParser(language='typescript')
        self.tsx_parser = TreeSitterParser(language='tsx')
        
        # 2. Create a Parser Registry (Extension -> Parser Instance)
        self.parser_registry = {
            '.py': self.python_parser,
            '.js': self.js_parser,
            '.jsx': self.js_parser,
            '.ts': self.ts_parser,
            '.tsx': self.tsx_parser
        }
        
        self.fallback_parser = FallbackParser(chunk_size, chunk_overlap, self.extension_map)

    def process(self, extracted_data):
        results = {"chunks": [], "warnings": [], "errors": [], "summary": {"total_chunks": 0}}

        for item in extracted_data:
            content = item["content"]
            meta = item["metadata"]
            file_ext = "." + meta["path"].split('.')[-1]

            try:
                # Strategy: Try Specialized AST first, then Fallback
                parser = self.parser_registry.get(file_ext)
                
                chunks = None
                if parser:
                    chunks = parser.parse(content, meta)

                # If no specialized parser exists OR if it failed
                if chunks is None:
                    chunks = self.fallback_parser.parse(content, meta)

                for i, c in enumerate(chunks):
                    results["chunks"].append({
                        "page_content": c["content"],
                        "metadata": {
                            "source": meta.get("path"),       # Explicitly set the source
                            "file_name": meta.get("path", "").split('/')[-1], # Helper for UI
                            "branch": meta.get("branch"),
                            "start_line": c["start_line"],
                            "end_line": c["end_line"],
                            "node_type": c.get("node_type", "unknown"),
                            "chunk_id": i
                        }
                    })
            except Exception as e:
                results["errors"].append(f"Error processing {meta['path']}: {str(e)}")

        results["summary"]["total_chunks"] = len(results["chunks"])
        logger.debug("Parsing complete:", results)
        return results