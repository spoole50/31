"""
31 Card Game Backend Application

A Flask-based REST API for the 31 card game with AI opponents.
Supports multiple players, different AI difficulty levels, and real-time gameplay.
"""

import os
import threading
import time
from flask import Flask, request, make_response
from flask_cors import CORS

from api.routes import game_routes
from api.table_routes import table_routes
from table_logic import table_manager


def disconnect_checker():
    """Background task to check for disconnected players"""
    while True:
        try:
            # Check every 5 seconds for more responsive timeout handling
            time.sleep(5)
            
            # Check for disconnected players and turn timeouts (45 second timeout)
            disconnected_log = table_manager.check_all_tables_for_disconnects(timeout_seconds=45)
            
            if disconnected_log:
                print("Timeout/Disconnect events:")
                for log_entry in disconnected_log:
                    print(f"  - {log_entry}")
                    
        except Exception as e:
            print(f"Error in disconnect checker: {e}")


def create_app():
    """Application factory pattern for Flask app"""
    app = Flask(__name__)
    
    # Configure CORS for frontend communication
    # Allow localhost for development
    allowed_origins = [
        "http://localhost:3000", 
        "http://127.0.0.1:3000",
    ]
    
    # Add production frontend URL from environment variable
    frontend_url = os.environ.get('FRONTEND_URL')
    if frontend_url:
        allowed_origins.append(frontend_url)
    
    # For Render deployment, allow the expected frontend URL
    if os.environ.get('RENDER'):
        allowed_origins.append("https://card-game-31-frontend.onrender.com")
    
    # Configure CORS for frontend communication
    # Temporarily allow all origins for debugging
    print(f"CORS allowed origins: {allowed_origins}")  # Debug logging
    
    # More permissive CORS for debugging
    CORS(app, 
         origins="*",  # Temporarily allow all origins
         methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
         allow_headers=['Content-Type', 'Authorization', 'X-Requested-With'],
         supports_credentials=False)  # Can't use credentials with wildcard origin
    
    # Register blueprints
    app.register_blueprint(game_routes)
    app.register_blueprint(table_routes)
    
    # Start background disconnect checker
    disconnect_thread = threading.Thread(target=disconnect_checker, daemon=True)
    disconnect_thread.start()
    print("Background disconnect checker started")
    
    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=8000, debug=True)
