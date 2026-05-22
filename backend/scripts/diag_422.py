import json

import requests

url = "http://127.0.0.1:8000/api/v1/auth/register"
payload = {
    "email": "test@electro.local",
    "password": "vanguard123",
    "full_name": "Vanguard Pilot",
    "phone": "79000000000",
}

response = requests.post(url, json=payload)
print(f"Status: {response.status_code}")
try:
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
except Exception as e:
    print(f"Failed to parse JSON: {e}")
    print(response.text)
