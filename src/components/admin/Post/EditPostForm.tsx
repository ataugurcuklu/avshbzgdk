import { useState, useEffect, useRef } from "preact/hooks";
import type { JSX } from "preact";
import { loadJoditUmd } from '../../../utils/loadJoditUmd';
// Jodit CSS will be injected dynamically in the browser to avoid dev bundler import issues

interface Image {
  path: string;
}

interface Topic {
  id: number;
  name: string;
  color: string;
  description?: string;
}

interface FormData {
  title: string;
  description: string;
  content: string;
  altText: string;
  heroImage: File | string | null;
  originalFileName: string;
  topicId: number;
}

export default function EditPostForm({ postData }: { postData: any }) {
  const [formData, setFormData] = useState<FormData>({
    title: postData.title || "",
    description: postData.description || "",
    content: postData.content || "",
    altText: postData.altText || "",
    heroImage: postData.heroImage || null,
    originalFileName: postData.fileName || "",
    topicId: postData.topicId || 1,
  });

  // Diğer state değişkenleri AddPostForm ile benzer
  const [imagePreview, setImagePreview] = useState<string | null>(
    postData.heroImage || null,
  );
  const [showModal, setShowModal] = useState(false);
  const [existingImages, setExistingImages] = useState<Image[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const imagesPerPage = 9;
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstance = useRef<any>(null);

  useEffect(() => {
    fetchExistingImages();
    fetchTopics();
  }, []);

  useEffect(() => {
    let mounted = true;

    function injectJoditCss() {
      if (typeof document === 'undefined') return;
      if (document.querySelector('#jodit-css')) return;

      const link = document.createElement('link');
      link.id = 'jodit-css';
      link.rel = 'stylesheet';
      // Prefer a locally-served copy (copy the file to /public/jodit.css).
      // This avoids dev-time node_modules/CORS/MIME issues. If not present,
      // fall back to the recommended jsDelivr ESM fat CSS.
      link.href = '/jodit.css';
      link.onerror = function () {
        link.href = 'https://cdn.jsdelivr.net/npm/jodit@4.6.13/es2021/jodit.fat.min.css';
        link.onerror = function () {
          link.href = 'https://cdn.jsdelivr.net/npm/jodit@4.6.13/build/jodit.min.css';
        };
      };
      document.head.appendChild(link);
    }

    async function setupJodit() {
      if (typeof window === 'undefined' || !editorRef.current) return;
      try {
        const jsUrl = '/vendor/jodit/jodit.min.js';
        const cssUrl = '/vendor/jodit/jodit.min.css';

        const JoditGlobal = await loadJoditUmd(jsUrl, cssUrl, 'Jodit');
        const Editor = (JoditGlobal && typeof JoditGlobal.make === 'function') ? JoditGlobal : (window as any).Jodit;
        if (!Editor || typeof Editor.make !== 'function') {
          console.error('Loaded Jodit but Editor.make not found', Editor);
          return;
        }

        const editor = Editor.make(editorRef.current, {
          height: 400,
          language: 'tr',
          enableDragAndDropFileToEditor: false,
          showCharsCounter: false,
          showWordsCounter: false,
          askBeforePasteHTML: false,
        });

        if (editor && editor.events && editor.events.on) {
          editor.events.on('change', (newHtml: any) => {
            setFormData((prev) => ({ ...prev, content: newHtml }));
          });
        }

        // Attach TOC plugin UI


        editorInstance.current = editor;

        // set initial content when ready
        try {
          if (postData && postData.content) {
            if (editor.value !== undefined) editor.value = postData.content;
            else if (editor.setEditorValue) editor.setEditorValue(postData.content);
            else if (editor.setValue) editor.setValue(postData.content);
          }
        } catch (e) { /* ignore */ }
      } catch (err) {
        console.error('Jodit UMD load/init failed', err);
      }
    }

    setupJodit();

    return () => {
      mounted = false;
      if (editorInstance.current && typeof editorInstance.current.destruct === 'function') {
        try { editorInstance.current.destruct(); } catch (e) { /* ignore */ }
      }
    };
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

  const fetchTopics = async () => {
    try {
      const response = await fetch("/admin/api/topics");
      if (!response.ok) throw new Error("Konular alınamadı");
      const data = await response.json();
      setTopics(data);
    } catch (err) {
      console.error("Konular alınırken hata oluştu:", err);
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

    try {
      // Prepare data for the new SQLite API
      const postData = {
        slug: formData.originalFileName, // Use the original post slug
        title: formData.title,
        description: formData.description,
        content: formData.content,
        heroImage: typeof formData.heroImage === 'string' ? formData.heroImage : '',
        altText: formData.altText,
        topicId: formData.topicId
      };

      // If we have a file upload, handle it first
      if (formData.heroImage instanceof File) {
        const imageFormData = new FormData();
        imageFormData.append('heroImage', formData.heroImage);

        try {
          const imageResponse = await fetch("/admin/api/images", {
            method: "POST",
            body: imageFormData,
          });

          if (imageResponse.ok) {
            const imageResult = await imageResponse.json();
            postData.heroImage = imageResult.path || '';
          }
        } catch (imageError) {
          console.warn("Image upload failed, proceeding with existing image:", imageError);
        }
      }

      const response = await fetch("/admin/api/blog", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(postData),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("Post updated:", result);

        if (result.slugChanged) {
          alert(`Gönderi başarıyla güncellendi! URL değişti: /blog/${result.slug}/`);
        } else {
          alert("Gönderi başarıyla güncellendi!");
        }

        window.location.href = "/admin/posts";
      } else {
        const error = await response.json();
        throw new Error(error.error || "Gönderi güncellenemedi");
      }
    } catch (error) {
      console.error("Gönderi güncellenirken hata oluştu:", error);
      alert("Gönderi güncellenemedi. Lütfen tekrar deneyin. Hata: " + (error as Error).message);
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
    <div class="p-4 pt-8 mb-32">
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
            <label class="block mb-2">Konu Kategorisi</label>
            <select
              name="topicId"
              value={formData.topicId}
              onChange={(e) => setFormData(prev => ({ ...prev, topicId: parseInt(e.currentTarget.value) }))}
              required
              class="w-full p-2 border rounded"
            >
              <option value="">Bir konu seçin...</option>
              {topics.map(topic => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </select>
            {/* Show selected topic color */}
            {formData.topicId && topics.find(t => t.id === formData.topicId) && (
              <div class="mt-2 flex items-center space-x-2">
                <div
                  class="w-4 h-4 rounded-full"
                  style={`background-color: ${topics.find(t => t.id === formData.topicId)?.color}`}
                ></div>
                <span class="text-sm text-gray-600">
                  {topics.find(t => t.id === formData.topicId)?.name}
                </span>
              </div>
            )}
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
                Mevcut Görsellerden Seç
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
            <label class="block mb-2">Alt Text</label>
            <input
              type="text"
              name="altText"
              value={formData.altText}
              onChange={handleInputChange}
              required
              class="w-full p-2 border rounded"
              placeholder="Görsel için açıklayıcı metin"
            />
          </div>

          <div>
            <label class="block mb-2">İçerik</label>
            <div class="mb-2 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
              <strong>İçindekiler (TOC) Kullanımı:</strong>
              <ul class="mt-1 ml-4 space-y-1">
                <li>• <strong>TOC</strong> düğmesi: Tıklanabilir bağlantı ekler (örn: "1-X")</li>
                <li>• <strong>⚓</strong> düğmesi: Bağlantının gideceği çapa ekler (örn: "X")</li>
                <li>• Bağlantı ID'si ile çapa ID'si eşleşmelidir</li>
              </ul>
              <div class="mt-2 p-2 bg-gray-100 rounded text-xs">
                <strong>Örnek:</strong> Metin editöründe "1-giris" bağlantısı oluşturun, sonra "giris" çapası ekleyin. Okuyucular "1-giris"e tıkladığında "giris" çapasına gidecek.
              </div>
            </div>
            <div class="mb-2 flex space-x-2">
              <button
                type="button"
                class="bg-indigo-500 text-white px-3 py-1 rounded"
                onClick={() => {
                  const tocId = prompt('TOC ID girin (örn: 1-X):');
                  if (!tocId || !editorInstance.current) return;
                  const html = `<a href="#toc-${tocId}" class="toc-link" style="color: blue; text-decoration: underline;">${tocId}</a>`;
                  try { editorInstance.current.selection.insertHTML(html); } catch (e) { document.execCommand('insertHTML', false, html); }
                }}
              >
                TOC
              </button>
              <button
                type="button"
                class="bg-indigo-400 text-white px-3 py-1 rounded"
                onClick={() => {
                  const anchorId = prompt('Çapa ID girin (örn: X):');
                  if (!anchorId || !editorInstance.current) return;
                  const html = `<span id="toc-${anchorId}" class="toc-anchor" style="border-left: 3px solid #2563eb; padding-left: 10px; display: block; margin: 10px 0;">&nbsp;</span>`;
                  try { editorInstance.current.selection.insertHTML(html); } catch (e) { document.execCommand('insertHTML', false, html); }
                }}
              >
                ⚓
              </button>
            </div>

            <div ref={editorRef} class="bg-gray-50"></div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            class={`${isSubmitting ? "bg-blue-300" : "bg-blue-500 hover:bg-blue-600"
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
                    class={`${currentPage === 1
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
                    class={`${currentPage === totalPages
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
