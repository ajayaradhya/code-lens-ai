from langchain_text_splitters import Language

from .parsers.treesitter_parser import TreeSitterParser
from .parsers.python_ast import PythonASTParser
from .parsers.fallback import FallbackParser

class CodeProcessor:
    def __init__(self, chunk_size=1000, chunk_overlap=100):
        self.extension_map = {
            '.py': Language.PYTHON, '.js': Language.JS, 
            '.ts': Language.TS, '.go': Language.GO
        }
        self.python_parser = PythonASTParser()
        self.js_parser = TreeSitterParser(language='javascript')
        self.ts_parser = TreeSitterParser(language='typescript')
        self.fallback_parser = FallbackParser(chunk_size, chunk_overlap, self.extension_map)

    def process(self, extracted_data):
        results = {"chunks": [], "warnings": [], "errors": [], "summary": {"total_chunks": 0}}

        for item in extracted_data:
            content = item["content"]
            meta = item["metadata"]
            file_ext = "." + meta["path"].split('.')[-1]

            try:
                # Strategy: Try Specialized AST first, then Fallback
                chunks = None
                if file_ext == '.py':
                    chunks = self.python_parser.parse(content, meta)
                elif file_ext == '.js':
                    chunks = self.js_parser.parse(content, meta)
                elif file_ext == '.ts':
                    chunks = self.ts_parser.parse(content, meta)

                # If not python or AST failed
                if not chunks:
                    chunks = self.fallback_parser.parse(content, meta)

                for i, c in enumerate(chunks):
                    results["chunks"].append({
                        "page_content": c["content"],
                        "metadata": {
                            **meta,
                            "start_line": c["start_line"],
                            "end_line": c["end_line"],
                            "node_type": c.get("node_type", "unknown"),
                            "chunk_id": i
                        }
                    })
            except Exception as e:
                results["errors"].append(f"Error processing {meta['path']}: {str(e)}")

        results["summary"]["total_chunks"] = len(results["chunks"])
        return results