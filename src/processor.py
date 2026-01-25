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
                meta = item["metadata"] 
                file_ext = "." + meta["path"].split('.')[-1]
                
                # Choose the appropriate splitter
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
                
                # --- Line Number Calculation ---
                for i, chunk in enumerate(chunks):
                    # Find the first occurrence of this chunk in the original content 
                    # to determine the starting line number.
                    start_index = content.find(chunk)
                    
                    # If for some reason find() fails, default to 1
                    # count('\n') from start of file to the chunk index gives line offset
                    start_line = content[:start_index].count('\n') + 1 if start_index != -1 else 1
                    
                    # Estimate end line based on chunk content
                    end_line = start_line + chunk.count('\n')

                    results["chunks"].append({
                        "page_content": chunk,
                        "metadata": {
                            "source": meta["path"],
                            "branch": meta["branch"],
                            "commit": meta["commit"],
                            "start_line": start_line,
                            "end_line": end_line,
                            "chunk_id": i
                        }
                    })
            except Exception as e:
                results["errors"].append(f"Failed to split {meta.get('path', 'unknown')}: {str(e)}")
        
        results["summary"]["total_chunks"] = len(results["chunks"])
        return results