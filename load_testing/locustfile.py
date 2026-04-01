import uuid
import random
from datetime import datetime
from locust import HttpUser, task, between
from faker import Faker

fake = Faker()

class AuraWealthUser(HttpUser):
    wait_time = between(1, 3)

    def on_start(self):
        """Initialize user: Register, Login, and get JWT token."""
        self.email = fake.unique.email()
        self.password = "AuraSecure123!"
        self.full_name = fake.name()

        # Register User
        res_reg = self.client.post("/api/v1/auth/register", json={
            "email": self.email,
            "password": self.password,
            "full_name": self.full_name,
            "monthly_income": random.randint(100000, 500000)
        })

        # Login User (OAuth2 Password Bearer uses form data)
        res_login = self.client.post("/api/v1/auth/login", data={
            "username": self.email,
            "password": self.password
        })

        if res_login.status_code == 200:
            token = res_login.json().get("access_token")
            self.client.headers.update({"Authorization": f"Bearer {token}"})
        else:
            print(f"Login failed: {res_login.status_code} - {res_login.text}")

    @task(8)
    def view_dashboard(self):
        """Simulate loading the Dashboard."""
        self.client.get("/api/v1/dashboard/?month=3&year=2026", name="/api/v1/dashboard")

    @task(3)
    def add_transaction(self):
        """Simulate a Quick Add generic transaction."""
        payload = {
            "amount": round(random.uniform(100.0, 5000.0), 2),
            "currency": "RUB",
            "category_id": random.randint(1, 8),
            "executed_at": datetime.utcnow().isoformat() + "Z",
            "entry_type": "manual",
            "comment": "Locust Load Test"
        }
        headers = {"Idempotency-Key": str(uuid.uuid4())}
        self.client.post("/api/v1/transactions/", json=payload, headers=headers, name="/api/v1/transactions/")

    @task(1)
    def request_ai_insight(self):
        """Simulate requesting a year's AI financial analysis."""
        self.client.post("/api/v1/insights/", json={"year": 2025}, name="/api/v1/insights/")
