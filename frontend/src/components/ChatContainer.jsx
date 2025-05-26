import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef, useCallback, useState } from "react";
import toast from "react-hot-toast";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";
import {
  X,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react";

// Thêm CSS cho hiệu ứng mượt mà
const messageStyles = {
  normal: "opacity-100 max-h-[1000px]",
  deleted: "opacity-60 max-h-[30px]",
  transition: "transition-all duration-300 ease-in-out",
};

const ChatContainer = () => {
  const [hoverMsgId, setHoverMsgId] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [allImages, setAllImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [confirmDeleteModal, setConfirmDeleteModal] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null);

  const {
    messages,
    getMessages,
    deleteMessage,
    isMessagesLoading,
    selectedUser,
    subscribeToMessages,
    unsubscribeFromMessages,
  } = useChatStore();
  const { authUser, socket } = useAuthStore();
  const messageEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const handleGetMessages = useCallback(() => {
    if (selectedUser?._id) {
      console.log("Getting messages for user:", selectedUser._id);
      getMessages(selectedUser._id);
    }
  }, [selectedUser, getMessages]);

  useEffect(() => {
    if (socket && selectedUser) {
      console.log("Setting up message subscriptions");

      unsubscribeFromMessages();

      subscribeToMessages();

      return () => {
        console.log("Cleaning up message subscriptions");
        unsubscribeFromMessages();
      };
    }
  }, [socket, selectedUser, subscribeToMessages, unsubscribeFromMessages]);

  useEffect(() => {
    handleGetMessages();
  }, [handleGetMessages]);

  useEffect(() => {
    if (socket) {
      const handleDeleteMessage = (messageId) => {
        console.log("ChatContainer received delete for message:", messageId);
        useChatStore.setState((state) => ({
          messages: state.messages.filter(
            (message) => message._id !== messageId
          ),
        }));
      };

      socket.on("deleteMessage", handleDeleteMessage);

      return () => {
        socket.off("deleteMessage", handleDeleteMessage);
      };
    }
  }, [socket]);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Tạo danh sách tất cả ảnh từ tất cả tin nhắn
  useEffect(() => {
    if (messages && messages.length > 0) {
      const allMessageImages = [];
      messages.forEach((message) => {
        if (
          !message.isDeleted &&
          message.images &&
          Array.isArray(message.images) &&
          message.images.length > 0
        ) {
          allMessageImages.push(...message.images);
        }
      });
      setAllImages(allMessageImages);
    }
  }, [messages]);

  const handleDeleteMessage = (messageId) => {
    // Hiển thị modal xác nhận thay vì xóa ngay lập tức
    setMessageToDelete(messageId);
    setConfirmDeleteModal(true);
  };

  const confirmDelete = () => {
    if (messageToDelete) {
      // Thực hiện xóa tin nhắn
      deleteMessage(messageToDelete);

      // Hiển thị thông báo mượt mà
      toast.success("Đã thu hồi tin nhắn", {
        duration: 2000,
        position: "bottom-center",
        style: {
          borderRadius: "10px",
          background: "#333",
          color: "#fff",
        },
      });

      // Đóng modal và reset state
      setConfirmDeleteModal(false);
      setMessageToDelete(null);
    }
  };

  const cancelDelete = () => {
    setConfirmDeleteModal(false);
    setMessageToDelete(null);
  };

  const openImageModal = (imageUrl) => {
    setSelectedImage(imageUrl);
    setImageLoading(true);
    setZoom(1);

    // Tìm index của ảnh trong danh sách tất cả ảnh
    const index = allImages.findIndex((img) => img === imageUrl);
    if (index !== -1) {
      setCurrentImageIndex(index);
    }
  };

  const closeImageModal = () => {
    setSelectedImage(null);
    setZoom(1);
  };

  const handleZoomIn = (e) => {
    e.stopPropagation();
    setZoom((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = (e) => {
    e.stopPropagation();
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleNextImage = (e) => {
    e.stopPropagation();
    if (currentImageIndex < allImages.length - 1) {
      setImageLoading(true);
      setZoom(1);
      setCurrentImageIndex((prev) => prev + 1);
      setSelectedImage(allImages[currentImageIndex + 1]);
    }
  };

  const handlePrevImage = (e) => {
    e.stopPropagation();
    if (currentImageIndex > 0) {
      setImageLoading(true);
      setZoom(1);
      setCurrentImageIndex((prev) => prev - 1);
      setSelectedImage(allImages[currentImageIndex - 1]);
    }
  };

  // Xử lý phím tắt để điều hướng và đóng modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedImage) return;

      switch (e.key) {
        case "Escape":
        case "Esc":
          closeImageModal();
          break;
        case "ArrowRight":
          if (currentImageIndex < allImages.length - 1) {
            handleNextImage(e);
          }
          break;
        case "ArrowLeft":
          if (currentImageIndex > 0) {
            handlePrevImage(e);
          }
          break;
        case "+":
          handleZoomIn(e);
          break;
        case "-":
          handleZoomOut(e);
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedImage, currentImageIndex, allImages]);

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <ChatHeader />

      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.map((message, index) => (
          <div
            key={message._id}
            className={`chat ${
              message.senderId === authUser._id ? "chat-end" : "chat-start"
            }`}
            ref={index === messages.length - 1 ? messageEndRef : null}
            onMouseEnter={() => setHoverMsgId(message._id)}
            onMouseLeave={() => setHoverMsgId(null)}
          >
            <div className="chat-image avatar">
              <div className="size-10 rounded-full border">
                <img
                  src={
                    message.senderId === authUser._id
                      ? authUser.profilePic || "/avatar.png"
                      : selectedUser.profilePic || "/avatar.png"
                  }
                  alt="profile pic"
                />
              </div>
            </div>
            <div className="chat-header mb-1">
              <time className="text-xs opacity-50 ml-1">
                {formatMessageTime(message.createdAt)}
              </time>
              {/* Hiện icon xóa nếu là tin nhắn của mình và đang hover */}
              {message.senderId === authUser._id &&
                hoverMsgId === message._id &&
                !message.isDeleted && (
                  <button
                    className="ml-2 text-gray-400 hover:text-red-600"
                    title="Thu hồi tin nhắn"
                    onClick={() => handleDeleteMessage(message._id)}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
            </div>
            <div
              className={`chat-bubble flex flex-col overflow-hidden ${
                messageStyles.transition
              } ${
                message.isDeleted ? messageStyles.deleted : messageStyles.normal
              }`}
            >
              {message.isDeleted ? (
                <p className="italic text-sm">Tin nhắn đã bị thu hồi</p>
              ) : (
                <>
                  {message.images &&
                    Array.isArray(message.images) &&
                    message.images.length > 0 &&
                    message.images.map((img, index) => (
                      <div key={index} className="mb-2 relative">
                        <img
                          src={img}
                          alt={`Attachment ${index + 1}`}
                          className="sm:max-w-[250px] max-w-[180px] rounded-md object-cover"
                          style={{ maxHeight: "250px" }}
                          onClick={() => openImageModal(img)}
                        />
                        <div
                          className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 hover:bg-opacity-30 transition-all duration-200 cursor-pointer rounded-md"
                          onClick={() => openImageModal(img)}
                        >
                          <span className="text-white opacity-0 hover:opacity-100">
                            Xem
                          </span>
                        </div>
                      </div>
                    ))}
                  {message.text && <p>{message.text}</p>}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal xác nhận thu hồi tin nhắn */}
      {confirmDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-base-100 rounded-lg p-6 max-w-sm w-full shadow-xl animate-scaleIn">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-2 rounded-full">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <h3 className="font-bold text-lg">Xác nhận thu hồi</h3>
            </div>

            <p className="py-2">
              Bạn có chắc chắn muốn thu hồi tin nhắn này không?
            </p>
            <p className="text-sm opacity-70 mt-1 mb-4">
              Tin nhắn sẽ bị thu hồi cho tất cả mọi người.
            </p>

            <div className="flex justify-end gap-2 mt-4">
              <button className="btn btn-sm btn-ghost" onClick={cancelDelete}>
                Hủy
              </button>
              <button className="btn btn-sm btn-error" onClick={confirmDelete}>
                Thu hồi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal xem ảnh lớn */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4"
          onClick={closeImageModal}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full">
            {/* Thanh công cụ */}
            <div className="absolute top-2 right-2 flex gap-2 z-10">
              <button
                className="bg-gray-800 rounded-full p-2 text-white hover:bg-gray-700"
                onClick={handleZoomOut}
                title="Thu nhỏ (-)"
              >
                <ZoomOut size={20} />
              </button>
              <button
                className="bg-gray-800 rounded-full p-2 text-white hover:bg-gray-700"
                onClick={handleZoomIn}
                title="Phóng to (+)"
              >
                <ZoomIn size={20} />
              </button>
              <button
                className="bg-gray-800 rounded-full p-2 text-white hover:bg-gray-700"
                onClick={(e) => {
                  e.stopPropagation();
                  closeImageModal();
                }}
                title="Đóng (Esc)"
              >
                <X size={20} />
              </button>
            </div>

            {/* Nút điều hướng - đã chuyển ra ngoài div ảnh và làm lớn hơn để dễ nhìn */}
            <div className="absolute inset-x-0 top-1/2 transform -translate-y-1/2 flex justify-between px-4 z-10">
              {currentImageIndex > 0 && (
                <button
                  className="bg-gray-800 bg-opacity-70 rounded-full p-3 text-white hover:bg-opacity-100"
                  onClick={handlePrevImage}
                  title="Ảnh trước (←)"
                >
                  <ChevronLeft size={28} />
                </button>
              )}

              {currentImageIndex < allImages.length - 1 && (
                <button
                  className="bg-gray-800 bg-opacity-70 rounded-full p-3 text-white hover:bg-opacity-100"
                  onClick={handleNextImage}
                  title="Ảnh tiếp theo (→)"
                >
                  <ChevronRight size={28} />
                </button>
              )}
            </div>

            {/* Hiển thị đang tải */}
            {imageLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="loading loading-spinner loading-lg text-primary"></span>
              </div>
            )}

            {/* Hiển thị ảnh - giới hạn kích thước tối đa */}
            <div className="overflow-auto max-h-[90vh] flex items-center justify-center">
              <img
                src={selectedImage}
                alt="Enlarged"
                className="max-h-[85vh] max-w-[90vw] object-contain mx-auto rounded-lg transition-transform duration-200"
                style={{
                  transform: `scale(${zoom})`,
                  opacity: imageLoading ? 0.3 : 1,
                  cursor: "zoom-in",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleZoomIn(e);
                }}
                onLoad={() => setImageLoading(false)}
              />
            </div>

            {/* Chỉ số ảnh */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800 px-3 py-1 rounded-full text-white text-sm">
              {currentImageIndex + 1} / {allImages.length}
            </div>
          </div>
        </div>
      )}

      <MessageInput />
    </div>
  );
};
export default ChatContainer;
