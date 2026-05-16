from google import genai

# Initialize the Client
# If you set an environment variable GEMINI_API_KEY, you can just use genai.Client()
client = genai.Client(api_key="AIzaSyAazrqVx-UmY5QhJlANrLekvKYSuo6R8fM")

# Generate content using the client.models accessor
response = client.models.generate_content(
    model='gemma-4-26b-a4b-it',
    contents="Introduce yourself and your capabilities."
)

print(response.text)