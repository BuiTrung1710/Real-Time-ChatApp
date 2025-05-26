import { create } from "zustand";

//1.Theme:
// Trạng thái lưu trữ chủ đề hiện tại của ứng dụng
//Gía trị ban đầu được lấy từ localStorage (nếu có). Không thì mặc định là màu coffee
//2.setTheme:
//Hàm để thay đổi chủ đề
//Khi được gọi:
//Lưu chủ đề mới vào localStorage để duy trì trạng thái ngay cả khi người dùng tải lại trang.
//Cập nhật lại trạng thái theme trong Zustand store
export const useThemeStore = create((set) => ({
  theme: localStorage.getItem("chat-theme") || "coffee",
  setTheme: (theme) => {
    localStorage.setItem("chat-theme", theme); //Lưu theme vào localStorage
    set({ theme }); //Cập nhật trạng thái theme
  },
}));
