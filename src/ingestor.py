"""
RepoIngestor is responsible for downloading the code and handling all OS functionalities
1) Shallow Clone: We just need latest snapshot of the system. Don't need to keep track of all commits and history of the repo.
2) Strategic File Filtering: We need ot parse only source code and ignore files like packages-lock.json, node_modules etc.
3) Keep track of relative path from root. This will later be used for citations.

Input: URL of the Public GitHub repository
Output: 
{
    "extracted_code": [
        {"content": "...", "metadata": {"path": "src/main.py"}},
        {"content": "...", "metadata": {"path": "src/utils.py"}}
    ],
    "warnings": [
        "File 'config.secret' was skipped (personal information found).",
        "File 'data.csv' was skipped (exceeds 1MB limit)."
    ],
    "errors": [
        "Failed to read 'docs/legacy.pdf' (unsupported encoding)."
    ],
    "summary": {
        "total_files_found": 53,
        "files_indexed": 50,
        "repo_size_kb": 450
    }
}

"""
import os
import shutil
import tempfile
from git import Repo

class RepoIngestor:
    def __init__(self, repo_url):
        self.repo_url = repo_url
        # Using a temporary directory that the OS will help manage
        self.temp_dir = os.path.join(tempfile.gettempdir(), "codelens_repo")
        
        # Lead Engineer Move: Explicit Whitelist and Blacklist
        self.supported_extensions = {'.py', '.js', '.ts', '.java', '.cpp', '.h', '.go', '.md', '.txt'}
        self.ignored_dirs = {'.git', 'node_modules', 'venv', '__pycache__', 'dist', 'build'}

    def _cleanup(self):
        """Ensure a clean slate before cloning."""
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)

    def ingest(self):
        """
        The main entry point. Clones, filters, and packages the codebase.
        Returns: Dict containing 'extracted_code', 'warnings', 'errors', and 'summary'.
        """
        results = {
            "extracted_code": [],
            "warnings": [],
            "errors": [],
            "summary": {"total_files_found": 0, "files_indexed": 0}
        }

        try:
            self._cleanup()
            # Important Detail: depth=1 for speed and efficiency
            Repo.clone_from(self.repo_url, self.temp_dir, depth=1)
        except Exception as e:
            results["errors"].append(f"Failed to clone repository: {str(e)}")
            return results

        for root, dirs, files in os.walk(self.temp_dir):
            # Important Detail: Efficient directory skipping
            # Using dirs[:] to point to the same memory location used by os.walk
            dirs[:] = [d for d in dirs if d not in self.ignored_dirs and not d.startswith('.')]
            
            for file in files:
                results["summary"]["total_files_found"] += 1
                file_ext = os.path.splitext(file)[1].lower()
                
                if file_ext in self.supported_extensions:
                    file_path = os.path.join(root, file)
                    rel_path = os.path.relpath(file_path, self.temp_dir)
                    
                    # Important Detail: Guardrail for large files
                    # For readability, 500000 can be represented as 500_000 in Python
                    if os.path.getsize(file_path) > 500_000: # 500KB limit
                        results["warnings"].append(f"Skipped {rel_path}: File too large.")
                        continue

                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                            results["extracted_code"].append({
                                "content": content,
                                "metadata": {"path": rel_path}
                            })
                            results["summary"]["files_indexed"] += 1
                    except UnicodeDecodeError:
                        results["errors"].append(f"Could not read {rel_path}: Non-text encoding.")
                    except Exception as e:
                        results["errors"].append(f"Error reading {rel_path}: {str(e)}")

        return results
