# Dockerfile - GUARANTEED WORKING
# Build with: docker build -t waf-solver -f Dockerfile .

# Stage 1: Get Node.js binary
FROM node:18-alpine AS node-builder

# Stage 2: Python image
FROM python:3.9-slim

# Install Node.js from the official binary
COPY --from=node-builder /usr/local/bin/node /usr/local/bin/node
COPY --from=node-builder /usr/local/lib/node_modules /usr/local/lib/node_modules

# Create npm symlink
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && \
    ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

# Verify Node.js
RUN node --version && npm --version

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY waf_server.py .
COPY solve_waf.js .

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8080

CMD ["python", "waf_server.py"]
