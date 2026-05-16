import os
from dotenv import load_dotenv
from google import genai
import sys

# 1. Setup
env_path = None
for path in ['.env', '../.env', '../../.env']:
    if os.path.exists(path):
        env_path = path
        break

if env_path:
    load_dotenv(env_path)
    print(f"Loaded .env from: {os.path.abspath(env_path)}")
else:
    print("Warning: .env file not found!")

api_key = os.getenv("GEMMA_API_KEY")
if not api_key:
    raise ValueError("GEMMA_API_KEY not found in environment variables. Check your .env file.")

client = genai.Client(api_key=api_key)

# Generate content using the client.models accessor
response = client.models.generate_content(
    model='gemma-4-26b-a4b-it',
    contents="Introduce yourself and your capabilities."
)

print(response.text)