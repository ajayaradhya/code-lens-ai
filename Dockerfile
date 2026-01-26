# --- STAGE 1: Build the Frontend ---
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend

# Install dependencies first to leverage Docker cache
COPY frontend/package*.json ./
RUN npm install

# Copy source and build
COPY frontend/ ./
# Note: Ensure your tsconfig.json has "noUnusedLocals": false 
# or use "npm run build" if you've updated the script to skip type-check
RUN ls -la src/ && ls -la src/lib/
RUN npm run build

# --- STAGE 2: Build the Backend & Final Image ---
FROM python:3.11-slim
WORKDIR /app

# 1. Install system dependencies
# git: Required for RepoIngestor to clone repositories
# build-essential: Required for compiling certain Python packages (like ChromaDB dependencies)
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

# 2. Copy backend requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 3. Copy backend source code
COPY backend/ ./backend

# 4. Copy the built frontend from Stage 1 into the backend's static folder
# This allows FastAPI to serve the React app
COPY --from=frontend-build /app/frontend/dist ./backend/static/

# 5. Set Environment Variables
# PORT: Used by Render/Railway
# PYTHONUNBUFFERED: Ensures logs are sent straight to the terminal
# PYTHONPATH: Ensures 'src' is discoverable by app.py
ENV PORT=8000
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app/backend

# Expose the port
EXPOSE 8000

# 6. Start the application
# We point to backend.app (the file app.py) and the FastAPI instance 'app'
CMD ["python", "-m", "uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000"]