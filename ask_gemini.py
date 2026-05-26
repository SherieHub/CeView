import os
import sys
from google import genai

# Grab the API key from your environment variables
api_key = os.environ.get("GEMINI_API_KEY")

if not api_key:
    print("Error: GEMINI_API_KEY environment variable not set.")
    sys.exit(1)

# Initialize the client
client = genai.Client(api_key=api_key)

# Get the prompt from the command line arguments
prompt = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "Say hello!"

print(f"Thinking...\n")

# Call the model
response = client.models.generate_content(
    model='gemini-1.5-flash',
    contents=prompt
)

print(response.text)