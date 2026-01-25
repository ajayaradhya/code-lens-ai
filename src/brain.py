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
        Streams an answer where citations are embedded as HTML tags directly.
        This allows the frontend to render badges in real-time without a JSON map.
        """
        # 1. Prepare Context with Pre-baked Tags
        context_parts = []
        
        for s in context_snippets:
            # We create the exact tag we want the LLM to use
            # We use forward slashes for cross-platform compatibility
            source_file = s['source'].replace("\\", "/")
            cite_tag = f'<cite file="{source_file}" line="{s["start_line"]}" />'
            
            snippet_block = (
                f"--- SOURCE_TAG: {cite_tag} ---\n"
                f"FILE: {source_file}\n"
                f"CONTENT:\n{s['content']}"
            )
            context_parts.append(snippet_block)
        
        context_text = "\n\n".join(context_parts)

        # 2. System Instruction for Inline Tagging
        system_instruction = """
        SYSTEM: You are 'CodeLensAI', a senior software architect.
        Answer the user's question using the provided codebase snippets.

        CITATION RULE:
        You must cite your sources using the EXACT <cite /> tag provided in the SOURCE_TAG header for that snippet.
        
        Example Output: 
        "The server is initialized in <cite file="src/api.py" line="10" /> and handles routes in <cite file="src/routes.py" line="45" />."

        CONSTRAINTS:
        1. NEVER use [[N]] or [file:line] formats. ONLY use the <cite /> tags.
        2. Start your answer IMMEDIATELY. No introductory filler.
        3. If multiple snippets support a fact, place their tags side-by-side.
        4. Preserve the 'file' and 'line' attributes exactly as shown in the context.
        """

        user_prompt = f"""
        {system_instruction}

        CONTEXT:
        {context_text}

        USER QUESTION: 
        {question}
        """

        # 3. Stream the Response
        try:
            # Note: We NO LONGER yield a "CITATIONS_MAP" header. 
            # The citations are now part of the natural text flow.

            response_stream = self.client.models.generate_content_stream(
                model=self.model_name,
                contents=user_prompt,
                config=genai.types.GenerateContentConfig(
                    temperature=0.0, # Keep it deterministic
                    max_output_tokens=1536
                )
            )

            for chunk in response_stream:
                if chunk.text:
                    yield chunk.text

        except Exception as e:
            error_str = str(e)
            logger.error(f"Generation error: {error_str}")
            if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                yield "ERR_BRAIN_QUOTA: The AI is currently overwhelmed. Please wait about 30 seconds."
            else:
                yield f"ERR_BRAIN_GENERIC: {error_str}"
