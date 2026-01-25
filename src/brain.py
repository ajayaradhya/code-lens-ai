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
import google.generativeai as genai

class CodeLensBrain:
    def __init__(self, api_key):
        genai.configure(api_key=api_key)
        # We use Flash for speed and cost-efficiency
        self.model = genai.GenerativeModel('gemini-1.5-flash')

    def generate_answer(self, question, context_snippets)   :
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
        prompt = f"""
        You are 'CodeLensAI', a senior software architect. Your goal is to explain code logic clearly.
        
        RULES:
        1. Use ONLY the provided code snippets below to answer.
        2. If the answer is not in the code, state: "I cannot find the answer in the provided repository context."
        3. ALWAYS cite the file name when explaining logic.
        4. Use Markdown for code blocks and bolding for emphasis.

        CONTEXT FROM REPOSITORY:
        {context_text}

        USER QUESTION:
        {question}
        
        FINAL ANSWER:
        """

        # 3. Generate with streaming for better UX
        response = self.model.generate_content(prompt, stream=True)
        return response