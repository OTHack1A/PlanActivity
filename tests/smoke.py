"""
Dependency-free smoke tests for Pianifica.

Run from the repo root:
    .venv\\Scripts\\python.exe -m tests.smoke

No pytest/httpx required. Covers the pure (non-HTTP) units:
- password policy validation (registration schema)
- Argon2id hash/verify roundtrip
- master/emergency account constant-time check
- automatic database backup + pruning

End-to-end HTTP flows (register/login/rate-limit) are exercised separately
against a live dev server (see the release test run).
"""
import sqlite3
import tempfile
from pathlib import Path

from pydantic import ValidationError

from backend import schemas
from backend import auth  # module import so we can inject a test master hash
from backend.auth import hash_password, verify_password, is_master_login
from backend._backup import backup_database, DEFAULT_KEEP
from backend.logging_config import setup_logging

_passed = 0
_failed = 0


def check(name: str, cond: bool) -> None:
    global _passed, _failed
    if cond:
        _passed += 1
        print(f"  PASS  {name}")
    else:
        _failed += 1
        print(f"  FAIL  {name}")


def test_password_policy():
    print("[password policy]")
    check("min length constant is 8", schemas.MIN_PASSWORD_LENGTH == 8)

    too_short = False
    try:
        schemas.RegisterIn(user="alice", password="1234567", company="Acme")  # 7 chars
    except ValidationError:
        too_short = True
    check("7-char password rejected at registration", too_short)

    ok = False
    try:
        schemas.RegisterIn(user="alice", password="12345678", company="Acme")  # 8 chars
        ok = True
    except ValidationError:
        ok = False
    check("8-char password accepted at registration", ok)

    # Login schema must NOT enforce a minimum (legacy/master accounts may have
    # shorter passwords). Use an arbitrary 6-char value — NOT a real password.
    login_ok = False
    try:
        schemas.LoginIn(user="someone", password="abc123")  # 6 chars, arbitrary
        login_ok = True
    except ValidationError:
        login_ok = False
    check("short password accepted by LoginIn (no min)", login_ok)


def test_hashing():
    print("[argon2 hashing]")
    h = hash_password("correct horse battery")
    check("hash is argon2id", h.startswith("$argon2id$"))
    check("correct password verifies", verify_password("correct horse battery", h) is True)
    check("wrong password rejected", verify_password("wrong", h) is False)
    check("garbage hash rejected (no crash)", verify_password("x", "not-a-hash") is False)


def test_master():
    print("[master account]")
    # Inject a throwaway hash so the real master password never appears in tests.
    # is_master_login() reads module-level auth._MASTER_HASH at call time.
    test_pw = "smoke-test-master-pw"
    original = auth._MASTER_HASH
    auth._MASTER_HASH = hash_password(test_pw)
    try:
        check("correct master creds accepted", is_master_login("Melo", test_pw) is True)
        check("master username case-insensitive", is_master_login("melo", test_pw) is True)
        check("wrong master password rejected", is_master_login("Melo", "wrong") is False)
        check("wrong master username rejected", is_master_login("admin", test_pw) is False)
        # The default embedded master hash must be a valid Argon2id string.
        check("default master hash is argon2id", original.startswith("$argon2id$"))
    finally:
        auth._MASTER_HASH = original  # restore for any later tests


def test_backup():
    print("[database backup]")
    with tempfile.TemporaryDirectory() as tmp:
        db = Path(tmp) / "pianifica.db"
        conn = sqlite3.connect(str(db))
        conn.execute("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)")
        conn.execute("INSERT INTO t (v) VALUES ('hello')")
        conn.commit()
        conn.close()

        dest = backup_database(db, keep=DEFAULT_KEEP)
        check("backup file created", dest is not None and dest.exists())

        # backup is a valid, readable copy with the same data
        if dest:
            c = sqlite3.connect(str(dest))
            row = c.execute("SELECT v FROM t").fetchone()
            c.close()
            check("backup contains original data", row is not None and row[0] == "hello")

        # missing DB → no crash, returns None
        missing = backup_database(Path(tmp) / "nope.db")
        check("missing DB handled gracefully", missing is None)

        # pruning: create 15 backups with keep=5 → only 5 remain
        backups_dir = db.parent / "backups"
        for f in backups_dir.glob("pianifica-*.db"):
            f.unlink()
        for i in range(15):
            (backups_dir / f"pianifica-200001{i:02d}-000000.db").write_text("x")
        backup_database(db, keep=5)  # creates 1 more, then prunes to 5
        remaining = list(backups_dir.glob("pianifica-*.db"))
        check("pruning keeps exactly `keep` backups", len(remaining) == 5)


def main() -> int:
    setup_logging()
    print("=== Pianifica smoke tests ===")
    test_password_policy()
    test_hashing()
    test_master()
    test_backup()
    print(f"\n=== {_passed} passed, {_failed} failed ===")
    return 1 if _failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
