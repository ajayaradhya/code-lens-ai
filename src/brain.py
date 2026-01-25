"""
CodeLensBrain is the core and is responsible for orchestrating retrieved vectors, LLM and provide answer.

Prompt is to be constructed in the following way
"You are an expert software architect. Below is context from a codebase. Answer the user question based on this code.
--- CONTEXT --- 
[File: src/main.py] [Code Snippet 1...]
[File: src/app.py] [Code Snippet 2...]
--- USER QUESTION --- 
How is the API authenticated?"

Output of the app is steam instead of waiting 10s for response.
This is to fetch result to user faster and make it feel like 'typewriter' response of LLMs.

"""
import google.genai as genai

class CodeLensBrain:
    def __init__(self, api_key):
        # We use Flash for speed and cost-efficiency
        self.client = genai.Client(api_key=api_key)
        self.model_name = "models/gemini-flash-latest"

    def generate_answer_stream(self, question, context_snippets):
        """
        Synthesizes an answer based on retrieved code snippets.
        """
        # 1. Prepare the context block
        context_text = "\n\n".join([
            f"FILE: {s['source']}\nCODE:\n{s['content']}" 
            for s in context_snippets
        ])

        # 2. Build a high-compatibility prompt
        # We keep instructions inside the prompt to avoid version-specific config errors
        user_prompt = f"""
        SYSTEM: You are 'CodeLensAI', a senior software architect. 
        Use ONLY the provided code snippets to answer. ALWAYS cite the file name.
        If the answer isn't in the context, say you don't know.

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
                config=genai.types.GenerateContentConfig(
                    temperature=0.1,
                )
            )

            for chunk in response_stream:
                if chunk.text:
                    yield chunk.text
        except Exception as e:
            yield f"Critical Brain Error: {str(e)}"
