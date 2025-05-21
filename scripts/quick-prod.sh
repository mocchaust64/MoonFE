#!/bin/bash

# Tìm các process đang sử dụng cổng 3000
echo "Đang tìm process đang sử dụng cổng 3000..."
PORT_3000_PID=$(lsof -ti:3000)

# Nếu có process nào đang sử dụng cổng 3000, kill nó
if [ -n "$PORT_3000_PID" ]; then
  echo "Đang tắt process với PID: $PORT_3000_PID"
  kill -9 $PORT_3000_PID
  echo "Đã tắt process cũ"
else
  echo "Không tìm thấy process nào đang sử dụng cổng 3000"
fi

# Build và chạy ứng dụng
echo "Đang build ứng dụng..."
npm run build

echo "Đang khởi động ứng dụng ở chế độ production trên cổng 3000..."
npm run start 