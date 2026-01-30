from abc import ABC, abstractmethod

class BaseParser(ABC):
    @abstractmethod
    def parse(self, content: str, metadata: dict):
        """Should return a list of dicts with 'content', 'start_line', and 'end_line'."""
        pass