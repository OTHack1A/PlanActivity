"""
Generate an Argon2id hash for the emergency master password.

Usage (from the repo root, with the venv active):

    python scripts/gen_master_hash.py "my new strong password"

The printed hash is one-way (the password cannot be recovered from it). Put it in
either the PIANIFICA_MASTER_HASH environment variable or a `data/.master_hash`
file to rotate the master password without rebuilding the executable. The clear
password is never stored — only this hash.
"""
import sys
from pathlib import Path

# Allow running the script directly (python scripts/gen_master_hash.py ...) by
# putting the repo root on sys.path so the `backend` package is importable.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Reuse the exact same Argon2id parameters the app uses, so a hash produced here
# verifies correctly at login.
from backend.auth import hash_password  # noqa: E402  (import after sys.path tweak)


def main(argv: list[str]) -> int:
    if len(argv) != 2 or not argv[1]:
        print('Usage: python scripts/gen_master_hash.py "<new password>"', file=sys.stderr)
        return 2
    # Print only the hash so it can be piped/redirected straight into a file.
    print(hash_password(argv[1]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
