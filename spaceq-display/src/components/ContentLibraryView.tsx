import React, { useState, useRef } from 'react';
import { uploadToCloudinary } from '../lib/cloudinary';
import { Business, ContentItem, ContentType, TransitionEffect, PageContent, PageTemplateId, PAGE_THEMES } from '../types';
import { useAuth } from '../context/AuthContext';
import { can } from '../lib/permissions';
import { toYouTubeEmbedUrl } from '../lib/youtubeEmbed';
import { PageContentRenderer } from './PageContentRenderer';
import {
  FolderOpen,
  Image as ImageIcon,
  Video,
  Globe,
  Youtube,
  FileText,
  Plus,
  Trash2,
  Tag,
  Clock,
  Eye,
  Search,
  UploadCloud,
  Loader2,
  Link as LinkIcon,
  CheckCircle2,
  Megaphone,
  Tag as TagIcon,
  ListOrdered,
  Quote as QuoteIcon,
  X,
  Sparkles
} from 'lucide-react';

interface ContentLibraryViewProps {
  contents: ContentItem[];
  selectedBusiness: Business;
  onAddContent: (title: string, type: ContentType, url: string, durationSeconds: number, tags: string[], fileSizeBytes?: number, transitionEffect?: TransitionEffect, pageContent?: PageContent) => void;
  onDeleteContent: (id: string) => void;
  darkMode: boolean;
}

