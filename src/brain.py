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
        self.client = genai.Client(api_key=api_key, http_options={'api_version': 'v1alpha'})
        self.model_name = "gemini-1.5-flash"

    def generate_answer_stream(self, question, context_snippets)   :
        """
        Synthesizes an answer based on retrieved code snippets.
        """
        # 1. Prepare the context block
        context_text = "\n\n".join([
            f"FILE: {s['source']}\nCODE:\n{s['content']}" 
            for s in context_snippets
        ])

        # 2. Define the System Persona and Rules
        # Prompt Anchoring: Suffixing prompt with 'FINAL ANSWER:' will force LLM to answer without it being chatty.
        # 2. Build the System Instruction
        system_instruction = (
            "You are 'CodeLensAI', a senior software architect. "
            "Use ONLY the provided code snippets to answer. "
            "If the answer is not in the code, state: 'I cannot find the answer in the provided repository context.' "
            "ALWAYS cite the file name. Use Markdown for formatting."
        )

        # 3. Construct the prompt
        user_prompt = f"""
        CONTEXT FROM REPOSITORY:
        {context_text}

        USER QUESTION:
        {question}
        
        FINAL ANSWER:
        """

        # 4. Generate answer using the context
        response_stream = self.client.models.generate_content_stream(
            model=self.model_name,
            contents=user_prompt,
            config=genai.types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.1,
            )
        )

        for chunk in response_stream:
            # The new SDK provides text chunks directly
            if chunk.text:
                yield chunk.text
