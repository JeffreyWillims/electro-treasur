"""Locust-профиль Citrine Vault — трафик реального пользователя через nginx.

Аккаунты берутся из пула loadtest_N@loadtest.dev (сеются заранее, см.
scratchpad/seed_loadtest.py); авторизация — самоподписанный JWT в httpOnly-куке
(та же схема, что ставит /v1/auth/login). Честный логин под нагрузкой невозможен:
он ограничен 5/мин с одного IP — и это правильно для прода, но не для стенда.

Запуск (пример, ступень 500 пользователей):
    ET_SECRET_KEY=... locust -f load_testing/locustfile.py --headless \
        -H http://localhost -u 500 -r 50 -t 2m
"""

import os
import random
from datetime import UTC, date, datetime, timedelta
from itertools import count

from jose import jwt
from locust import FastHttpUser, between, task

SECRET_KEY = os.environ["ET_SECRET_KEY"]
ALGORITHM = os.environ.get("ET_ALGORITHM", "HS256")
N_SEEDED = int(os.environ.get("LOADTEST_USERS", "10000"))

_user_seq = count(1)


def month_range() -> tuple[str, str]:
    today = date.today()
    start = today.replace(day=1)
    nxt = (start + timedelta(days=32)).replace(day=1) - timedelta(days=1)
    return start.isoformat(), nxt.isoformat()


class CitrineUser(FastHttpUser):
    # Реальный пользователь кликает раз в несколько секунд, а не молотит API.
    wait_time = between(3, 8)

    def on_start(self) -> None:
        idx = (next(_user_seq) - 1) % N_SEEDED + 1
        email = f"loadtest_{idx}@loadtest.dev"
        token = jwt.encode(
            {
                "sub": email,
                "role": "user",
                "exp": datetime.now(UTC) + timedelta(hours=2),
            },
            SECRET_KEY,
            algorithm=ALGORITHM,
        )
        self.client.cookiejar.clear()
        self.cookie_header = f"access_token={token}"
        self.start_d, self.end_d = month_range()

        # Категории пользователя — для создания транзакций.
        res = self.client.get(
            "/api/v1/users/categories",
            headers={"Cookie": self.cookie_header},
            name="/v1/users/categories",
        )
        cats = res.json() if res.status_code == 200 else []
        self.expense_ids = [c["id"] for c in cats if c.get("type") == "expense"] or [1]

    @task(8)
    def view_dashboard(self) -> None:
        self.client.get(
            f"/api/v1/dashboard/?start_date={self.start_d}&end_date={self.end_d}",
            headers={"Cookie": self.cookie_header},
            name="/v1/dashboard",
        )

    @task(4)
    def list_transactions(self) -> None:
        self.client.get(
            "/api/v1/transactions/?limit=20",
            headers={"Cookie": self.cookie_header},
            name="/v1/transactions [GET]",
        )

    @task(3)
    def health_score(self) -> None:
        self.client.get(
            "/api/v1/health-score/",
            headers={"Cookie": self.cookie_header},
            name="/v1/health-score",
        )

    @task(2)
    def add_transaction(self) -> None:
        self.client.post(
            "/api/v1/transactions/",
            json={
                "amount": round(random.uniform(100.0, 5000.0), 2),
                "category_id": random.choice(self.expense_ids),
                "entry_type": "manual",
                "comment": "Locust Load Test",
            },
            headers={"Cookie": self.cookie_header},
            name="/v1/transactions [POST]",
        )

    @task(1)
    def latest_insight(self) -> None:
        self.client.get(
            "/api/v1/insights/latest",
            headers={"Cookie": self.cookie_header},
            name="/v1/insights/latest",
        )
