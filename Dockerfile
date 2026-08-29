FROM python:3.10-slim

# Install Node.js for running solve_waf.js
RUN apt-get update && apt-get install -y curl \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY waf_server.py .
COPY solve_waf.js .

EXPOSE 8080

CMD ["python", "waf_server.py"]
