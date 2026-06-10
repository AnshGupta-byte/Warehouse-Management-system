import os
from typing import Optional

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

def get_chatbot_response(query: str, context: Optional[str] = "") -> str:
    if not GEMINI_API_KEY:
        print("[Chatbot] No GEMINI_API_KEY set — using Node.js fallback.")
        return ""

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=GEMINI_API_KEY)

        system_prompt = (
            "You are WarehouseAI, an advanced, professional AI Warehouse Management Assistant. "
            "Your tone is helpful, precise, and professional. "
            "Use markdown formatting (bold, bullet lists) to make answers structured and scannable."
        )

        user_message = ""
        if context:
            user_message = (
                f"Here is the current real-time state of the warehouse database:\n"
                f"```\n{context}\n```\n\n"
                f"User query: {query}\n\n"
                f"Answer based on the context above. If context is insufficient, answer to the best of your ability."
            )
        else:
            user_message = (
                f"User query: {query}\n\n"
                f"Answer regarding warehouse management, logistics, or supply chain topics. Be concise."
            )

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            config=types.GenerateContentConfig(system_instruction=system_prompt),
            contents=user_message,
        )

        return response.text or ""

    except Exception as e:
        print(f"[Chatbot] Gemini API call failed: {e}")
        return ""
