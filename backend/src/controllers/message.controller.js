import User from "../models/user.model.js";
import Message from "../models/message.model.js";

import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({
      _id: { $ne: loggedInUserId },
    }).select("-password");

    res.status(200).json(filteredUsers);
  } catch (error) {
    console.error("Error in getUsersForSidebar: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    });

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    //lấy text và images từ body
    const { text, images } = req.body;
    //lấy id của người nhận từ params của route (ví dụ: /api/messages/:id)
    const { id: receiverId } = req.params;
    //lấy id của người gửi từ req.user (đã được xác thực trước đó) (middleware auth)
    const senderId = req.user._id;

    let imageUrls = [];
    
    // Xử lý upload ảnh - giờ chỉ xử lý 1 ảnh mỗi lần
    if (images && Array.isArray(images) && images.length > 0) {
      try {
        // Chỉ lấy ảnh đầu tiên trong mảng (vì frontend đã tách từng ảnh để gửi)
        const imageToUpload = images[0];
        
        // Upload ảnh lên Cloudinary
        const uploadResponse = await cloudinary.uploader.upload(imageToUpload, {
          folder: "chat_images",
          resource_type: "image",
          timeout: 30000, // Tăng timeout lên 30s
          quality: "auto", // Tự động tối ưu chất lượng
          fetch_format: "auto", // Tự động chọn định dạng tốt nhất
          transformation: [
            { width: 1200, height: 1200, crop: "limit" }, // Giới hạn kích thước tối đa
            { quality: "auto:good" } // Tự động chọn chất lượng tốt
          ]
        });
        
        // Lấy URL của ảnh đã upload
        imageUrls.push(uploadResponse.secure_url);
      } catch (uploadError) {
        console.error("Error uploading image:", uploadError);
        return res.status(500).json({ error: "Lỗi khi upload ảnh" });
      }
    }

    //Tạo một đối tượng Message mới với thông tin người gửi, người nhận, nội dung tin nhắn và ảnh
    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      images: imageUrls,
    });

    //Lưu tin nhắn vào cơ sở dữ liệu
    await newMessage.save();

    //Kiểm tra xem người nhận có đang online hay không
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      // Nếu người nhận đang online, gửi tin nhắn đến họ qua WebSocket
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.log("Error in sendMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    
    // Tìm và cập nhật tin nhắn trong một bước để tránh race condition
    const message = await Message.findOneAndUpdate(
      { 
        _id: id, 
        senderId: userId // Đảm bảo chỉ người gửi mới có thể thu hồi
      },
      { 
        $set: { 
          isDeleted: true,
          text: "",
          images: []
        } 
      },
      { new: true } // Trả về document đã được cập nhật
    );

    // Kiểm tra xem tin nhắn có tồn tại và người dùng có quyền không
    if (!message) {
      return res.status(404).json({ 
        error: "Không tìm thấy tin nhắn hoặc bạn không có quyền thu hồi" 
      });
    }

    // Thông báo cho tất cả client về việc tin nhắn đã bị thu hồi
    try {
      io.emit("messageRevoked", {
        messageId: message._id.toString(),
        senderId: message.senderId.toString(),
        receiverId: message.receiverId.toString(),
        timestamp: new Date().toISOString()
      });
    } catch (socketError) {
      console.error("Socket emit error:", socketError);
    }

    // Trả về thông báo thành công
    res.status(200).json({ message: "Tin nhắn đã được thu hồi" });
  } catch (error) {
    // Nếu có lỗi, trả về lỗi 500
    console.error("Error in deleteMessage:", error);
    res.status(500).json({ error: "Lỗi hệ thống khi thu hồi tin nhắn" });
  }
};
