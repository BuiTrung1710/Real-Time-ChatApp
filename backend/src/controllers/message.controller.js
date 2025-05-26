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
    //lấy text và image từ body
    const { text, image } = req.body;
    //lấy id của người nhận từ params của route (ví dụ: /api/messages/:id)
    const { id: receiverId } = req.params;
    //lấy id của người gửi từ req.user (đã được xác thực trước đó) (middleware auth)
    const senderId = req.user._id;

    let imageUrl;
    if (image) {
      // Nếu có ảnh dạng base64, upload lên Cloudinary
      const uploadResponse = await cloudinary.uploader.upload(image);
      // Lấy URL của ảnh đã upload thành công
      imageUrl = uploadResponse.secure_url;
    }

    //Tạo một đối tượng Message mới với thông tin người gửi, người nhận, nội dung tin nhắn và ảnh (nếu có)
    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
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
    // Tìm tin nhắn theo id
    const message = await Message.findById(id);
    if (!message) return res.status(404).json({ error: "Message not found" }); // Nếu không tìm thấy tin nhắn, trả về lỗi 404

    // Kiểm tra quyền: chỉ cho phép người gửi xóa tin nhắn của mình
    if (message.senderId.toString() !== userId.toString())
      return res.status(403).json({ error: "Not allowed" }); // Nếu không phải người gửi, trả về lỗi 403

    // Lưu trữ thông tin cần thiết trước khi xóa tin nhắn
    const senderId = message.senderId.toString();
    const receiverId = message.receiverId.toString();
    const messageId = message._id.toString();

    // Xóa tin nhắn khỏi database
    await message.deleteOne();

    try {
      // Thay vì gửi đến socket cụ thể, gửi broadcast đến tất cả clients
      io.emit("deleteMessage", messageId);
    } catch (socketError) {
      console.error("Socket emit error:", socketError);
    }

    // Trả về thông báo thành công
    res.status(200).json({ message: "Message deleted" });
  } catch (error) {
    // Nếu có lỗi, trả về lỗi 500
    console.error("Error in deleteMessage:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
