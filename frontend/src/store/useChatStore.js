import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isMessagesLoading: false });
    }
  },
  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    try {
      const res = await axiosInstance.post(
        `/messages/send/${selectedUser._id}`,
        messageData
      );
      set({ messages: [...messages, res.data] });
    } catch (error) {
      toast.error(error.response.data.message);
    }
  },
  deleteMessage: async (messageId) => {
    const { messages } = get();
    const updatedMessages = messages.map(message => 
      message._id === messageId 
        ? { ...message, isDeleted: true, text: "", images: [] } 
        : message
    );
    
    set({ messages: updatedMessages });
    
    try {
      await axiosInstance.delete(`/messages/delete/${messageId}`);
    } catch (error) {
      toast.error(error.response?.data?.message || "Lỗi khi thu hồi tin nhắn");
      set({ messages });
    }
  },

  subscribeToMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) {
      console.error("Socket not initialized when subscribing to messages");
      return;
    }

    socket.off("newMessage");
    socket.off("deleteMessage");
    socket.off("messageRevoked");

    socket.on("newMessage", (newMessage) => {
      const { selectedUser } = get();
      if (!selectedUser) return;
      
      const isMessageSentFromSelectedUser =
        newMessage.senderId === selectedUser._id;
      const isMessageSentToSelectedUser = 
        newMessage.receiverId === selectedUser._id;
      
      if (!isMessageSentFromSelectedUser && !isMessageSentToSelectedUser) return;

      set({
        messages: [...get().messages, newMessage],
      });
    });

    socket.on("messageRevoked", (data) => {
      console.log("Received messageRevoked event:", data);
      const { messageId } = data;
      const { messages } = get();
      
      const messageAlreadyRevoked = messages.some(
        msg => msg._id === messageId && msg.isDeleted
      );
      
      if (!messageAlreadyRevoked) {
        set({
          messages: messages.map(message => 
            message._id === messageId 
              ? { ...message, isDeleted: true, text: "", images: [] } 
              : message
          )
        });
      }
    });

    socket.on("deleteMessage", (messageId) => {
      console.log("Received deleteMessage event with ID:", messageId);
      const { messages } = get();
      
      const messageAlreadyRevoked = messages.some(
        msg => msg._id === messageId && msg.isDeleted
      );
      
      if (!messageAlreadyRevoked) {
        set({
          messages: messages.map(message => 
            message._id === messageId 
              ? { ...message, isDeleted: true, text: "", images: [] } 
              : message
          )
        });
      }
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    
    console.log("Unsubscribing from message events");
    socket.off("newMessage");
    socket.off("deleteMessage");
    socket.off("messageRevoked");
  },

  setSelectedUser: (selectedUser) => set({ selectedUser }),
}));
