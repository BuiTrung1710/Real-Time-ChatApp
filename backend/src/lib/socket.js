import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);

//Cấu hình CORS đảm bảo rằng chỉ có client từ địa chỉ http://localhost:5174 mới có thể kết nối đến server Socket.IO
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5174"],
  },
  pingTimeout: 60000, // Thời gian trước khi ngắt kết nối socket nếu không nhận được phản hồi
});

const userSocketMap = {}; // {userId: socketId}

//là hàm định nghĩa để truy xuất value:socketId thông qua key:userId trong userSocketMap
export function getReceiverSocketId(userId) {
  //VD: userId = "123" => userSocketMap["123"] = "socket123"
  //=> trả về socketId = "socket123"
  return userSocketMap[userId];
}

// Hàm để in thông tin hiện tại của userSocketMap để debug
function logConnectedUsers() {
  console.log("Connected users:", Object.keys(userSocketMap).length);
  console.log("User-Socket map:", userSocketMap);
}

//Đây là sự kiện connect trong Socket.IO,SOCKET.IO sẽ tạo ra một đối tượng socket đại diện cho kết nối đó.
//Là một đối tượng đại diện cho kết nối giữa client và server.
//Mỗi client kết nối sẽ có một đối tượng socket riêng biệt.
io.on("connection", (socket) => {
  //socket.id là một socketId duy nhất được tạo ra cho mỗi client khi kết nối đến server
  console.log("A user connected", socket.id);
  
  //socket.handshake.query là nơi chứa các tham số mà client gửi trong URL query string khi kết nối đến server
  //VD: http://localhost:5174?userId=123 => socket.handshake.query.userId = "123"
  const userId = socket.handshake.query.userId;
  
  //Nếu userId tồn tại (tức là client đã gửi tham số userId khi kết nối) thì thêm vào userSocketMap với key là userId và value là socketId
  //VD: userId = "123" => userSocketMap["123"] = "socket123"
  if (userId) {
    userSocketMap[userId] = socket.id;
    console.log(`User ${userId} connected with socket ${socket.id}`);
    logConnectedUsers();
  }

  // io.emit() is used to send events to all the connected clients
  //Sau khi thêm userId và socketId vào userSocketMap thì sẽ gửi thông tin đến tất cả các client (thông qua sự kiện getOnlineUsers ) đang kết nối đến server
  //Object.keys(userSocketMap) sẽ trả về một mảng các key của đối tượng userSocketMap, tức là các userId đang online
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // Xử lý khi client ngắt kết nối
  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.id);
    
    // Tìm và xóa userId từ userSocketMap
    if (userId) {
      console.log(`User ${userId} disconnected`);
      delete userSocketMap[userId];
      // Cập nhật danh sách người dùng trực tuyến cho tất cả client
      io.emit("getOnlineUsers", Object.keys(userSocketMap));
      logConnectedUsers();
    }
  });

  // Xử lý các sự kiện lỗi
  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });

  // Xử lý ping/pong để đảm bảo kết nối được duy trì
  socket.on("ping", () => {
    socket.emit("pong");
  });
});

export { io, app, server };
