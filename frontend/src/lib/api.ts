// If the UI and API are on the same port, this just works:
const BASE_URL = "";

export const api = {
  /**
   * Triggers repo ingestion. 
   * @param force - If true, bypasses cache and re-indexes the repository.
   */
  ingest: async (
    repo_url: string, 
    onStatus: (data: { status: string; message: string; summary?: any; branch?: string }) => void,
    force: boolean = false // Added force parameter
  ) => {
    try {
      const response = await fetch(`${BASE_URL}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_url, force }), // Passing force to backend
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to start ingestion");
      }
      
      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = ""; 

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;

          const jsonString = line.replace("data: ", "").trim();
          try {
            const data = JSON.parse(jsonString);
            onStatus(data);
          } catch (e) {
            console.error("Invalid JSON in SSE stream:", jsonString);
          }
        }
      }
    } catch (err: any) {
      throw err;
    }
  },

  query: async (repo_url: string, question: string, onChunk: (text: string) => void) => {
    try {
      const response = await fetch(`${BASE_URL}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_url, question }),
      });

      if (!response.ok) throw new Error("Query failed");
      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const rawChunk = decoder.decode(value, { stream: true });
        
        // Handle potential "data:" prefixes if backend uses SSE format for queries too
        const cleanChunk = rawChunk.replace(/^data:\s*/gm, "");
        
        if (cleanChunk) {
          onChunk(cleanChunk);
        }
      }
    } catch (err) {
      console.error("Streaming error:", err);
      throw err;
    }
  },

  deleteIndex: async (repo_url: string) => {
    const response = await fetch(`${BASE_URL}/ingest`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo_url }),
    });
    return response.json();
  },
};