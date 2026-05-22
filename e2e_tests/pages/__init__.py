"""
pages/__init__.py — Page Object Model (POM) package.

This package houses Page Object classes for the Citrine Vault application.
Each class encapsulates the locators and actions of a single page/component,
keeping test logic clean and readable.

Structure (добавляй по мере роста тест-сьюта):

    pages/
    ├── __init__.py          ← this file
    ├── login_page.py        ← LoginPage POM (create when tests grow)
    ├── dashboard_page.py    ← DashboardPage POM
    └── register_page.py     ← RegisterPage POM
"""
