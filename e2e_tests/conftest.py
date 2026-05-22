"""
conftest.py — Shared Pytest Fixtures for E2E Suite.

Scope:    e2e_tests/ (applies to all tests in this service)
Purpose:  Configure base_url, browser options, and shared page utilities.
"""

import pytest
from playwright.sync_api import Page, BrowserContext


# ── Base URL ────────────────────────────────────────────────────────────────
BASE_URL = "http://localhost:5173"


@pytest.fixture(scope="session")
def browser_context_args(browser_context_args: dict) -> dict:
    """
    Inject global browser context options for every test session.

    - Sets viewport to Full HD for consistent layout rendering.
    - Disables animations via CSS media query (prefers-reduced-motion)
      to avoid flaky waits on Framer Motion transitions.
    - Injects locale for deterministic date/time formatting.
    """
    return {
        **browser_context_args,
        "viewport": {"width": 1280, "height": 720},
        "locale": "ru-RU",
        "reduced_motion": "reduce",   # Disables Framer Motion animations → no flakiness
        "base_url": BASE_URL,
    }


@pytest.fixture
def login_page(page: Page) -> Page:
    """
    Pre-navigate to the login page.
    Use this fixture instead of bare `page` when your test starts at /login.

    Usage:
        def test_something(login_page: Page) -> None:
            login_page.get_by_placeholder("Email").fill("user@example.com")
    """
    page.goto("/login")
    page.wait_for_load_state("networkidle")
    return page
