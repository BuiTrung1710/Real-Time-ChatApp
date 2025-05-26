import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";
//socket.io-client là thư viện giúp tạo kết nối giữa client và server thông qua WebSocket
import { io } from "socket.io-client";

const BASE_URL =
  import.meta.env.MODE === "development" ? "http://localhost:5001" : "/";

//Frontend có thể:
//Gửi sự kiện đến server thông qua socket.emit("eventName", data);
//Lắng nghe sự kiện từ server thông qua socket.on("eventName", callback);
export const useAuthStore = create((set, get) => ({
  authUser: null, //Thông tin người dùng hiện tại (nếu đã đăng nhập)
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfile: false,
  isCheckingAuth: true, //Trạng thái đang kiểm tra xác thực
  onlineUsers: [], //Danh sách người dùng trực tuyến
  socket: null,

  //Hàm này sẽ được gọi khi ứng dụng khởi động để kiểm tra xem người dùng đã đăng nhập hay chưa
  //Nếu người dùng đã đăng nhập thì authUser sẽ có giá trị khác null, ngược lại thì authUser sẽ là null
  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");

      set({ authUser: res.data });
      get().connectSocket();
    } catch (error) {
      console.log("Error in checkAuth:", error);
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", data);
      set({ authUser: res.data });
      toast.success("Account created successfully");
      get().connectSocket();
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      set({ authUser: res.data });
      toast.success("Logged in successfully");

      get().connectSocket();
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      set({ authUser: null });
      toast.success("Logged out successfully");
      get().disconnectSocket();
    } catch (error) {
      toast.error(error.response.data.message);
    }
  },

  updateProfile: async (data) => {
    set({ isUpdatingProfile: true });
    try {
      const res = await axiosInstance.put("/auth/update-profile", data);
      set({ authUser: res.data });
      toast.success("Profile updated successfully");
    } catch (error) {
      console.log("error in update profile:", error);
      toast.error(error.response.data.message);
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  connectSocket: () => {
    const { authUser } = get();
    //Nếu người dùng chưa đăng nhập hoặc socket đã kết nối thì không cần kết nối lại
    //!authUser ở đây là khác giá trị truthy (là các giá trị như 0, "", null, undefined, NaN hay được gọi là falsy value)
    //Nếu authUser là null (authUser có giá trị là truthy thì !authUser === null sẽ là true), tức là người dùng chưa đăng nhập
    if (!authUser) {
      console.log("Cannot connect socket: no authenticated user");
      return;
    }
    
    // Đóng socket cũ nếu có trước khi tạo socket mới
    if (get().socket) {
      console.log("Closing existing socket before creating new one");
      get().disconnectSocket();
    }

    console.log("Connecting socket for user:", authUser._id);

    //Tạo kết nỗi giữa frontend và backend thông qua socket.io
    //io Là hàm được cung cấp bởi Socket.IO Client để tạo kết nối đến server.
    const socket = io(BASE_URL, {
      query: {
        //Gửi userId của người dùng hiện tại đến server để server có thể xác định người dùng nào đang kết nối
        //VD: http://localhost:5174?userId=123 => socket.handshake.query.userId = "123"
        userId: authUser._id,
      },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    
    socket.on("connect", () => {
      console.log("Socket connected with ID:", socket.id);
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });
    
    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
    });

    socket.on("deleteMessage", (messageId) => {
      console.log("Auth store received deleteMessage event:", messageId);
    });

    socket.connect();
    //Lưu socket vào store để có thể sử dụng lại sau này
    //socket là một đối tượng đại diện cho kết nối giữa client và server, nó sẽ được sử dụng để gửi và nhận dữ liệu giữa client và server
    set({ socket: socket });

    socket.on("getOnlineUsers", (userIds) => {
      console.log("Online users updated:", userIds);
      set({ onlineUsers: userIds });
    });
  },
  disconnectSocket: () => {
    const socket = get().socket;
    if (socket) {
      console.log("Disconnecting socket with ID:", socket.id);
      socket.off();  // Remove all listeners
      socket.disconnect();
      set({ socket: null });
    }
  },
}));
