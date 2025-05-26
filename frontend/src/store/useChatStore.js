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
    set({ isMessagesLoading: true });
    const { messages } = get();
    try {
      await axiosInstance.delete(`/messages/delete/${messageId}`);
      set({
        messages: messages.filter((message) => message._id !== messageId),
      });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isMessagesLoading: false });
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

    socket.on("deleteMessage", (messageId) => {
      console.log("Received deleteMessage event with ID:", messageId);
      set({
        messages: get().messages.filter((message) => message._id !== messageId),
      });
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    
    console.log("Unsubscribing from message events");
    socket.off("newMessage");
    socket.off("deleteMessage");
  },

  setSelectedUser: (selectedUser) => set({ selectedUser }),
}));
