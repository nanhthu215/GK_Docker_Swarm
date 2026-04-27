// =============================================================================
// Lab 2: Load Balancing Demo – Node.js API trả về Hostname
// =============================================================================
// Mục đích:
//   Chứng minh Docker Swarm Ingress Routing Mesh phân phối request
//   qua các container khác nhau bằng cách trả về hostname của container.
//
// API Endpoints:
//   GET /          → Thông tin container (hostname, IP, timestamp)
//   GET /health    → Health check
//   GET /info      → Thông tin chi tiết hơn
// =============================================================================

const http = require("http");
const os = require("os");

const PORT = process.env.PORT || 3000;

// Lấy địa chỉ IP nội bộ của container
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Bỏ qua loopback và IPv6
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "unknown";
}

// Counter đếm số request mỗi container nhận được
let requestCount = 0;
const startTime = new Date().toISOString();

const server = http.createServer((req, res) => {
  requestCount++;

  const hostname = os.hostname(); // ID của container (12 ký tự đầu của Container ID)
  const ip = getLocalIP();
  const timestamp = new Date().toISOString();

  // ── Route: GET / ─────────────────────────────────────────────────────────
  if (req.url === "/" || req.url === "") {
    const response = {
      // ← Đây là thông tin quan trọng nhất để chứng minh load balancing!
      hostname: hostname,
      container_ip: ip,
      timestamp: timestamp,
      request_count: requestCount,
      message: `Hello from container: ${hostname}`,
    };

    res.writeHead(200, {
      "Content-Type": "application/json",
      // Header này giúp xem container nào xử lý request
      "X-Container-Hostname": hostname,
      "X-Container-IP": ip,
    });
    res.end(JSON.stringify(response, null, 2));
    console.log(`[${timestamp}] GET / → Container: ${hostname} (IP: ${ip}) | Total requests: ${requestCount}`);
  }

  // ── Route: GET /health ────────────────────────────────────────────────────
  else if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "healthy", hostname }));
  }

  // ── Route: GET /info ──────────────────────────────────────────────────────
  else if (req.url === "/info") {
    const info = {
      hostname: hostname,
      container_ip: ip,
      platform: os.platform(),
      arch: os.arch(),
      node_version: process.version,
      uptime_seconds: Math.floor(process.uptime()),
      started_at: startTime,
      total_requests: requestCount,
      memory_usage_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(info, null, 2));
  }

  // ── 404 ───────────────────────────────────────────────────────────────────
  else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found", path: req.url }));
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📦 Container Hostname: ${os.hostname()}`);
  console.log(`🌐 Container IP: ${getLocalIP()}`);
  console.log(`⏰ Started at: ${startTime}`);
});