export const ContentLibraryView: React.FC<ContentLibraryViewProps> = ({
  contents,
  selectedBusiness,
  onAddContent,
  onDeleteContent,
  darkMode,
}) => {
  const { userProfile } = useAuth();
  const canManage = can(userProfile?.role, 'manageContent');

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ContentType>('IMAGE');
  const [url, setUrl] = useState('');
  const [durationSeconds, setDurationSeconds] = useState(10);
  const [transitionEffect, setTransitionEffect] = useState<TransitionEffect>('FADE');
  const [tagsInput, setTagsInput] = useState('');
  const [uploadedFileSize, setUploadedFileSize] = useState<number | undefined>(undefined);

  // Real file upload state
  const [assetMode, setAssetMode] = useState<'UPLOAD' | 'URL'>('UPLOAD');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bulk upload — kicks in automatically when more than one file is
  // selected/dropped at once. Each file uploads with its own progress,
  // auto-titled from its filename, sharing the duration/transition/tags
  // chosen in the form. Saved to the library as each one finishes, rather
  // than waiting for all of them.
  interface BulkFile {
    id: string;
    file: File;
    status: 'pending' | 'uploading' | 'done' | 'error';
    progress: number;
    error?: string;
  }
  const [bulkFiles, setBulkFiles] = useState<BulkFile[]>([]);
  const isBulkMode = bulkFiles.length > 0;

  // --- No-code page builder state (type === 'TEMPLATE') ---
  const [pageTemplateId, setPageTemplateId] = useState<PageTemplateId>('ANNOUNCEMENT');
  const [pageThemeId, setPageThemeId] = useState(PAGE_THEMES[0].id);
  const [pageHeadline, setPageHeadline] = useState('');
  const [pageSubheading, setPageSubheading] = useState('');
  const [pageBodyText, setPageBodyText] = useState('');
  const [pageBadgeText, setPageBadgeText] = useState('');
  const [pageAttribution, setPageAttribution] = useState('');
  const [pageImageUrl, setPageImageUrl] = useState('');
  const [pageImageUploading, setPageImageUploading] = useState(false);
  const [pageMenuItems, setPageMenuItems] = useState<{ label: string; price: string }[]>([{ label: '', price: '' }]);
  const pageImageInputRef = useRef<HTMLInputElement>(null);

  const currentPageContent = (): PageContent => ({
    templateId: pageTemplateId,
    themeId: pageThemeId,
    headline: pageHeadline || undefined,
    subheading: pageSubheading || undefined,
    bodyText: pageBodyText || undefined,
    badgeText: pageBadgeText || undefined,
    attribution: pageAttribution || undefined,
    imageUrl: pageImageUrl || undefined,
    items: pageTemplateId === 'MENU' ? pageMenuItems.filter(it => it.label.trim()) : undefined,
  });

  const handlePageImageSelected = async (file: File | undefined) => {
    if (!file) return;
    setPageImageUploading(true);
    try {
      const { url: uploadedUrl } = await uploadToCloudinary(file, () => {});
      setPageImageUrl(uploadedUrl);
    } catch (err) {
      console.warn('Page image upload failed:', err);
    } finally {
      setPageImageUploading(false);
    }
  };

  const [previewItem, setPreviewItem] = useState<ContentItem | null>(null);

  const isUploadableType = type === 'IMAGE' || type === 'VIDEO';

  const resetForm = () => {
    setTitle('');
    setUrl('');
    setTagsInput('');
    setUploadedFileSize(undefined);
    setUploadedFileName('');
    setUploadProgress(0);
    setUploadError('');
    setIsUploading(false);
    setTransitionEffect('FADE');
    setBulkFiles([]);
    setPageTemplateId('ANNOUNCEMENT');
    setPageThemeId(PAGE_THEMES[0].id);
    setPageHeadline('');
    setPageSubheading('');
    setPageBodyText('');
    setPageBadgeText('');
    setPageAttribution('');
    setPageImageUrl('');
    setPageMenuItems([{ label: '', price: '' }]);
  };

  const handleFilesSelected = (fileList: FileList | File[] | undefined) => {
    if (!fileList) return;
    const files = Array.from(fileList);
    if (files.length === 0) return;
    if (files.length === 1) {
      handleFileSelected(files[0]);
      return;
    }
    runBulkUpload(files);
  };

  const runBulkUpload = async (files: File[]) => {
    setUploadError('');
    const valid = files.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    const skipped = files.length - valid.length;
    if (skipped > 0) setUploadError(`Skipped ${skipped} file(s) that weren't images or videos.`);

    const queue: BulkFile[] = valid.map(f => ({
      id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 8)}`,
      file: f,
      status: 'pending',
      progress: 0,
    }));
    setBulkFiles(queue);

    // Sequential, not parallel — keeps Cloudinary/browser load predictable
    // and progress readable, especially for a handful of large videos.
    for (const item of queue) {
      setBulkFiles(prev => prev.map(f => (f.id === item.id ? { ...f, status: 'uploading' } : f)));
      try {
        const { url: uploadedUrl, bytes } = await uploadToCloudinary(item.file, (percent) => {
          setBulkFiles(prev => prev.map(f => (f.id === item.id ? { ...f, progress: percent } : f)));
        });
        const isImage = item.file.type.startsWith('image/');
        const autoTitle = item.file.name.replace(/\.[^/.]+$/, '');
        const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
        onAddContent(autoTitle, isImage ? 'IMAGE' : 'VIDEO', uploadedUrl, durationSeconds, tags, bytes, transitionEffect);
        setBulkFiles(prev => prev.map(f => (f.id === item.id ? { ...f, status: 'done', progress: 100 } : f)));
      } catch (err: any) {
        setBulkFiles(prev => prev.map(f => (f.id === item.id ? { ...f, status: 'error', error: err?.message || 'Upload failed' } : f)));
      }
    }
  };

  const handleFileSelected = (file: File | undefined) => {
    if (!file) return;
    setUploadError('');

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) {
      setUploadError('Only image or video files can be uploaded here.');
      return;
    }
    if (file.size > 1024 * 1024 * 1024) {
      setUploadError('File is too large (max 200MB).');
      return;
    }

    setType(isImage ? 'IMAGE' : 'VIDEO');
    if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ''));

    setIsUploading(true);
    setUploadProgress(0);

    uploadToCloudinary(file, (percent) => setUploadProgress(percent))
      .then(({ url: uploadedUrl, bytes }) => {
        setUrl(uploadedUrl);
        setUploadedFileSize(bytes);
        setUploadedFileName(file.name);
      })
      .catch((err: any) => {
        console.error('Upload failed:', err);
        setUploadError(err?.message || 'Upload failed. Please try again.');
      })
      .finally(() => {
        setIsUploading(false);
      });
  };

  const filteredContents = contents
    .filter(c => c.businessId === selectedBusiness.id)
    .filter(c => selectedTypeFilter === 'ALL' || c.type === selectedTypeFilter)
    .filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()) || c.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (type === 'TEMPLATE') {
      if (!title) return;
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      onAddContent(title, type, '', durationSeconds, tags, undefined, transitionEffect, currentPageContent());
      resetForm();
      setShowAddModal(false);
      return;
    }
    if (!title || !url) return;
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    onAddContent(title, type, url, durationSeconds, tags, uploadedFileSize, transitionEffect);
    resetForm();
    setShowAddModal(false);
  };

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Content Asset Library</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Cloud media asset repository for {selectedBusiness.name}. Assets are auto-compressed and distributed to edge display players.
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Media Asset
          </button>
        )}
      </div>

      {/* Filter Bar & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {['ALL', 'IMAGE', 'VIDEO', 'WEBSITE', 'YOUTUBE', 'PDF'].map((filter) => (
            <button
              key={filter}
              onClick={() => setSelectedTypeFilter(filter)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                selectedTypeFilter === filter
                  ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                  : darkMode
                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search media & tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border outline-none ${
              darkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
            }`}
          />
        </div>
      </div>

      {/* Media Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredContents.map((item) => (
          <div
            key={item.id}
            className={`group rounded-2xl border overflow-hidden flex flex-col justify-between transition-all ${
              darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            {/* Thumbnail Box */}
            <div className="relative aspect-video bg-slate-950 flex items-center justify-center overflow-hidden">
              {item.type === 'IMAGE' ? (
                <img
                  src={item.url}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : item.type === 'VIDEO' ? (
                <video
                  src={item.url}
                  className="w-full h-full object-cover"
                  muted
                  loop
                  onMouseOver={(e) => e.currentTarget.play()}
                  onMouseOut={(e) => e.currentTarget.pause()}
                />
              ) : item.type === 'TEMPLATE' && item.pageContent ? (
                <div className="w-full h-full pointer-events-none">
                  <PageContentRenderer page={item.pageContent} />
                </div>
              ) : (
                <div className="p-4 text-center text-slate-400 space-y-2">
                  {item.type === 'YOUTUBE' ? <Youtube className="w-10 h-10 mx-auto text-red-500" /> : <Globe className="w-10 h-10 mx-auto text-blue-500" />}
                  <p className="text-xs font-mono truncate max-w-[200px]">{item.url}</p>
                </div>
              )}

              {/* Type Badge Overlay */}
              <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-950/80 text-white backdrop-blur-md border border-white/10">
                {item.type}
              </span>

              {/* Duration Badge Overlay */}
              <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-950/80 text-white backdrop-blur-md flex items-center gap-1">
                <Clock className="w-3 h-3 text-rose-400" /> {item.durationSeconds}s
              </span>
            </div>

            {/* Details */}
            <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold truncate">{item.title}</h3>
                <div className="flex flex-wrap gap-1 mt-2">
                  {item.tags.map((tag, idx) => (
                    <span key={idx} className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <button
                  onClick={() => setPreviewItem(item)}
                  className="flex items-center gap-1 hover:text-rose-500 transition-colors font-medium text-[11px]"
                >
                  <Eye className="w-3.5 h-3.5" /> Preview Asset
                </button>

                {canManage && (
                <button
                  onClick={() => onDeleteContent(item.id)}
                  className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Content Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-lg p-6 rounded-2xl border space-y-5 ${
            darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <h3 className="text-base font-bold">Add New Media Asset</h3>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Media Type</label>
                <select
                  value={type}
                  onChange={(e) => { setType(e.target.value as ContentType); setUrl(''); setUploadedFileSize(undefined); setUploadedFileName(''); setUploadError(''); }}
                  className={`w-full p-2.5 rounded-xl border outline-none ${
                    darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <option value="IMAGE">Image (JPG/PNG/WebP)</option>
                  <option value="VIDEO">MP4 Video</option>
                  <option value="TEMPLATE">Design a Page (no coding needed)</option>
                  <option value="WEBSITE">Live Web Page URL</option>
                  <option value="YOUTUBE">YouTube Stream Embed</option>
                  <option value="CANVA">Canva Embed</option>
                  <option value="PDF">PDF Notice/Document</option>
                </select>
              </div>

              {type === 'TEMPLATE' ? (
                <PageBuilderForm
                  darkMode={darkMode}
                  templateId={pageTemplateId}
                  onTemplateChange={setPageTemplateId}
                  themeId={pageThemeId}
                  onThemeChange={setPageThemeId}
                  headline={pageHeadline}
                  onHeadlineChange={setPageHeadline}
                  subheading={pageSubheading}
                  onSubheadingChange={setPageSubheading}
                  bodyText={pageBodyText}
                  onBodyTextChange={setPageBodyText}
                  badgeText={pageBadgeText}
                  onBadgeTextChange={setPageBadgeText}
                  attribution={pageAttribution}
                  onAttributionChange={setPageAttribution}
                  imageUrl={pageImageUrl}
                  onImageUploaded={handlePageImageSelected}
                  imageUploading={pageImageUploading}
                  onRemoveImage={() => setPageImageUrl('')}
                  menuItems={pageMenuItems}
                  onMenuItemsChange={setPageMenuItems}
                  preview={currentPageContent()}
                />
              ) : isUploadableType ? (
                <div className="space-y-2">
                  <div className="flex rounded-xl overflow-hidden border border-slate-700 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setAssetMode('UPLOAD')}
                      className={`flex-1 py-2 flex items-center justify-center gap-1.5 transition-colors ${
                        assetMode === 'UPLOAD' ? 'bg-rose-600 text-white' : darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <UploadCloud className="w-3.5 h-3.5" /> Upload File
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssetMode('URL')}
                      className={`flex-1 py-2 flex items-center justify-center gap-1.5 transition-colors ${
                        assetMode === 'URL' ? 'bg-rose-600 text-white' : darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <LinkIcon className="w-3.5 h-3.5" /> Paste URL Instead
                    </button>
                  </div>

                  {assetMode === 'UPLOAD' ? (
                    <div
                      onClick={() => !isBulkMode && fileInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); if (!isBulkMode) handleFilesSelected(e.dataTransfer.files); }}
                      className={`p-6 rounded-xl border-2 border-dashed text-center transition-colors ${
                        isBulkMode ? 'cursor-default' : 'cursor-pointer'
                      } ${
                        darkMode ? 'border-slate-700 hover:border-rose-500 bg-slate-800/40' : 'border-slate-300 hover:border-rose-500 bg-slate-50'
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleFilesSelected(e.target.files)}
                      />

                      {isBulkMode ? (
                        <div className="space-y-2 text-left">
                          <p className="font-semibold text-slate-300 text-center mb-2">
                            Uploading {bulkFiles.filter(f => f.status === 'done').length} of {bulkFiles.length} files
                          </p>
                          <div className="max-h-40 overflow-y-auto space-y-1.5">
                            {bulkFiles.map(f => (
                              <div key={f.id} className={`p-2 rounded-lg text-[11px] ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate flex-1 text-left">{f.file.name}</span>
                                  {f.status === 'done' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                                  {f.status === 'error' && <span className="text-rose-500 shrink-0">Failed</span>}
                                  {f.status === 'uploading' && <span className="text-slate-400 shrink-0">{f.progress}%</span>}
                                </div>
                                {f.status === 'uploading' && (
                                  <div className="w-full h-1 rounded-full bg-slate-700 overflow-hidden mt-1.5">
                                    <div className="h-full bg-rose-500 transition-all" style={{ width: `${f.progress}%` }} />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : isUploading ? (
                        <div className="space-y-2">
                          <Loader2 className="w-6 h-6 mx-auto text-rose-500 animate-spin" />
                          <p className="font-semibold">Uploading… {uploadProgress}%</p>
                          <div className="w-full h-1.5 rounded-full bg-slate-700 overflow-hidden">
                            <div className="h-full bg-rose-500 transition-all" style={{ width: `${uploadProgress}%` }} />
                          </div>
                        </div>
                      ) : uploadedFileName ? (
                        <div className="space-y-1 text-emerald-400">
                          <CheckCircle2 className="w-6 h-6 mx-auto" />
                          <p className="font-semibold truncate">{uploadedFileName}</p>
                          <p className="text-slate-400">Click to replace</p>
                        </div>
                      ) : (
                        <div className="space-y-1 text-slate-400">
                          <UploadCloud className="w-6 h-6 mx-auto" />
                          <p className="font-semibold text-slate-300">Click to choose files or drag them here</p>
                          <p>Images or videos, up to 1GB each. Select multiple to bulk upload.</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <input
                      type="url"
                      required
                      placeholder="https://your-cdn.com/asset.jpg"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className={`w-full p-2.5 rounded-xl border outline-none font-mono text-[11px] ${
                        darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                      }`}
                    />
                  )}

                  {uploadError && (
                    <p className="text-rose-500 font-medium">{uploadError}</p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">
                    {type === 'YOUTUBE' ? 'YouTube Video URL' : type === 'WEBSITE' ? 'Live Web Page URL' : 'Document URL'}
                  </label>
                  <input
                    type="url"
                    required
                    placeholder={type === 'YOUTUBE' ? 'https://www.youtube.com/watch?v=... or youtu.be/...' : 'https://example.com/...'}
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border outline-none font-mono text-[11px] ${
                      darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                  {type === 'YOUTUBE' && url && (
                    toYouTubeEmbedUrl(url) ? (
                      <p className="text-emerald-500 text-[11px] mt-1.5 font-medium">✓ Looks good — this video will play on your displays.</p>
                    ) : (
                      <p className="text-amber-500 text-[11px] mt-1.5 font-medium">Couldn't find a video ID in that link — double check it's a real YouTube URL.</p>
                    )
                  )}
                </div>
              )}

              {!isBulkMode && (
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Asset Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Morning Special Offer Flyer"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border outline-none ${
                    darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>
              )}

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Default Duration (Seconds)</label>
                <input
                  type="number"
                  min={3}
                  max={300}
                  value={durationSeconds}
                  onChange={(e) => setDurationSeconds(Number(e.target.value))}
                  className={`w-full p-2.5 rounded-xl border outline-none ${
                    darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              {(type === 'IMAGE' || type === 'TEMPLATE') && (
                <div>
                  <label className="block text-slate-400 mb-1.5 font-medium">Transition</label>
                  <div className="grid grid-cols-4 gap-2">
                    {([
                      { value: 'FADE', label: 'Fade' },
                      { value: 'SLIDE', label: 'Slide' },
                      { value: 'ZOOM', label: 'Zoom' },
                      { value: 'NONE', label: 'None' },
                    ] as { value: TransitionEffect; label: string }[]).map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setTransitionEffect(opt.value)}
                        className={`py-2 rounded-xl border text-[11px] font-bold transition-colors ${
                          transitionEffect === opt.value
                            ? 'border-rose-500 bg-rose-500/10 text-rose-500'
                            : darkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Zoom plays a slow Ken Burns-style zoom for the whole slide duration.</p>
                </div>
              )}

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Tags (Comma Separated)</label>
                <input
                  type="text"
                  placeholder="Breakfast, Promotions, Special"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border outline-none ${
                    darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                {isBulkMode ? (
                  <button
                    type="button"
                    onClick={() => { resetForm(); setShowAddModal(false); }}
                    disabled={bulkFiles.some(f => f.status === 'pending' || f.status === 'uploading')}
                    className="px-5 py-2 rounded-xl bg-rose-600 text-white font-semibold shadow-sm disabled:opacity-50"
                  >
                    {bulkFiles.some(f => f.status === 'pending' || f.status === 'uploading') ? 'Uploading…' : 'Done'}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => { resetForm(); setShowAddModal(false); }}
                      className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isUploading || !title || (type !== 'TEMPLATE' && !url)}
                      className="px-5 py-2 rounded-xl bg-rose-600 text-white font-semibold shadow-sm disabled:opacity-50"
                    >
                      Save Asset
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Asset Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-3xl p-6 rounded-3xl bg-slate-900 border border-slate-800 text-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">{previewItem.title}</h3>
              <button
                onClick={() => setPreviewItem(null)}
                className="px-3 py-1 rounded-lg bg-slate-800 text-xs font-semibold text-slate-300"
              >
                Close Preview
              </button>
            </div>

            <div className="aspect-video bg-black rounded-2xl overflow-hidden flex items-center justify-center">
              {previewItem.type === 'IMAGE' ? (
                <img src={previewItem.url} alt={previewItem.title} className="w-full h-full object-contain" />
              ) : previewItem.type === 'VIDEO' ? (
                <video src={previewItem.url} controls autoPlay className="w-full h-full object-contain" />
              ) : (
                <iframe src={previewItem.url} className="w-full h-full border-0" title="Web Preview" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/** The no-code page builder: pick a layout, pick a curated color theme,
 * fill in a few plain-language fields, see the exact result update live.
 * No fonts, no pixel positioning, no hex codes — every choice is a button. */
const TEMPLATE_OPTIONS: { id: PageTemplateId; label: string; icon: React.ReactNode; hint: string }[] = [
  { id: 'ANNOUNCEMENT', label: 'Announcement', icon: <Megaphone className="w-4 h-4" />, hint: 'A big headline with a subtitle — good for anything you want people to notice.' },
  { id: 'OFFER', label: 'Offer', icon: <TagIcon className="w-4 h-4" />, hint: 'Headline plus a callout badge — good for discounts and promotions.' },
  { id: 'MENU', label: 'Menu / Price List', icon: <ListOrdered className="w-4 h-4" />, hint: 'A clean list of items with prices.' },
  { id: 'QUOTE', label: 'Quote', icon: <QuoteIcon className="w-4 h-4" />, hint: 'A centered quote with an attribution line.' },
];

const PageBuilderForm: React.FC<{
  darkMode: boolean;
  templateId: PageTemplateId;
  onTemplateChange: (id: PageTemplateId) => void;
  themeId: string;
  onThemeChange: (id: string) => void;
  headline: string;
  onHeadlineChange: (v: string) => void;
  subheading: string;
  onSubheadingChange: (v: string) => void;
  bodyText: string;
  onBodyTextChange: (v: string) => void;
  badgeText: string;
  onBadgeTextChange: (v: string) => void;
  attribution: string;
  onAttributionChange: (v: string) => void;
  imageUrl: string;
  onImageUploaded: (file: File | undefined) => void;
  imageUploading: boolean;
  onRemoveImage: () => void;
  menuItems: { label: string; price: string }[];
  onMenuItemsChange: (items: { label: string; price: string }[]) => void;
  preview: PageContent;
}> = (props) => {
  const {
    darkMode, templateId, onTemplateChange, themeId, onThemeChange,
    headline, onHeadlineChange, subheading, onSubheadingChange,
    bodyText, onBodyTextChange, badgeText, onBadgeTextChange,
    attribution, onAttributionChange, imageUrl, onImageUploaded, imageUploading, onRemoveImage,
    menuItems, onMenuItemsChange, preview,
  } = props;
  const imgInputRef = useRef<HTMLInputElement>(null);

  const inputClass = `w-full p-2.5 rounded-xl border outline-none text-xs ${
    darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
  }`;

  return (
    <div className="space-y-4">
      {/* Live preview — always visible, updates as you type */}
      <div>
        <label className="flex items-center gap-1.5 text-slate-400 mb-1.5 font-medium">
          <Sparkles className="w-3.5 h-3.5" /> Preview
        </label>
        <div className="w-full aspect-video rounded-xl overflow-hidden border border-slate-700 shadow-inner">
          <PageContentRenderer page={preview} />
        </div>
      </div>

      {/* Layout picker */}
      <div>
        <label className="block text-slate-400 mb-1.5 font-medium">Layout</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TEMPLATE_OPTIONS.map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onTemplateChange(opt.id)}
              title={opt.hint}
              className={`p-2.5 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1 transition-colors ${
                templateId === opt.id
                  ? 'border-rose-500 bg-rose-500/10 text-rose-500'
                  : darkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Theme picker */}
      <div>
        <label className="block text-slate-400 mb-1.5 font-medium">Color Theme</label>
        <div className="flex gap-2 flex-wrap">
          {PAGE_THEMES.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => onThemeChange(t.id)}
              title={t.label}
              className={`w-10 h-10 rounded-xl border-2 transition-transform ${themeId === t.id ? 'border-rose-500 scale-110' : 'border-transparent'}`}
              style={{ background: t.bg }}
            />
          ))}
        </div>
      </div>

      {/* Text fields — vary by template */}
      {templateId !== 'QUOTE' && (
        <div>
          <label className="block text-slate-400 mb-1 font-medium">Headline</label>
          <input type="text" value={headline} onChange={(e) => onHeadlineChange(e.target.value)} placeholder="e.g. Now Open on Weekends" className={inputClass} />
        </div>
      )}

      {(templateId === 'ANNOUNCEMENT' || templateId === 'OFFER' || templateId === 'MENU') && (
        <div>
          <label className="block text-slate-400 mb-1 font-medium">Subtitle (optional)</label>
          <input type="text" value={subheading} onChange={(e) => onSubheadingChange(e.target.value)} placeholder="A short supporting line" className={inputClass} />
        </div>
      )}

      {templateId === 'OFFER' && (
        <div>
          <label className="block text-slate-400 mb-1 font-medium">Badge Text</label>
          <input type="text" value={badgeText} onChange={(e) => onBadgeTextChange(e.target.value)} placeholder="e.g. 50% OFF" className={inputClass} />
        </div>
      )}

      {templateId === 'QUOTE' && (
        <>
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Quote</label>
            <textarea value={bodyText} onChange={(e) => onBodyTextChange(e.target.value)} placeholder="Type the quote here" rows={3} className={inputClass} />
          </div>
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Attribution (optional)</label>
            <input type="text" value={attribution} onChange={(e) => onAttributionChange(e.target.value)} placeholder="e.g. Team SpaceQ" className={inputClass} />
          </div>
        </>
      )}

      {templateId === 'MENU' && (
        <div>
          <label className="block text-slate-400 mb-1 font-medium">Items</label>
          <div className="space-y-1.5">
            {menuItems.map((item, i) => (
              <div key={i} className="flex gap-1.5">
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => onMenuItemsChange(menuItems.map((it, idx) => idx === i ? { ...it, label: e.target.value } : it))}
                  placeholder="Item name"
                  className={`${inputClass} flex-1`}
                />
                <input
                  type="text"
                  value={item.price}
                  onChange={(e) => onMenuItemsChange(menuItems.map((it, idx) => idx === i ? { ...it, price: e.target.value } : it))}
                  placeholder="₹199"
                  className={`${inputClass} w-24`}
                />
                <button
                  type="button"
                  onClick={() => onMenuItemsChange(menuItems.filter((_, idx) => idx !== i))}
                  className="px-2 rounded-xl border border-slate-700 text-slate-400 hover:text-rose-500"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onMenuItemsChange([...menuItems, { label: '', price: '' }])}
            className="mt-2 text-[11px] font-bold text-rose-500 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add item
          </button>
        </div>
      )}

      {/* Optional supporting image (Announcement/Offer only) */}
      {(templateId === 'ANNOUNCEMENT' || templateId === 'OFFER') && (
        <div>
          <label className="block text-slate-400 mb-1 font-medium">Background Image (optional)</label>
          {imageUrl ? (
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <CheckCircle2 className="w-4 h-4" /> Image added
              <button type="button" onClick={onRemoveImage} className="text-slate-400 hover:text-rose-500 underline ml-2">Remove</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => imgInputRef.current?.click()}
              disabled={imageUploading}
              className={`w-full p-3 rounded-xl border border-dashed text-xs font-semibold flex items-center justify-center gap-2 ${
                darkMode ? 'border-slate-700 text-slate-400 hover:border-rose-500' : 'border-slate-300 text-slate-500 hover:border-rose-500'
              }`}
            >
              {imageUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              {imageUploading ? 'Uploading…' : 'Add an image'}
            </button>
          )}
          <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onImageUploaded(e.target.files?.[0])} />
        </div>
      )}
    </div>
  );
};

