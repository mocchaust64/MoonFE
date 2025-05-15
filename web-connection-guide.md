# Kết nối từ ứng dụng web đến validator Solana không hỗ trợ CORS

## Giải pháp 1: Sử dụng CORS Proxy

1. **Chạy CORS proxy** (đã cài đặt ở file cors-proxy.js):
   ```bash
   node cors-proxy.js
   ```
   
   Proxy này sẽ chạy tại cổng 8090 và tự động thêm CORS headers cho tất cả các request.

2. **Kết nối trong ứng dụng web**:
   ```javascript
   import { Connection } from '@solana/web3.js';

   // Thay vì kết nối trực tiếp đến validator
   // const connection = new Connection('http://192.168.1.11:8899');
   
   // Kết nối thông qua proxy
   const connection = new Connection('http://192.168.1.11:8090', {
     wsEndpoint: 'ws://192.168.1.11:8090',
     commitment: 'confirmed',
   });
   ```

## Giải pháp 2: Sử dụng ngrok với tùy chỉnh header

Ngrok có thể thiết lập để tự động thêm CORS headers cho tất cả phản hồi:

1. **Cập nhật file ngrok.yml** để thêm headers vào tất cả phản hồi:

```yaml
version: "2"
authtoken: YOUR_NGROK_AUTH_TOKEN
tunnels:
  rpc:
    addr: 8899
    proto: http
    schemes: [https]
    host_header: localhost:8899
    domain: coyote-needed-blowfish.ngrok-free.app
    response_headers:
      Access-Control-Allow-Origin: "*"
      Access-Control-Allow-Methods: "GET, POST, OPTIONS"
      Access-Control-Allow-Headers: "Content-Type, Authorization"
  websocket:
    addr: 8900
    proto: http
    schemes: [https]
    host_header: localhost:8900
    domain: 5584-113-22-202-13.ngrok-free.app
    response_headers:
      Access-Control-Allow-Origin: "*"
      Access-Control-Allow-Methods: "GET, POST, OPTIONS"
      Access-Control-Allow-Headers: "Content-Type, Authorization"
  web:
    addr: 3000
    proto: http
    schemes: [https]
    host_header: localhost:3000
    domain: c83c-113-22-202-13.ngrok-free.app
    response_headers:
      Access-Control-Allow-Origin: "*"
      Access-Control-Allow-Methods: "GET, POST, OPTIONS"
      Access-Control-Allow-Headers: "Content-Type, Authorization"
```

2. **Kết nối trong ứng dụng web**:
```javascript
import { Connection } from '@solana/web3.js';

// Kết nối trực tiếp qua ngrok với CORS headers
const connection = new Connection('https://coyote-needed-blowfish.ngrok-free.app', {
  wsEndpoint: 'wss://5584-113-22-202-13.ngrok-free.app',
  commitment: 'confirmed',
});
```

## Giải pháp 3: Sử dụng backend làm cầu nối

Nếu ứng dụng của bạn có backend:

1. **Tạo API endpoints trên backend** để gọi đến validator
2. **Frontend gọi đến backend API** thay vì gọi trực tiếp đến validator
3. **Backend xử lý gọi RPC** đến validator và trả kết quả về cho frontend

Ví dụ endpoint trên backend (Node.js):
```javascript
app.post('/api/solana/rpc', async (req, res) => {
  try {
    const rpcMethod = req.body.method;
    const rpcParams = req.body.params || [];
    
    const response = await fetch('https://coyote-needed-blowfish.ngrok-free.app', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: rpcMethod,
        params: rpcParams
      })
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint cho WebSocket
const wss = new WebSocket.Server({ server });
wss.on('connection', (ws) => {
  const clientWs = new WebSocket('wss://5584-113-22-202-13.ngrok-free.app');
  
  clientWs.on('message', (data) => {
    ws.send(data);
  });
  
  ws.on('message', (data) => {
    clientWs.send(data);
  });
});
```

## Giải pháp 4: Cập nhật phiên bản Solana CLI

Xem xét cập nhật Solana CLI lên phiên bản mới nhất, có thể hỗ trợ tùy chọn `--rpc-cors`:

```bash
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
```

## Giải pháp 5: Sử dụng CORS extension trong trình duyệt

Trong môi trường phát triển, bạn có thể cài đặt extension như "CORS Unblock" hoặc "Allow CORS" trong trình duyệt để tạm thời bỏ qua hạn chế CORS.

## Lưu ý:

- Proxy CORS chỉ nên được sử dụng trong môi trường phát triển
- Trong môi trường production, nên cấu hình CORS đúng cách hoặc sử dụng backend làm trung gian
- Ngrok có thể thiết lập CORS headers nhưng cần gói trả phí để cấu hình đầy đủ
- Tùy chọn `--rpc-cors` có thể có trong phiên bản Solana CLI mới hơn 

## Các địa chỉ ngrok hiện tại:

- Web app: https://c83c-113-22-202-13.ngrok-free.app -> http://localhost:3000
- WebSocket: https://5584-113-22-202-13.ngrok-free.app -> http://localhost:8900
- RPC: https://coyote-needed-blowfish.ngrok-free.app -> http://localhost:8899 