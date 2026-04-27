# =============================================================================
# Dockerfile – Load Balancing Demo App (Node.js)
# =============================================================================
# Build image: docker build -t swarm-lb-demo:1.0 .
# Run locally:  docker run -p 3000:3000 swarm-lb-demo:1.0
# =============================================================================

# Dùng Node.js 18 Alpine (nhỏ gọn, bảo mật)
FROM node:18-alpine

# Thông tin metadata
LABEL maintainer="Docker Swarm Lab"
LABEL description="Load Balancing Demo – trả về hostname của container"
LABEL version="1.0"

# Tạo thư mục làm việc trong container
WORKDIR /app

# Copy package.json trước (tận dụng Docker layer cache)
COPY package.json ./

# Cài dependencies (không có dev dependencies)
RUN npm install --only=production

# Copy source code
COPY server.js ./

# Khai báo port ứng dụng lắng nghe
EXPOSE 3000

# Health check: kiểm tra server còn sống mỗi 30 giây
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Chạy app với user non-root (bảo mật)
USER node

# Lệnh khởi động
CMD ["node", "server.js"]
