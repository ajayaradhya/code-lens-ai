import os
import re
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
        self.ignored_dirs = {'.git', 'node_modules', 'venv', '__pycache__', 'dist', 'build', '.vscode', '.idea', 'target', 'tests'}
        self.forbidden_files = {'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'poetry.lock'}
        self.ignored_extensions = {
            # 1. Media & Assets (Non-text)
            '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.pdf', '.zip', '.gz', '.tar',
            
            # 2. Executables & Binaries
            '.exe', '.dll', '.so', '.pyc', '.pyd', '.obj', '.o', '.bin',
            
            # 3. UI/Style Noise (Optional - depending on if you want UI logic)
            '.css', '.scss', '.sass', '.less',
            
            # 4. Data & Logs (High noise, low logic)
            '.csv', '.log', '.sql', '.sqlite', '.db',
            
            # 5. Lockfiles (Massive and redundant)
            '.lock', '.lockb'
        }

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

    def _strip_mermaid(self, content):
        """
        Improved regex to catch mermaid blocks with attributes 
        like ```mermaid: { ... } or ```mermaid [id].
        """
        # Regex breakdown:
        # ```(?i)mermaid  -> Match backticks + case-insensitive 'mermaid'
        # [^ \n]* -> Match any character that isn't a space or newline (attributes/colons)
        # .*?             -> Non-greedy match of the actual diagram content
        # ```             -> Closing backticks
        pattern = r"```(?i)mermaid[^ \n]*.*?```"
        
        def replace_with_newlines(match):
            count = match.group(0).count('\n')
            return '\n' * count

        return re.sub(pattern, replace_with_newlines, content, flags=re.DOTALL)
    
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
            # Using shallow clone depth=1 as we need only latest master branch code and not any history of the repository
            repo = Repo.clone_from(self.repo_url, self.temp_dir, depth=1)
            results["branch"] = repo.active_branch.name
            results["commit_hash"] = repo.head.object.hexsha
            
        except Exception as e:
            results["errors"].append(f"Failed to clone repository: {str(e)}")
            return results

        for root, dirs, files in os.walk(self.temp_dir):
            # dirs[:] is used here instead of dirs[] to make sure that the dir is replaced in memory
            # dirs[] would create a local variable and os.walk generator would never pick the filtered list
            # Since os.walk is generator, on next iteration os.walk will pick the files from filetered directories
            dirs[:] = [d for d in dirs if d not in self.ignored_dirs and not d.startswith('.')]
            
            for file in files:
                if file.lower() in self.forbidden_files or any(file.endswith(ext) for ext in self.ignored_extensions):
                    continue

                results["summary"]["total_files_found"] += 1
                file_ext = os.path.splitext(file)[1].lower()
                
                if file_ext in self.supported_extensions:
                    file_path = os.path.join(root, file)
                    rel_path = os.path.relpath(file_path, self.temp_dir)
                    
                    try:
                        file_size = os.path.getsize(file_path)
                        # 500_000 here denotes 500000 bytes (500 KB) 500_000 is just a more readable representation of 500000
                        # this is undertaken to ignore larger codes such as generated content
                        if file_size > 500_000: 
                            results["warnings"].append(f"Skipped {rel_path}: File too large.")
                            continue

                        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                            lines = f.readlines()
                            content = "".join(lines) # creates a single line string of the entire file

                            # Strip mermaid content
                            if file_ext == '.md':
                                content = self._strip_mermaid(content)
                            
                            # Just extract full file content as single line string
                            # We will do parsing later in processor
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