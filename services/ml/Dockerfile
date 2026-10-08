# model-service/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY . .

# Expose the port FastAPI runs on
EXPOSE 8000

# Start the server (0.0.0.0 allows external container access)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]