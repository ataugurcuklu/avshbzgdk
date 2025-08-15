import { useState, useEffect, useRef } from "preact/hooks";
import type { JSX } from "preact";
import "pell/dist/pell.min.css";
import pell from "pell";

const { init } = pell;

interface Image {
  path: string;
}

interface FormData {
  title: string;
  description: string;
  content: string;
  altText: string;
  heroImage: File | string | null;
  originalFileName: string;
}

export default function EditPostForm({ postData }: { postData: any }) {
  const [formData, setFormData] = useState<FormData>({
    title: postData.title || "",
    description: postData.description || "",
    content: postData.content || "",
    altText: postData.altText || "",
    heroImage: postData.heroImage || null,
    originalFileName: postData.fileName || "",
  });

  // Diğer state değişkenleri AddPostForm ile benzer
  const [imagePreview, setImagePreview] = useState<string | null>(
    postData.heroImage || null,
  );
  const [showModal, setShowModal] = useState(false);
  const [existingImages, setExistingImages] = useState<Image[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const imagesPerPage = 9;
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchExistingImages();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && editorRef.current) {
      const editor = init({
        element: editorRef.current,
        onChange: (html: any) => {
          setFormData((prev) => ({
            ...prev,
            content: html,
          }));
        },
        defaultParagraphSeparator: "p",
        styleWithCSS: true,
        actions: [
          "bold",
          "italic",
          "underline",
          "strikethrough",
          "heading1",
          "heading2",
          "olist",
          "ulist",
          "paragraph",
          "quote",
          "code",
          "line",
          "link",
          "image",
        ],
      });

      editor.content.innerHTML = postData.content;
    }
  }, []);

  const fetchExistingImages = async () => {
    try {
      const response = await fetch("/admin/api/images");
      if (!response.ok) throw new Error("Resimler alınamadı");
      const data = await response.json();
      setExistingImages(data);
    } catch (err) {
      console.error("Resimler alınırken hata oluştu:", err);
    }
  };

  const handleInputChange = (
    e: JSX.TargetedEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.currentTarget;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e: JSX.TargetedEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (file) {
      setFormData((prev) => ({
        ...prev,
        heroImage: file,
      }));
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleExistingImageSelect = (imagePath: string) => {
    setFormData((prev) => ({
      ...prev,
      heroImage: imagePath,
    }));
    setImagePreview(imagePath);
    setShowModal(false);
  };

  const clearImageSelection = () => {
    setFormData((prev) => ({
      ...prev,
      heroImage: null,
    }));
    setImagePreview(null);
    if (document.getElementById("imageUpload")) {
      (document.getElementById("imageUpload") as HTMLInputElement).value = "";
    }
  };

  const handleSubmit = async (e: JSX.TargetedEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    const submitData = new FormData();

    Object.entries(formData).forEach(([key, value]) => {
      if (value !== null) {
        submitData.append(key, value);
      }
    });

    try {
      const response = await fetch("/admin/api/edit", {
        method: "PUT",
        body: submitData,
      });

      if (response.ok) {
        window.location.href = "/admin/posts";
      } else {
        const error = await response.text();
        throw new Error(error || "Gönderi güncellenemedi");
      }
    } catch (error) {
      console.error("Gönderi güncellenirken hata oluştu:", error);
      alert("Gönderi güncellenemedi. Lütfen tekrar deneyin.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalPages = Math.ceil(existingImages.length / imagesPerPage);
  const currentImages = existingImages.slice(
    (currentPage - 1) * imagesPerPage,
    currentPage * imagesPerPage,
  );

  return (
    <div class="p-4 pt-8">
      <div class="container mx-auto">
      <h1 class="text-2xl font-bold mb-4">Blog Yazısı Düzenleyici</h1>
      <form onSubmit={handleSubmit} class="space-y-4">
        <div>
          <label class="block mb-2">Başlık</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            required
            class="w-full p-2 border rounded"
          />
        </div>

        <div>
          <label class="block mb-2">Açıklama</label>
          <input
            type="text"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            required
            class="w-full p-2 border rounded"
          />
        </div>

        <div>
          <label class="block mb-2">Kapak Görseli</label>
          <div class="flex space-x-4 mb-2">
            <button
              type="button"
              class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              onClick={() => document.getElementById("imageUpload")?.click()}
            >
              Yeni Görsel Yükle
            </button>
            <button
              type="button"
              class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
              onClick={() => setShowModal(true)}
            >
              Mevcut Görseli Seç
            </button>
          </div>
          <input
            type="file"
            id="imageUpload"
            name="heroImage"
            accept="image/*"
            class="hidden"
            onChange={handleFileChange}
          />
          {imagePreview && (
            <div class="relative group mt-2 max-w-md">
              <img
                src={imagePreview}
                alt="Önizleme"
                class="max-w-full h-auto rounded"
              />
              <button
                type="button"
                class="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600"
                onClick={clearImageSelection}
              >
                ×
              </button>
            </div>
          )}
        </div>

        <div>
          <label class="block mb-2">Alt</label>
          <input
            type="text"
            name="altText"
            value={formData.altText}
            onChange={handleInputChange}
            required
            class="w-full p-2 border rounded"
          />
        </div>

        <div>
          <label class="block mb-2">İçerik</label>
          <div ref={editorRef} class="pell bg-gray-50"></div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          class={`${
            isSubmitting ? "bg-blue-300" : "bg-blue-500 hover:bg-blue-600"
          } text-white px-4 py-2 rounded transition-colors`}
        >
          {isSubmitting ? "Güncelleniyor" : "Gönderiyi Güncelle"}
        </button>
      </form>

      {showModal && (
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div class="bg-white rounded-lg p-6 max-w-4xl max-h-[80vh] overflow-y-auto">
            <h2 class="text-xl font-bold mb-4">Mevcut Bir Görsel Seçin</h2>
            <div class="grid grid-cols-3 gap-4">
              {currentImages.map((image) => (
                <div
                  key={image.path}
                  class="relative group cursor-pointer"
                  onClick={() => handleExistingImageSelect(image.path)}
                >
                  <img
                    src={image.path}
                    alt=""
                    class="w-full h-40 object-cover rounded"
                  />
                  <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity duration-200" />
                </div>
              ))}
            </div>
            <div class="flex justify-between mt-4">
              <button
                type="button"
                class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                onClick={() => setShowModal(false)}
              >
                Kapat
              </button>
              <div class="flex space-x-2">
                <button
                  type="button"
                  class={`${
                    currentPage === 1
                      ? "bg-gray-400"
                      : "bg-blue-500 hover:bg-blue-600"
                  } text-white px-4 py-2 rounded`}
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1}
                >
                  Önceki
                </button>
                <button
                  type="button"
                  class={`${
                    currentPage === totalPages
                      ? "bg-gray-400"
                      : "bg-blue-500 hover:bg-blue-600"
                  } text-white px-4 py-2 rounded`}
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={currentPage === totalPages}
                >
                  Sonraki
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
