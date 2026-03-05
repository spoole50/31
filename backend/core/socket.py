"""
Shared Socket.IO server instance.

Imported by both main.py (for mounting) and socket_handlers.py (for event registration).
Using AsyncServer so all handlers can be async-native.
"""

import socketio

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
    # Ping every 25s, disconnect after 60s of silence — much faster than the
    # old 65-second inactivity poll. The client will auto-reconnect on drop.
    ping_interval=25,
    ping_timeout=60,
)
