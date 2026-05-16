import os
from dotenv import load_dotenv
from google import genai

# Load environment variables from .env file (located in the project root)
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(env_path)

# Initialize the Client
api_key = os.getenv("GEMMA_API_KEY")
client = genai.Client(api_key=api_key)

# Generate content using the client.models accessor
response = client.models.generate_content(
    model='gemma-4-26b-a4b-it',
    contents="Introduce yourself and your capabilities."
)

print(response.text)