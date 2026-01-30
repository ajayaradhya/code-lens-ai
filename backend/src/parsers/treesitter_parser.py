from tree_sitter import Language, Parser
import tree_sitter_javascript as ts_js
import tree_sitter_typescript as ts_ts
from .base import BaseParser

class TreeSitterParser(BaseParser):
    def __init__(self, language='javascript'):
        # Map the language string to the specific grammar function
        grammar_map = {
            'typescript': ts_ts.language_typescript,
            'tsx': ts_ts.language_tsx,
            'javascript': ts_js.language,
            'jsx': ts_js.language
        }
        
        # Get the function from the map, default to javascript if not found
        lang_func = grammar_map.get(language, ts_js.language)
        
        # Initialize the parser with the resulting language object
        lang_obj = Language(lang_func())
        self.parser = Parser(lang_obj)
        
    def parse(self, content: str, metadata: dict):
        chunks = []
        try:
            tree = self.parser.parse(bytes(content, "utf8"))
            root_node = tree.root_node
            lines = content.splitlines()
            total_lines = len(lines)

            # 1. Expanded target types for TS/TSX support
            target_types = {
                'function_declaration', 'method_definition', 
                'class_declaration', 'variable_declarator',
                'interface_declaration', 'type_alias_declaration',
                'enum_declaration'
            }

            structural_nodes = []
            for node in root_node.children:
                # Handle Export Statements (Lexical wrapping)
                # We want the start/end lines of the WHOLE export, 
                # but the node_type of the logic inside.
                display_type = node.type
                search_node = node

                if node.type in {'export_statement', 'lexical_declaration'}:
                    # Find the interesting child inside the export
                    for child in node.children:
                        if child.type in target_types:
                            display_type = child.type
                            break
                
                if node.type in target_types or display_type in target_types:
                    # Use node (the parent) for lines to include the 'export' keyword
                    # Use display_type for the metadata label
                    start = node.start_point[0] + 1
                    end = node.end_point[0] + 1
                    structural_nodes.append((start, end, display_type))

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