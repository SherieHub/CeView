import os
import threading
from langchain_google_genai import ChatGoogleGenerativeAI

class AgentLLMModel:
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(AgentLLMModel, cls).__new__(cls)
                cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        if "GOOGLE_API_KEY" not in os.environ:
            raise ValueError("GOOGLE_API_KEY environment variable is missing.")

        self.model_name = "gemini-2.5-flash"
        self.temperature = 0.7
        
        self.model = ChatGoogleGenerativeAI(
            model=self.model_name,
            temperature=self.temperature
        )

    def get_model(self):
        """Returns the configured LangChain ChatGoogleGenerativeAI instance."""
        return self.model

llm_wrapper = AgentLLMModel() 
model = llm_wrapper.get_model()