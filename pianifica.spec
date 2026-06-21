# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec for Pianifica.

Build:  pyinstaller pianifica.spec
Output: dist/pianifica.exe
"""

from PyInstaller.utils.hooks import collect_all, collect_data_files, collect_submodules

block_cipher = None

# ── Collect everything from the heavyweight packages ───────────────────────
_uvicorn_d,   _uvicorn_b,   _uvicorn_h   = collect_all("uvicorn")
_starlette_d, _starlette_b, _starlette_h = collect_all("starlette")
_fastapi_d,   _fastapi_b,   _fastapi_h   = collect_all("fastapi")
_sqlalchemy_d,_sqlalchemy_b,_sqlalchemy_h = collect_all("sqlalchemy")
_h11_d,       _h11_b,       _h11_h       = collect_all("h11")
_httptools_d, _httptools_b, _httptools_h  = collect_all("httptools")
_multipart_d, _multipart_b, _multipart_h = collect_all("multipart")
_dotenv_d,    _dotenv_b,    _dotenv_h    = collect_all("dotenv")

a = Analysis(
    ["run.py"],
    pathex=[],
    binaries=(
        _uvicorn_b + _starlette_b + _fastapi_b + _sqlalchemy_b
        + _h11_b + _httptools_b + _multipart_b + _dotenv_b
    ),
    datas=[
        # Bundle the pre-built React frontend
        ("frontend/dist", "frontend/dist"),
        *_uvicorn_d, *_starlette_d, *_fastapi_d, *_sqlalchemy_d,
        *_h11_d, *_httptools_d, *_multipart_d, *_dotenv_d,
    ],
    hiddenimports=[
        # SQLAlchemy SQLite dialect
        "sqlalchemy.dialects.sqlite",
        "sqlalchemy.dialects.sqlite.base",
        "sqlalchemy.dialects.sqlite.pysqlite",
        # JOSE / cryptography
        "jose",
        "jose.jws",
        "jose.jwt",
        "jose.backends",
        "jose.backends.cryptography_backend",
        "cryptography",
        "cryptography.hazmat.primitives.asymmetric",
        "cryptography.hazmat.backends.openssl",
        # Argon2
        "argon2",
        "argon2._utils",
        "argon2.low_level",
        "argon2.profiles",
        # python-dotenv
        "dotenv",
        # Uvicorn internals
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.loops.asyncio",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.http.h11_impl",
        "uvicorn.protocols.http.httptools_impl",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
        "uvicorn.lifespan.off",
        # Email (used internally by some starlette dependencies)
        "email.mime.multipart",
        "email.mime.text",
        *_uvicorn_h, *_starlette_h, *_fastapi_h, *_sqlalchemy_h,
        *_h11_h, *_httptools_h, *_multipart_h, *_dotenv_h,
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Exclude heavy unused packages to keep exe size down
        "tkinter", "matplotlib", "numpy", "pandas",
        "PIL", "cv2", "scipy", "IPython",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="pianifica",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,          # UPX disabled for reliability
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,       # Console window shows startup message and log
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)
