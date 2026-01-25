from langchain_text_splitters import RecursiveCharacterTextSplitter, Language

class CodeProcessor:
    def __init__(self, chunk_size=1000, chunk_overlap=100):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.extension_map = {
            '.py': Language.PYTHON,
            '.js': Language.JS,
            '.ts': Language.TS,
            '.java': Language.JAVA,
            '.cpp': Language.CPP,
            '.go': Language.GO
        }

    def process(self, extracted_data):
        results = {
            "chunks": [],
            "warnings": [],
            "errors": [],
            "summary": {"total_chunks": 0}
        }

        for item in extracted_data:
            try:
                content = item["content"]
                meta = item["metadata"] # Contains path, branch, commit
                file_ext = "." + meta["path"].split('.')[-1]
                
                if file_ext in self.extension_map:
                    splitter = RecursiveCharacterTextSplitter.from_language(
                        language=self.extension_map[file_ext],
                        chunk_size=self.chunk_size,
                        chunk_overlap=self.chunk_overlap
                    )
                else:
                    splitter = RecursiveCharacterTextSplitter(
                        chunk_size=self.chunk_size,
                        chunk_overlap=self.chunk_overlap
                    )

                chunks = splitter.split_text(content)
                
                for i, chunk in enumerate(chunks):
                    results["chunks"].append({
                        "page_content": chunk,
                        "metadata": {
                            "source": meta["path"],
                            "branch": meta["branch"],
                            "commit": meta["commit"],
                            "chunk_id": i
                        }
                    })
            except Exception as e:
                results["errors"].append(f"Failed to split {meta['path']}: {str(e)}")
        
        results["summary"]["total_chunks"] = len(results["chunks"])
        return results