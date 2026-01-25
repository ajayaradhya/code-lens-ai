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

