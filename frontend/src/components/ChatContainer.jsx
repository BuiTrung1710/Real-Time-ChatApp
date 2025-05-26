import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef, useCallback } from "react";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";
import { useState } from "react";

const ChatContainer = () => {
  const [hoverMsgId, setHoverMsgId] = useState(null);
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

  const handleDeleteMessage = (messageId) => {
    if (window.confirm("Bạn có chắc muốn thu hồi tin nhắn này không?")) {
      deleteMessage(messageId);
    }
  };

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
            <div className=" chat-image avatar">
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
              {/*Kiểm tra xem tin nhắn người gửi có đúng là của tin nhắn người đang đăng nhập hay không và hover đúng vào id của tin nhắn đấy chưa */}
              {message.senderId === authUser._id &&
                hoverMsgId === message._id && (
                  <button
                    className="ml-2 text-gray-400 hover:text-red-600"
                    title="Thu hồi tin nhắn"
                    onClick={() => handleDeleteMessage(message._id)}
                  >
                    🗑️
                  </button>
                )}
            </div>
            <div className="chat-bubble flex flex-col">
              {message.image && (
                <img
                  src={message.image}
                  alt="Attachment"
                  className="sm:max-w-[200px] rounded-md mb-2"
                />
              )}
              {message.text && <p>{message.text}</p>}
            </div>
          </div>
        ))}
      </div>

      <MessageInput />
    </div>
  );
};
export default ChatContainer;
