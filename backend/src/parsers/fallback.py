from langchain_text_splitters import RecursiveCharacterTextSplitter, Language
from .base import BaseParser

class FallbackParser(BaseParser):
    def __init__(self, chunk_size, chunk_overlap, extension_map):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.extension_map = extension_map

    def parse(self, content: str, metadata: dict):
        file_ext = "." + metadata["path"].split('.')[-1]
        
        lang = self.extension_map.get(file_ext)
        if lang:
            splitter = RecursiveCharacterTextSplitter.from_language(
                language=lang, chunk_size=self.chunk_size, chunk_overlap=self.chunk_overlap
            )
        else:
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=self.chunk_size, chunk_overlap=self.chunk_overlap
            )

        chunks = splitter.split_text(content)
        processed_chunks = []
        
        # Using cursor logic implified line counting here
        current_pos = 0
        for i, chunk in enumerate(chunks):
            start_index = content.find(chunk, current_pos)
            start_line = content[:start_index].count('\n') + 1 if start_index != -1 else 1
            end_line = start_line + chunk.count('\n')
            
            processed_chunks.append({
                "content": chunk,
                "start_line": start_line,
                "end_line": end_line,
                "node_type": "text_chunk"
            })
            current_pos = start_index + len(chunk)
            
        return processed_chunks