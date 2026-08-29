# Dockerfile - BEST SOLUTION
# Uses official Python-Node.js image from Docker Hub
FROM nikolaik/python-nodejs:python3.9-nodejs18

WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY waf_server.py .
COPY solve_waf.js .

# Create non-root user for security
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8080

CMD ["python", "waf_server.py"]
