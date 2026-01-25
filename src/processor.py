"""
CodeProcessor is the core logic for chunking.
It uses language specific splitting using 'langchain' based on the extension of the file.
Defaulted chunk_size and overlap can be overridden during initialisation

Input: Preferably feed output of ingestor
Output: Structured chunks with warnings and errors
{
    "chunks": [{
            "page_content": "def get_data()\n\t..",
            "metadata": {
                "source": "app.py",
                "chunk_id": 1
            }
        },
        {
            "page_content": "class PeopleInterface(ABC):\n\t..",
            "metadata": {
                "source": "\interfaces\interfaces.py",
                "chunk_id": 2
            }
        }],
    "warnings": [],
    "errors": [],
    "summary": {
        "total_chunks": 2
    }
} 
"""

from langchain_text_splitters import RecursiveCharacterTextSplitter, Language

class CodeProcessor:
    def __init__(self, chunk_size=1000, chunk_overlap=100):
        self.chunk_size = chunk_size

        # Acts as connecting element between adjacent chunks
        self.chunk_overlap = chunk_overlap
        
        # Map file extensions to LangChain's supported languages
        self.extension_map = {
            '.py': Language.PYTHON,
            '.js': Language.JS,
            '.ts': Language.TS,
            '.java': Language.JAVA,
            '.cpp': Language.CPP,
            '.go': Language.GO
        }

    def process(self, extracted_data):
        """
        Takes the output of RepoIngestor and returns a list of 
        LangChain 'Document' objects.
        """
        results = {
            "chunks": [],
            "warnings": [],
            "errors": [],
            "summary": {
                "total_chunks": 0
            }
        }

        for item in extracted_data:
            try:
                content = item["content"]
                metadata = item["metadata"]
                file_ext = "." + metadata["path"].split('.')[-1]
                
                # Determine which splitter to use
                if file_ext in self.extension_map:
                    splitter = RecursiveCharacterTextSplitter.from_language(
                        language=self.extension_map[file_ext],
                        chunk_size=self.chunk_size,
                        chunk_overlap=self.chunk_overlap
                    )
                else:
                    # Fallback for Markdown or plain text
                    splitter = RecursiveCharacterTextSplitter(
                        chunk_size=self.chunk_size,
                        chunk_overlap=self.chunk_overlap
                    )

                # Split the text into chunks
                chunks = splitter.split_text(content)
                
                for i, chunk in enumerate(chunks):
                    results["chunks"].append({
                        "page_content": chunk,
                        "metadata": {
                            "source": item["metadata"]["path"],
                            "chunk_id": i
                        }
                    })
            except Exception as e:
                results["errors"].append(f"Failed to split {item['metadata']['path']}: {str(e)}")
        
        results["summary"]["total_chunks"] = len(results["chunks"])
        return results