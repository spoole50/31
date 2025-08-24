"""
31 Card Game Backend Application

A Flask-based REST API for the 31 card game with AI opponents.
Supports multiple players, different AI difficulty levels, and real-time gameplay.
"""

from flask import Flask
from flask_cors import CORS

from api.routes import game_routes


def create_app():
    """Application factory pattern for Flask app"""
    app = Flask(__name__)
    
    # Configure CORS for frontend communication
    CORS(app, origins=["http://localhost:3000", "http://127.0.0.1:3000"])
    
    # Register blueprints
    app.register_blueprint(game_routes)
    
    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=8000, debug=True)
