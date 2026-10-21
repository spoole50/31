"""
Shared runtime configuration.

Imported by main.py (FastAPI CORS middleware) and core/socket.py (Socket.IO
CORS) so both layers agree on which origins may talk to this backend.
"""

import os

# Localhost dev origins are always permitted so `npm run dev` works with no
# configuration. Production origins come from the ALLOWED_ORIGINS env var as a
# comma-separated list, e.g.
#   ALLOWED_ORIGINS=https://31.spoole.dev,https://main.d123.amplifyapp.com
_DEV_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]

ALLOWED_ORIGINS = _DEV_ORIGINS + [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
