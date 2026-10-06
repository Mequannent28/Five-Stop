import React, { useRef, useState } from 'react';
import { Paperclip, UploadCloud, X, FileText, Image, Loader2, Eye, Trash2 } from 'lucide-react';
import api from '../../api/axios';

// ── AttachmentUploader ─────────────────────────────────────────────────
// Renders a drag-and-drop / click-to-upload area for receipts / invoices.
// Calls onAttachmentsChange(attachments[]) with the current list.
// ──────────────────────────────────────────────────────────────────────

export default function AttachmentUploader({ attachments = [], onAttachmentsChange, disabled = false }) {
  const inputRef   = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver]  = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const isImage = (mimeType = '', url = '') =>
    /image\/(jpeg|jpg|png|gif|webp)/i.test(mimeType) || /\.(jpg|jpeg|png|gif|webp)$/i.test(url);

  const uploadFiles = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach(f => formData.append('files', f));
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onAttachmentsChange([...attachments, ...res.data.files]);
    } catch (err) {
      alert(err.response?.data?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleFileChange = (e) => uploadFiles(e.target.files);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(e.dataTransfer.files);
  };

  const removeAttachment = (idx) => {
    const updated = attachments.filter((_, i) => i !== idx);
    onAttachmentsChange(updated);
  };

  return (
    <div className="space-y-3">
      {/* Drop Zone */}
      <div
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`
          relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed
          px-4 py-5 text-center transition cursor-pointer select-none
          ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-ink-200 bg-ink-50/60 hover:border-blue-400 hover:bg-blue-50/30'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {uploading ? (
          <>
            <Loader2 size={22} className="animate-spin text-blue-500" />
            <p className="text-xs text-blue-700 font-medium">Uploading…</p>
          </>
        ) : (
          <>
            <UploadCloud size={22} className="text-ink-400" />
            <div>
              <p className="text-xs font-semibold text-ink-700">
                {dragOver ? 'Drop files here' : 'Upload Receipt / Invoice'}
              </p>
              <p className="text-[11px] text-ink-400 mt-0.5">
                JPG, PNG, PDF up to 10 MB · Drag &amp; drop or click
              </p>
            </div>
            <label className="inline-flex items-center gap-1.5 mt-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition pointer-events-none">
              <Paperclip size={12} /> Attach File
            </label>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,.pdf"
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled || uploading}
        />
      </div>

      {/* Attachment List */}
      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map((att, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2.5 rounded-lg border border-ink-100 bg-white px-3 py-2 shadow-xs text-xs"
            >
              {/* Thumbnail or icon */}
              {isImage(att.mimeType, att.url) ? (
                <img
                  src={att.url}
                  alt={att.name}
                  className="h-9 w-9 rounded-md object-cover border border-ink-100 shrink-0 cursor-pointer"
                  onClick={() => setPreviewUrl(att.url)}
                />
              ) : (
                <span className="h-9 w-9 rounded-md bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                  <FileText size={16} className="text-red-500" />
                </span>
              )}

              <div className="flex-1 min-w-0">
                <p className="font-medium text-ink-800 truncate">{att.name || 'Receipt'}</p>
                {att.size > 0 && (
                  <p className="text-ink-400">{(att.size / 1024).toFixed(1)} KB</p>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {/* Preview / open */}
                <a
                  href={att.url}
                  target="_blank"
                  rel="noreferrer"
                  title="Open"
                  className="p-1.5 rounded-md text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition"
                >
                  <Eye size={13} />
                </a>
                {/* Remove */}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    title="Remove"
                    className="p-1.5 rounded-md text-ink-400 hover:bg-red-50 hover:text-red-600 transition"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Preview */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-[999] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <button
              type="button"
              onClick={() => setPreviewUrl(null)}
              className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-white text-ink-800 flex items-center justify-center shadow-lg hover:bg-ink-100 z-10"
            >
              <X size={16} />
            </button>
            <img
              src={previewUrl}
              alt="Receipt preview"
              className="max-h-[85vh] max-w-full rounded-xl shadow-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── AttachmentViewer (read-only list shown in detail modals) ──────────
export function AttachmentViewer({ attachments = [] }) {
  const [previewUrl, setPreviewUrl] = useState(null);

  const isImage = (mimeType = '', url = '') =>
    /image\/(jpeg|jpg|png|gif|webp)/i.test(mimeType) || /\.(jpg|jpeg|png|gif|webp)$/i.test(url);

  if (!attachments || attachments.length === 0) {
    return (
      <p className="text-xs text-ink-400 italic">No attachments.</p>
    );
  }

  return (
    <>
      <div className="space-y-1.5">
        {attachments.map((att, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2.5 rounded-lg border border-ink-100 bg-ink-50 px-3 py-2 text-xs"
          >
            {isImage(att.mimeType, att.url) ? (
              <img
                src={att.url}
                alt={att.name}
                className="h-9 w-9 rounded-md object-cover border border-ink-100 shrink-0 cursor-pointer"
                onClick={() => setPreviewUrl(att.url)}
              />
            ) : (
              <span className="h-9 w-9 rounded-md bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                <FileText size={16} className="text-red-500" />
              </span>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-ink-800 truncate">{att.name || 'Receipt'}</p>
              {att.size > 0 && <p className="text-ink-400">{(att.size / 1024).toFixed(1)} KB</p>}
            </div>
            <a
              href={att.url}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-md text-ink-400 hover:bg-ink-100 hover:text-blue-600 transition"
              title="Open in new tab"
            >
              <Eye size={13} />
            </a>
          </div>
        ))}
      </div>

      {previewUrl && (
        <div
          className="fixed inset-0 z-[999] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <button
              type="button"
              onClick={() => setPreviewUrl(null)}
              className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-white text-ink-800 flex items-center justify-center shadow-lg hover:bg-ink-100 z-10"
            >
              <X size={16} />
            </button>
            <img
              src={previewUrl}
              alt="Receipt preview"
              className="max-h-[85vh] max-w-full rounded-xl shadow-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}
