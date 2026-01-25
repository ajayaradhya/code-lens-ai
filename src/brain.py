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
        Synthesizes an answer based on retrieved code snippets with line-level citations.
        """
        # 1. Prepare the context block with Line Numbers
        context_parts = []
        for s in context_snippets:
            # We explicitly format the metadata so the LLM sees exactly where the code sits
            snippet_header = f"--- FILE: {s['source']} (Lines {s['start_line']}-{s['end_line']}) ---"
            context_parts.append(f"{snippet_header}\n{s['content']}")
        
        context_text = "\n\n".join(context_parts)

        # 2. Updated System Prompt for Citations
        # We use a strict format [filename:line] for the frontend to regex-match
        system_instruction = """
        SYSTEM: You are 'CodeLensAI', a senior software architect.
        Your goal is to provide technical answers based on the provided codebase snippets.

        CITATION RULES:
        1. You MUST cite your sources using the format: [filename:line].
        2. Example: "The database connection is initialized in `[db.py:24]`."
        3. If a snippet covers multiple lines, cite the starting line.
        4. Citations should be clickable-style links in the text.

        CONSTRAINTS:
        - Use ONLY the provided context.
        - Use markdown for code blocks.
        - If the answer isn't in the context, state that you cannot find it in the current index.
        """

        user_prompt = f"""
        {system_instruction}

        CONTEXT:
        {context_text}

        USER QUESTION: 
        {question}
        """

        # 3. Stream the response
        try:
            response_stream = self.client.models.generate_content_stream(
                model=self.model_name,
                contents=user_prompt,
                config=genai.types.GenerateContentConfig(temperature=0.1)
            )

            for chunk in response_stream:
                if chunk.text:
                    yield chunk.text
        except Exception as e:
            error_str = str(e)
            logger.error(error_str)
            if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                # We yield a clean code that the frontend can catch
                yield "ERR_BRAIN_QUOTA: The AI is currently overwhelmed. Please wait about 30 seconds."
            else:
                yield f"ERR_BRAIN_GENERIC: {error_str}"
