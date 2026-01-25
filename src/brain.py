import json
import logging
import google.genai as genai

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("CodeLensAI")

class CodeLensBrain:
    def __init__(self, api_key):
        self.client = genai.Client(api_key=api_key)
        self.model_name = "models/gemini-2.5-flash-lite" # Upgraded to 2.0 for better instruction following

    async def generate_answer_stream(self, question, context_snippets):
        """
        Streams text with inline <cite> tags, followed by a final 
        METADATA_BATCH for the retrieval sidebar.
        """
        # 1. Prepare Context with Pre-baked Tags
        context_parts = []
        # We'll send this to the frontend at the end for the sidebar
        retrieval_metadata = {
            "query": question,
            "model": self.model_name,
            "snippets": []
        }
        
        for s in context_snippets:
            source_file = s['source'].replace("\\", "/")
            cite_tag = f'<cite file="{source_file}" line="{s["start_line"]}" />'
            
            # Populate metadata for the sidebar
            retrieval_metadata["snippets"].append({
                "file": source_file,
                "lines": f"{s['start_line']}-{s['end_line']}",
                "content": s['content'],
                "score": s.get('score', 0) # Assumes your retriever provides a similarity score
            })

            snippet_block = (
                f"--- SOURCE_TAG: {cite_tag} ---\n"
                f"FILE: {source_file}\n"
                f"CONTENT:\n{s['content']}"
            )
            context_parts.append(snippet_block)
        
        context_text = "\n\n".join(context_parts)

        system_instruction = """
        SYSTEM: You are 'CodeLensAI', a senior software architect.
        Answer the user's question using the provided codebase snippets.

        CITATION RULE:
        You must cite your sources using the EXACT <cite /> tag provided in the SOURCE_TAG header.
        
        CONSTRAINTS:
        1. Start your answer IMMEDIATELY.
        2. Use ONLY the provided <cite /> tags for citations.
        """

        user_prompt = f"{system_instruction}\n\nCONTEXT:\n{context_text}\n\nUSER QUESTION: {question}"

        try:
            response_stream = self.client.models.generate_content_stream(
                model=self.model_name,
                contents=user_prompt,
                config=genai.types.GenerateContentConfig(
                    temperature=0.0,
                    max_output_tokens=1536
                )
            )

            # Step A: Stream the text chunks
            for chunk in response_stream:
                if chunk.text:
                    yield chunk.text

            # Step B: Final Metadata Chunk
            # We prefix this with a specific marker so the frontend knows it's not display text
            yield f"\n\nMETADATA_BATCH: {json.dumps(retrieval_metadata)}"

        except Exception as e:
            error_str = str(e)
            logger.error(f"Generation error: {error_str}")
            if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                yield "ERR_BRAIN_QUOTA: The AI is currently overwhelmed. Please wait about 30 seconds."
            else:
                yield f"ERR_BRAIN_GENERIC: {error_str}"
