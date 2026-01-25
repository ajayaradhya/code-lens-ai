import os
import shutil
import stat
import time
import tempfile
from git import Repo

class RepoIngestor:
    def __init__(self, repo_url):
        self.repo_url = repo_url
        self.temp_dir = os.path.abspath(os.path.join(tempfile.gettempdir(), "codelens_repo"))
        self.supported_extensions = {'.py', '.js', '.ts', '.tsx', '.jsx', '.java', '.cpp', '.h', '.go', '.md', '.txt', '.html', '.css', '.rs'}
        self.ignored_dirs = {'.git', 'node_modules', 'venv', '__pycache__', 'dist', 'build', '.vscode', '.idea', 'target'}

    def _on_rm_error(self, func, path, exc_info):
        try:
            os.chmod(path, stat.S_IWRITE)
            func(path)
        except Exception:
            pass 

    def _cleanup(self):
        if os.path.exists(self.temp_dir):
            try:
                shutil.rmtree(self.temp_dir, onerror=self._on_rm_error)
            except Exception:
                try:
                    old_path = f"{self.temp_dir}_{int(time.time())}"
                    os.rename(self.temp_dir, old_path)
                except Exception:
                    self.temp_dir = tempfile.mkdtemp(prefix="codelens_")

    def ingest(self):
        results = {
            "extracted_code": [],
            "warnings": [],
            "errors": [],
            "branch": "unknown",
            "commit_hash": "unknown",
            "summary": {
                "total_files_found": 0, 
                "files_indexed": 0,
                "repo_path": self.temp_dir
            }
        }

        try:
            self._cleanup()
            repo = Repo.clone_from(self.repo_url, self.temp_dir, depth=1)
            results["branch"] = repo.active_branch.name
            results["commit_hash"] = repo.head.object.hexsha
            
        except Exception as e:
            results["errors"].append(f"Failed to clone repository: {str(e)}")
            return results

        for root, dirs, files in os.walk(self.temp_dir):
            dirs[:] = [d for d in dirs if d not in self.ignored_dirs and not d.startswith('.')]
            
            for file in files:
                results["summary"]["total_files_found"] += 1
                file_ext = os.path.splitext(file)[1].lower()
                
                if file_ext in self.supported_extensions:
                    file_path = os.path.join(root, file)
                    rel_path = os.path.relpath(file_path, self.temp_dir)
                    
                    try:
                        file_size = os.path.getsize(file_path)
                        if file_size > 500_000: 
                            results["warnings"].append(f"Skipped {rel_path}: File too large.")
                            continue

                        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                            lines = f.readlines()
                            content = "".join(lines)
                            
                            if content.strip():
                                results["extracted_code"].append({
                                    "content": content,
                                    "metadata": {
                                        "path": rel_path,
                                        "branch": results["branch"],
                                        "commit": results["commit_hash"],
                                        "total_lines": len(lines) 
                                    }
                                })
                                results["summary"]["files_indexed"] += 1
                                
                    except Exception as e:
                        results["errors"].append(f"Error reading {rel_path}: {str(e)}")

        return results