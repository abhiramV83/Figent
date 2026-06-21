from backend.llm_config import get_llm

llm = get_llm()
response = llm.invoke("Say 'connection successful' if you can read this.")
print(response.content)