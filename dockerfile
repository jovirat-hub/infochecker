# Dockerfile for WAF server
FROM python:3.9-slim

RUN apt-get update && apt-get install -y nodejs npm && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY waf_server.py .
RUN pip install flask flask-cors

EXPOSE 5001
CMD ["python", "waf_server.py"]
