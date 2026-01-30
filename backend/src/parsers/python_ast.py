import ast
from .base import BaseParser

class PythonASTParser(BaseParser):
    def parse(self, content: str, metadata: dict):
        chunks = []
        try:
            tree = ast.parse(content)
            lines = content.splitlines()
            total_lines = len(lines)
            
            # 1. Identify all structural nodes and their ranges
            structural_nodes = []
            for node in ast.iter_child_nodes(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                    start = node.lineno
                    end = getattr(node, 'end_lineno', start)
                    structural_nodes.append((start, end, node))

            # Sort nodes by start line just in case
            structural_nodes.sort(key=lambda x: x[0])

            # 2. Extract nodes and the "gaps" between them
            last_covered_line = 0

            for start, end, node in structural_nodes:
                # Check if there is code BEFORE this node (Top-level code)
                if start - 1 > last_covered_line:
                    gap_text = "\n".join(lines[last_covered_line : start - 1])
                    if gap_text.strip():
                        chunks.append({
                            "content": gap_text,
                            "start_line": last_covered_line + 1,
                            "end_line": start - 1,
                            "node_type": "ModuleLevelCode"
                        })

                # Extract the actual structural node
                node_text = "\n".join(lines[start - 1 : end])
                chunks.append({
                    "content": node_text,
                    "start_line": start,
                    "end_line": end,
                    "node_type": type(node).__name__
                })
                last_covered_line = end

            # 3. Capture any remaining code at the end of the file
            if last_covered_line < total_lines:
                remainder_text = "\n".join(lines[last_covered_line:])
                if remainder_text.strip():
                    chunks.append({
                        "content": remainder_text,
                        "start_line": last_covered_line + 1,
                        "end_line": total_lines,
                        "node_type": "ModuleLevelCode"
                    })

            return chunks
        except Exception:
            return None