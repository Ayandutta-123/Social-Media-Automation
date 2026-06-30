"use client";

import { useRef, useState, useCallback } from "react";
import TopBar from "@/components/layout/TopBar";
import {
  ImagePlus,
  X,
  Check,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export default function UploadImagePage() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setMessage(null);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && /^image\/(jpeg|png|webp)$/.test(file.type)) {
      processFile(file);
    }
  }, [previewUrl]);

  const clearFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("postType", "competitor");

    try {
      const res = await fetch("/api/posts/upload-image", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Upload failed" });
        return;
      }

      setMessage({
        type: "success",
        text: "Custom image sent to n8n. The workflow will apply it to the current run.",
      });
      clearFile();
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen min-w-0 flex flex-col">
      <TopBar title="Upload image" />

      <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8">
        {/* Main Card — fills available height */}
        <div className="flex-1 flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6 lg:p-8 shadow-sm animate-fade-in">

          {/* Title */}
          <div className="mb-6 sm:mb-8">
            <h2 className="text-[20px] sm:text-[24px] font-bold text-[var(--color-text-primary)] tracking-tight">
              Custom Image
            </h2>
            <p className="text-[14px] text-[var(--color-text-muted)] mt-1.5">
              Override the AI-generated image with your own custom visual.
            </p>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            id="image-file-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="sr-only"
          />

          {previewUrl ? (
            /* ── Preview State ── */
            <div className="flex-1 flex flex-col rounded-2xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-hover)] mb-6">
              <div className="flex-1 flex items-center justify-center p-6 relative min-h-0">
                <img
                  src={previewUrl}
                  alt="Upload preview"
                  className="max-w-full max-h-full object-contain rounded-lg"
                  style={{ maxHeight: "calc(100vh - 380px)" }}
                />
                <button
                  type="button"
                  onClick={clearFile}
                  className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-all hover:bg-black/70 hover:scale-110"
                  aria-label="Remove selected file"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="px-5 py-3.5 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
                <p className="text-[14px] text-[var(--color-text-primary)] font-medium truncate">
                  {selectedFile?.name}
                </p>
                <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5">
                  {selectedFile && (selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            </div>
          ) : (
            /* ── Empty Drop Zone — fills available space ── */
            <label
              htmlFor="image-file-input"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex-1 flex flex-col items-center justify-center cursor-pointer rounded-2xl border-2 border-dashed mb-6 transition-all duration-300 ${
                isDragging
                  ? "border-blue-400 bg-blue-50/60 dark:bg-blue-950/20 scale-[1.005]"
                  : "border-[var(--color-border-hover)] bg-[var(--color-surface-hover)]/40 hover:border-blue-300 hover:bg-blue-50/20 dark:hover:bg-blue-950/10"
              }`}
            >
              <div className={`flex items-center justify-center w-20 h-20 rounded-2xl mb-6 transition-all duration-300 ${
                isDragging
                  ? "bg-blue-100 dark:bg-blue-900/40 scale-110"
                  : "bg-blue-50 dark:bg-blue-900/20"
              }`}>
                <ImagePlus className={`w-10 h-10 transition-colors duration-300 ${
                  isDragging ? "text-blue-600 dark:text-blue-400" : "text-blue-500 dark:text-blue-400"
                }`} />
              </div>
              <p className="text-[17px] text-[var(--color-text-primary)] font-semibold mb-2">
                <span className="text-blue-600 dark:text-blue-400 underline underline-offset-4 decoration-blue-300 dark:decoration-blue-600">Click to Upload</span>
                <span className="font-normal">{" "}or Drag and Drop</span>
              </p>
              <p className="text-[14px] text-[var(--color-text-muted)]">
                JPEG, PNG, or WebP — Max 10 MB
              </p>
            </label>
          )}

          {/* Status Message */}
          {message && (
            <div
              className={`mb-6 flex items-start gap-2.5 rounded-xl border px-4 py-3.5 text-[13px] ${
                message.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
              }`}
            >
              {message.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              )}
              {message.text}
            </div>
          )}

          {/* Done Button — right-aligned */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-[12px] text-[var(--color-text-muted)] max-w-md">
              Upload only while your n8n workflow is waiting at the image webhook.
              Skipping this step lets the workflow continue with the AI image.
            </p>
            <button
              type="button"
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-7 py-3 text-[15px] font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] focus:border-blue-300 focus:ring-2 focus:ring-blue-100 outline-none transition-all shadow-sm active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <span className="h-4 w-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
              ) : (
                <Check className="h-5 w-5" />
              )}
              {isUploading ? "Uploading..." : "Done"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
