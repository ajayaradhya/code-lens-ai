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
import stat
import time
import tempfile
from git import Repo

class RepoIngestor:
    def __init__(self, repo_url):
        self.repo_url = repo_url
        # Using a consistent temp path; absolute pathing helps avoid WinError 5
        self.temp_dir = os.path.abspath(os.path.join(tempfile.gettempdir(), "codelens_repo"))
        
        # Lead Engineer Move: Explicit Whitelist and Blacklist
        # We focus on text-based source files to prevent token waste
        self.supported_extensions = {'.py', '.js', '.ts', '.java', '.cpp', '.h', '.go', '.md', '.txt', '.html', '.css'}
        self.ignored_dirs = {'.git', 'node_modules', 'venv', '__pycache__', 'dist', 'build', '.vscode', '.idea'}

    def _on_rm_error(self, func, path, exc_info):
        """
        Handler for shutil.rmtree to flip read-only bits.
        Essential for deleting .git/objects on Windows.
        """
        try:
            os.chmod(path, stat.S_IWRITE)
            func(path)
        except Exception:
            pass # If it still fails, the _cleanup method will handle the rename fallback

    def _cleanup(self):
        """
        Robust cleanup logic. If standard deletion fails due to process locks, 
        it renames the directory to clear the path for a new clone.
        """
        if os.path.exists(self.temp_dir):
            try:
                shutil.rmtree(self.temp_dir, onerror=self._on_rm_error)
            except Exception:
                # The 'Rename Fallback': If Windows locked the folder, move it aside
                try:
                    old_path = f"{self.temp_dir}_{int(time.time())}"
                    os.rename(self.temp_dir, old_path)
                except Exception:
                    # If even renaming fails, we generate a unique temp_dir for this run
                    self.temp_dir = tempfile.mkdtemp(prefix="codelens_")

    def ingest(self):
        """
        Clones, filters, and packages the codebase.
        Returns a structured dict for the Processor.
        """
        results = {
            "extracted_code": [],
            "warnings": [],
            "errors": [],
            "summary": {
                "total_files_found": 0, 
                "files_indexed": 0,
                "repo_path": self.temp_dir
            }
        }

        try:
            # Step 1: Force a clean directory
            self._cleanup()

            # Step 2: Shallow Clone (depth=1) for maximum efficiency
            # We don't need the commit history, just the current 'state' of the code
            Repo.clone_from(self.repo_url, self.temp_dir, depth=1)
            
        except Exception as e:
            results["errors"].append(f"Failed to clone repository: {str(e)}")
            return results

        # Step 3: Walk the repository
        for root, dirs, files in os.walk(self.temp_dir):
            # Lead Move: Modify dirs in-place to skip ignored directories efficiently
            dirs[:] = [d for d in dirs if d not in self.ignored_dirs and not d.startswith('.')]
            
            for file in files:
                results["summary"]["total_files_found"] += 1
                file_ext = os.path.splitext(file)[1].lower()
                
                if file_ext in self.supported_extensions:
                    file_path = os.path.join(root, file)
                    rel_path = os.path.relpath(file_path, self.temp_dir)
                    
                    # Guardrail: Avoid massive files (minified JS, datasets, etc.)
                    try:
                        file_size = os.path.getsize(file_path)
                        if file_size > 500_000: # 500KB Limit
                            results["warnings"].append(f"Skipped {rel_path}: File too large ({file_size // 1024}KB).")
                            continue

                        # Step 4: Read and Extract
                        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                            content = f.read()
                            if content.strip(): # Ignore empty files
                                results["extracted_code"].append({
                                    "content": content,
                                    "metadata": {"path": rel_path}
                                })
                                results["summary"]["files_indexed"] += 1
                                
                    except Exception as e:
                        results["errors"].append(f"Error reading {rel_path}: {str(e)}")

        return results