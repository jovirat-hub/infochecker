# Check if Node.js is installed
docker exec -it waf-solver node --version

# Check if npm is installed
docker exec -it waf-solver npm --version

# Check the path
docker exec -it waf-solver which node
