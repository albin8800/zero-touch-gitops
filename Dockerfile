# ==========================================                                                                                                                                                                                          
# Stage 1: Build / Dependency Stage                                                                                                                                                                                                   
# ==========================================                                                                                                                                                                                          
FROM node:24-alpine AS builder

# Set working directory inside container
WORKDIR /usr/src/app

# Copy package manifests first to leverage Docker layer caching
COPY package*.json ./

# Install production dependencies only, ignoring local developer hooks                                                                                                                                                                
RUN npm ci --omit=dev --ignore-scripts && mkdir -p node_modules && npm cache clean --force

# ==========================================                                                                                                                                                                                          
# Stage 2: Hardened Runtime Stage (The Vault)                                                                                                                                                                                         
# ==========================================                                                                                                                                                                                          
FROM node:24-alpine AS runner                                                                                                                                                                                                         
                                                                                                                                                                                                                                      
# Environmental security hardening                                                                                                                                                                                                    
ENV NODE_ENV=production
ENV PORT=3000                                                                                                                                                                                                                         
                                                                                                                                                                                                                                      
WORKDIR /usr/src/app                                                                                                                                                                                                                  

# Copy production node_modules from builder stage
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Copy application source code
COPY package*.json ./
COPY src/ ./src/
                                                                                                                                                                                                                                      
# Security: Change ownership of working directory to built-in non-root user 'node'                                                                                                                                                    
RUN chown -R node:node /usr/src/app                                                                                                                                                                                                   

# Security: Drop root privileges; run as unprivileged user (UID 1000)
USER node

# Expose microservice port
EXPOSE 3000

# Container entrypoint
CMD ["node", "src/server.js"]
