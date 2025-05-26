import { useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { Image, Send, X } from "lucide-react";
import toast from "react-hot-toast";

const MessageInput = () => {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef(null);
  const { sendMessage } = useChatStore();

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));

    if (imageFiles.length === 0) {
      toast.error("Vui lòng chọn file hình ảnh");
      return;
    }

    // Giới hạn số lượng ảnh
    if (imagePreview.length + imageFiles.length > 10) {
      toast.error("Chỉ được gửi tối đa 10 ảnh một lúc");
      return;
    }

    const readers = imageFiles.map(
      (file) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(file);
        })
    );

    Promise.all(readers).then((images) => {
      setImagePreview((prev) => [...prev, ...images]);
    });
  };

  const removeImage = (index) => {
    setImagePreview((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() && imagePreview.length === 0) return;

    setIsSending(true);
    try {
      if (imagePreview.length > 0) {
        // Nếu có ảnh, gửi từng ảnh một
        toast.loading("Đang gửi tin nhắn và ảnh...");

        // Gửi tin nhắn văn bản trước (nếu có)
        if (text.trim()) {
          await sendMessage({
            text: text.trim(),
            images: [],
          });
        }

        // Gửi từng ảnh riêng biệt
        for (let i = 0; i < imagePreview.length; i++) {
          await sendMessage({
            text: "",
            images: [imagePreview[i]],
          });
          // Đợi một chút giữa mỗi lần gửi để tránh quá tải
          if (i < imagePreview.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        }

        toast.dismiss();
        toast.success(`Đã gửi ${imagePreview.length} ảnh`);
      } else {
        // Nếu chỉ có văn bản, gửi bình thường
        await sendMessage({
          text: text.trim(),
          images: [],
        });
      }

      // Clear form
      setText("");
      setImagePreview([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      toast.error("Lỗi khi gửi tin nhắn");
      console.error("Failed to send message:", error);
    } finally {
      setIsSending(false);
      toast.dismiss();
    }
  };

  return (
    <div className="p-4 w-full">
      {imagePreview.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {imagePreview.map((img, index) => (
            <div className="relative" key={index}>
              <img
                src={img}
                alt={`Preview ${index}`}
                className="w-20 h-20 object-cover rounded-lg border border-zinc-700"
              />
              <button
                onClick={() => removeImage(index)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300
              flex items-center justify-center"
                type="button"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSendMessage} className="flex items-center gap-2">
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            className="w-full input input-bordered rounded-lg input-sm sm:input-md"
            placeholder="Nhập tin nhắn..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            ref={fileInputRef}
            onChange={handleImageChange}
          />

          <button
            type="button"
            className={`hidden sm:flex btn btn-circle
                     ${
                       imagePreview.length > 0
                         ? "text-emerald-500"
                         : "text-zinc-400"
                     }`}
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending}
          >
            {isSending ? (
              <span className="loading loading-spinner loading-xs"></span>
            ) : (
              <Image size={20} />
            )}
          </button>
        </div>
        <button
          type="submit"
          className="btn btn-sm btn-circle"
          disabled={(!text.trim() && imagePreview.length === 0) || isSending}
        >
          {isSending ? (
            <span className="loading loading-spinner loading-xs"></span>
          ) : (
            <Send size={22} />
          )}
        </button>
      </form>
    </div>
  );
};
export default MessageInput;
