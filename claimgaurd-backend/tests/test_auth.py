from __future__ import annotations

"""
Authentication and RBAC tests — runs against the live server on port 8000.

Requires the backend to be running: uvicorn app.main:app --port 8000
If the server is not running, tests are skipped.
"""

import uuid
import pytest
import requests

BASE = "http://127.0.0.1:8000"


def _check_server():
    try:
        r = requests.get(f"{BASE}/health", timeout=2)
        return r.status_code == 200
    except Exception:
        return False


@pytest.fixture(scope="session", autouse=True)
def require_server():
    if not _check_server():
        pytest.skip("Backend server not running on port 8000 — start with uvicorn")


def _register(uname, password="Test123!", role="viewer"):
    requests.post(f"{BASE}/api/auth/register", json={
        "username": uname, "full_name": "Test User",
        "password": password, "role": role,
    })


def _login(uname, password="Test123!"):
    r = requests.post(f"{BASE}/api/auth/login",
                      data={"username": uname, "password": password})
    if r.status_code == 200:
        return r.json()["access_token"]
    return None


def _uid():
    return uuid.uuid4().hex[:8]


class TestRegistrationAndLogin:

    def test_register_creates_user(self):
        uname = f"newuser_{_uid()}"
        r = requests.post(f"{BASE}/api/auth/register", json={
            "username": uname, "full_name": "New User",
            "password": "Password123!", "role": "viewer",
        })
        assert r.status_code == 201
        assert r.json()["role"] == "viewer"
        assert r.json()["is_active"] is True

    def test_duplicate_username_returns_409(self):
        uname = f"dup_{_uid()}"
        requests.post(f"{BASE}/api/auth/register", json={
            "username": uname, "full_name": "Dup",
            "password": "Password123!", "role": "viewer",
        })
        r2 = requests.post(f"{BASE}/api/auth/register", json={
            "username": uname, "full_name": "Dup2",
            "password": "Password123!", "role": "viewer",
        })
        assert r2.status_code == 409

    def test_login_returns_token(self):
        uname = f"login_{_uid()}"
        _register(uname, "Login123!")
        r = requests.post(f"{BASE}/api/auth/login",
                          data={"username": uname, "password": "Login123!"})
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_wrong_password_returns_401(self):
        uname = f"badpass_{_uid()}"
        _register(uname, "Correct123!")
        r = requests.post(f"{BASE}/api/auth/login",
                          data={"username": uname, "password": "WrongPass!"})
        assert r.status_code == 401

    def test_me_returns_current_user(self):
        uname = f"me_{_uid()}"
        _register(uname, "MeTest1234!", "admin")
        token = _login(uname, "MeTest1234!")
        assert token, f"Login failed for {uname}"
        r = requests.get(f"{BASE}/api/auth/me",
                         headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert r.json()["username"] == uname

    def test_unauthenticated_returns_401(self):
        r = requests.get(f"{BASE}/api/auth/me")
        assert r.status_code == 401


class TestRBAC:

    def test_health_is_public(self):
        r = requests.get(f"{BASE}/health")
        assert r.status_code == 200

    def test_ml_overview_requires_auth(self):
        r = requests.get(f"{BASE}/api/ml/overview")
        assert r.status_code == 401

    def test_ml_retrain_requires_ml_admin_role(self):
        uname = f"viewer_{_uid()}"
        _register(uname, "View123!", "viewer")
        token = _login(uname, "View123!")
        assert token
        r = requests.post(f"{BASE}/api/ml/retrain",
                          headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 403

    def test_admin_can_list_users(self):
        uname = f"admin_{_uid()}"
        _register(uname, "Admin123!", "admin")
        token = _login(uname, "Admin123!")
        assert token
        r = requests.get(f"{BASE}/api/users",
                         headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_viewer_cannot_list_users(self):
        uname = f"viewer2_{_uid()}"
        _register(uname, "View123!", "viewer")
        token = _login(uname, "View123!")
        assert token
        r = requests.get(f"{BASE}/api/users",
                         headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 403
