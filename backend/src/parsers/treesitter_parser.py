from tree_sitter import Language, Parser
import tree_sitter_javascript as ts_js
import tree_sitter_typescript as ts_ts
from .base import BaseParser

class TreeSitterParser(BaseParser):
    def __init__(self, language='javascript'):
        # Initialize the specific language
        lang_module = ts_ts.language() if language == 'typescript' else ts_js.language()
        self.parser = Parser(lang_module)
        
    def parse(self, content: str, metadata: dict):
        chunks = []
        try:
            tree = self.parser.parse(bytes(content, "utf8"))
            root_node = tree.root_node
            lines = content.splitlines()
            total_lines = len(lines)

            # 1. Define nodes we want to extract
            # JS/TS have many function types: function_declaration, method_definition, arrow_function
            target_types = {
                'function_declaration', 'method_definition', 
                'class_declaration', 'variable_declarator'
            }

            structural_nodes = []
            for node in root_node.children:
                if node.type in target_types:
                    # Tree-sitter uses 0-indexed start_point (row, col)
                    start = node.start_point[0] + 1
                    end = node.end_point[0] + 1
                    structural_nodes.append((start, end, node.type))

            # 2. Extract nodes and "gaps" (Module Level Code)
            structural_nodes.sort(key=lambda x: x[0])
            last_covered_line = 0

            for start, end, node_type in structural_nodes:
                # Capture Gap (Top-level code/imports)
                if start - 1 > last_covered_line:
                    gap_text = "\n".join(lines[last_covered_line : start - 1])
                    if gap_text.strip():
                        chunks.append({
                            "content": gap_text,
                            "start_line": last_covered_line + 1,
                            "end_line": start - 1,
                            "node_type": "ModuleLevelCode"
                        })

                # Capture Structural Node
                node_text = "\n".join(lines[start - 1 : end])
                chunks.append({
                    "content": node_text,
                    "start_line": start,
                    "end_line": end,
                    "node_type": node_type
                })
                last_covered_line = end

            # 3. Final remainder
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