import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Trash2,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Info,
  Film,
  Image as ImageIcon,
  Music,
  FileText,
  File,
  ExternalLink,
  Play,
  RotateCcw,
} from 'lucide-react';

/**
 * High-performance, touch-gestured Media Lightbox for Photos, Videos, and Documents
 * Supports:
 * - Touch swipe left/right to move smoothly between media
 * - Swipe down to dismiss
 * - Keyboard navigation (Left, Right, Escape)
 * - Double-tap / Click zoom for photos
 * - Bottom thumbnail filmstrip scrubber with auto-centering
 * - Real-time slide transitions
 * - Background preloading of adjacent images
 * - Mobile-optimized fullscreen layout
 */
export default function MediaLightbox({
  files = [],
  activeFile = null,
  onClose,
  onSelectFile,
  getStreamUrl,
  getFileType,
  formatBytes,
  formatDate,
  handleDownload,
  handleDelete,
  downloading = false,
  downloadProgress = 0,
  downloadSpeed = '',
}) {
  const [slideDirection, setSlideDirection] = useState(null); // 'next' | 'prev' | null
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = fit, 2 = 2x zoom
  const [showInfo, setShowInfo] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showFilmstrip, setShowFilmstrip] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMediaLoaded, setIsMediaLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Touch swipe gesture tracking
  const [touchDelta, setTouchDelta] = useState({ x: 0, y: 0 });
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
  const lastTapRef = useRef(0);

  const containerRef = useRef(null);
  const filmstripRef = useRef(null);
  const activeThumbRef = useRef(null);
  const videoRef = useRef(null);

  // Determine index of current file in the active list
  const currentIndex = files.findIndex(
    (f) =>
      (f.id && activeFile?.id && f.id === activeFile.id) ||
      f.telegramMessageId === activeFile?.telegramMessageId
  );

  const currentFile = currentIndex >= 0 ? files[currentIndex] : activeFile;
  const hasNext = currentIndex >= 0 && currentIndex < files.length - 1;
  const hasPrev = currentIndex > 0;
  const fileType = currentFile ? getFileType(currentFile) : 'document';
  const streamUrl = currentFile ? getStreamUrl(currentFile.telegramMessageId) : '';

  // Reset zoom and load state when file changes
  useEffect(() => {
    setZoomLevel(1);
    setIsMediaLoaded(false);
    setLoadError(false);
    setTouchDelta({ x: 0, y: 0 });
  }, [currentFile?.telegramMessageId]);

  // Navigate to Next item
  const goToNext = useCallback(() => {
    if (!hasNext) return;
    setSlideDirection('next');
    onSelectFile(files[currentIndex + 1]);
  }, [hasNext, currentIndex, files, onSelectFile]);

  // Navigate to Previous item
  const goToPrev = useCallback(() => {
    if (!hasPrev) return;
    setSlideDirection('prev');
    onSelectFile(files[currentIndex - 1]);
  }, [hasPrev, currentIndex, files, onSelectFile]);

  // Preload adjacent images for instantaneous transitions
  useEffect(() => {
    if (currentIndex < 0) return;

    const preloadImage = (file) => {
      if (file && getFileType(file) === 'image') {
        const img = new window.Image();
        img.src = getStreamUrl(file.telegramMessageId);
      }
    };

    if (hasNext) preloadImage(files[currentIndex + 1]);
    if (hasPrev) preloadImage(files[currentIndex - 1]);
  }, [currentIndex, files, hasNext, hasPrev, getFileType, getStreamUrl]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      } else if (e.key === 'ArrowLeft') {
        goToPrev();
      } else if (e.key === 'i' || e.key === 'I') {
        setShowInfo((prev) => !prev);
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrev, onClose]);

  // Auto-scroll filmstrip to keep active item in center
  useEffect(() => {
    if (activeThumbRef.current && filmstripRef.current) {
      activeThumbRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [currentIndex]);

  // Toggle Fullscreen API
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Toggle Zoom Level (fit vs 2x)
  const toggleZoom = () => {
    if (fileType !== 'image') return;
    setZoomLevel((prev) => (prev === 1 ? 2 : 1));
  };

  // Double-tap on mobile to zoom
  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      toggleZoom();
    } else {
      // Single tap toggles control visibility
      setShowControls((prev) => !prev);
    }
    lastTapRef.current = now;
  };

  // Touch gesture handlers for mobile swipe
  const handleTouchStart = (e) => {
    if (zoomLevel > 1) return; // Allow natural pan when zoomed
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
    setIsSwiping(true);
  };

  const handleTouchMove = (e) => {
    if (!isSwiping || zoomLevel > 1) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;

    // Apply friction/resistance at boundaries
    let adjustedDx = dx;
    if ((!hasNext && dx < 0) || (!hasPrev && dx > 0)) {
      adjustedDx = dx * 0.25;
    }

    setTouchDelta({ x: adjustedDx, y: dy });
  };

  const handleTouchEnd = () => {
    if (!isSwiping || zoomLevel > 1) return;
    setIsSwiping(false);

    const { x: dx, y: dy } = touchDelta;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const timeElapsed = Date.now() - touchStartRef.current.time;
    const velocityX = absDx / (timeElapsed || 1);

    // 1. Swipe Down to Close
    if (dy > 90 && absDy > absDx * 1.3) {
      onClose();
      return;
    }

    // 2. Horizontal Swipe Navigation (threshold 45px or quick flick)
    if (absDx > 45 || velocityX > 0.4) {
      if (dx < 0 && hasNext) {
        goToNext();
      } else if (dx > 0 && hasPrev) {
        goToPrev();
      }
    }

    setTouchDelta({ x: 0, y: 0 });
  };

  if (!currentFile) return null;

  // Compute transform style for swipe dragging animation
  const mediaTransform = isSwiping
    ? `translate3d(${touchDelta.x}px, ${Math.max(0, touchDelta.y * 0.4)}px, 0) scale(${
        zoomLevel > 1 ? zoomLevel : Math.max(0.9, 1 - Math.abs(touchDelta.y) / 800)
      })`
    : `translate3d(0, 0, 0) scale(${zoomLevel})`;

  const backdropOpacity = isSwiping
    ? Math.max(0.4, 1 - Math.abs(touchDelta.y) / 400)
    : 1;

  return (
    <div
      ref={containerRef}
      style={{ backgroundColor: `rgba(2, 6, 23, ${backdropOpacity * 0.96})` }}
      className="fixed inset-0 z-50 flex flex-col justify-between backdrop-blur-2xl select-none overflow-hidden transition-colors duration-150"
    >
      {/* 1. TOP HEADER TOOLBAR */}
      <div
        className={`relative z-20 flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3.5 bg-gradient-to-b from-slate-950/90 via-slate-950/60 to-transparent text-white transition-all duration-300 ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'
        }`}
      >
        {/* Left: Back / Close & Counter */}
        <div className="flex items-center gap-3 truncate pr-2">
          <button
            onClick={onClose}
            className="p-2 -ml-1 text-slate-300 hover:text-white hover:bg-white/10 rounded-full transition-colors active:scale-95"
            title="Close (Esc)"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          <div className="flex items-center gap-2 truncate">
            {fileType === 'video' && <Film className="w-4 h-4 text-purple-400 shrink-0" />}
            {fileType === 'image' && <ImageIcon className="w-4 h-4 text-blue-400 shrink-0" />}
            {fileType === 'audio' && <Music className="w-4 h-4 text-emerald-400 shrink-0" />}
            {fileType === 'pdf' && <FileText className="w-4 h-4 text-rose-400 shrink-0" />}
            {fileType === 'document' && <File className="w-4 h-4 text-amber-400 shrink-0" />}

            <div className="flex flex-col truncate">
              <span className="text-xs sm:text-sm font-semibold truncate text-slate-100 max-w-[160px] sm:max-w-md">
                {currentFile.fileName}
              </span>
              {files.length > 1 && (
                <span className="text-[11px] text-slate-400 font-mono">
                  {currentIndex + 1} of {files.length}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions (Zoom, Download, Info, Delete, Fullscreen) */}
        <div className="flex items-center gap-1 sm:gap-2">
          {fileType === 'image' && (
            <button
              onClick={toggleZoom}
              className={`p-2 rounded-xl transition-colors hidden sm:flex ${
                zoomLevel > 1 ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-white/10'
              }`}
              title={zoomLevel > 1 ? 'Reset Zoom' : 'Zoom In (2x)'}
            >
              {zoomLevel > 1 ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
            </button>
          )}

          <button
            onClick={() => handleDownload(currentFile.telegramMessageId, currentFile.fileName)}
            disabled={downloading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 active:scale-95 rounded-full transition-all border border-white/10 shadow-sm"
            title="Download original file"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {downloading ? `${downloadProgress}% • ${downloadSpeed}` : 'Download'}
            </span>
          </button>

          <button
            onClick={() => setShowInfo((prev) => !prev)}
            className={`p-2 rounded-full transition-colors ${
              showInfo ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-white/10'
            }`}
            title="File details"
          >
            <Info className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-full transition-colors hidden sm:flex"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={() => handleDelete(currentFile.telegramMessageId, currentFile.fileName)}
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-full transition-colors"
            title="Delete file"
          >
            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      {/* 2. MAIN MEDIA STAGE WITH SWIPE & SLIDE GESTURES */}
      <div
        className="relative flex-1 flex items-center justify-center w-full h-full overflow-hidden touch-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleDoubleTap}
      >
        {/* Desktop Previous Chevron Button */}
        {hasPrev && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              goToPrev();
            }}
            className={`absolute left-3 sm:left-6 z-30 p-3 sm:p-4 rounded-full bg-slate-900/60 hover:bg-slate-900/90 text-white/80 hover:text-white backdrop-blur-md border border-white/10 shadow-2xl transition-all active:scale-90 hover:scale-105 hidden sm:flex items-center justify-center ${
              showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            title="Previous (Left Arrow)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Desktop Next Chevron Button */}
        {hasNext && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            className={`absolute right-3 sm:right-6 z-30 p-3 sm:p-4 rounded-full bg-slate-900/60 hover:bg-slate-900/90 text-white/80 hover:text-white backdrop-blur-md border border-white/10 shadow-2xl transition-all active:scale-90 hover:scale-105 hidden sm:flex items-center justify-center ${
              showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            title="Next (Right Arrow)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* Active Media Container with Real-time Gesture Transform */}
        <div
          style={{
            transform: mediaTransform,
            transition: isSwiping ? 'none' : 'transform 0.28s cubic-bezier(0.2, 0.9, 0.3, 1)',
          }}
          className="relative max-w-full max-h-full flex items-center justify-center p-2 sm:p-8"
        >
          {/* Loading Indicator */}
          {!isMediaLoaded && !loadError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2">
              <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
              <span className="text-xs font-medium">Buffering from Telegram...</span>
            </div>
          )}

          {/* Load Error Fallback */}
          {loadError && (
            <div className="flex flex-col items-center text-center p-6 bg-slate-900/80 rounded-2xl border border-slate-800 text-slate-300 max-w-sm">
              <RotateCcw className="w-8 h-8 text-amber-400 mb-2" />
              <p className="text-sm font-semibold mb-1">Failed to load media</p>
              <p className="text-xs text-slate-500 mb-4">Connection to Telegram MTProto timed out.</p>
              <button
                onClick={() => {
                  setLoadError(false);
                  setIsMediaLoaded(false);
                }}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl"
              >
                Retry
              </button>
            </div>
          )}

          {/* 1. Photo Viewer */}
          {fileType === 'image' && (
            <img
              key={currentFile.telegramMessageId}
              src={streamUrl}
              alt={currentFile.fileName}
              onLoad={() => setIsMediaLoaded(true)}
              onError={() => {
                setIsMediaLoaded(true);
                setLoadError(true);
              }}
              draggable={false}
              className={`max-w-full max-h-[78vh] sm:max-h-[82vh] w-auto h-auto object-contain rounded-xl sm:rounded-2xl shadow-2xl cursor-zoom-in transition-opacity duration-300 ${
                isMediaLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          )}

          {/* 2. Video Player */}
          {fileType === 'video' && (
            <video
              ref={videoRef}
              key={currentFile.telegramMessageId}
              src={streamUrl}
              controls
              autoPlay
              playsInline
              onLoadedData={() => setIsMediaLoaded(true)}
              onError={() => {
                setIsMediaLoaded(true);
                setLoadError(true);
              }}
              className="max-w-full max-h-[78vh] sm:max-h-[82vh] w-auto h-auto rounded-xl sm:rounded-2xl shadow-2xl bg-black"
            />
          )}

          {/* 3. Audio Player */}
          {fileType === 'audio' && (
            <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 p-8 rounded-3xl flex flex-col items-center text-center shadow-2xl">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/30">
                <Music className="w-10 h-10 animate-pulse" />
              </div>
              <h4 className="font-bold text-white text-base mb-1 truncate max-w-xs">
                {currentFile.fileName}
              </h4>
              <p className="text-xs text-emerald-400 mb-6 font-mono">
                {formatBytes(currentFile.size)} • {currentFile.mimeType}
              </p>
              <audio
                src={streamUrl}
                controls
                autoPlay
                onLoadedData={() => setIsMediaLoaded(true)}
                className="w-full rounded-xl"
              />
            </div>
          )}

          {/* 4. PDF Document Viewer */}
          {fileType === 'pdf' && (
            <div className="w-[92vw] sm:w-[80vw] max-w-5xl h-[75vh] flex flex-col items-center justify-center bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
              <iframe
                src={streamUrl}
                title={currentFile.fileName}
                onLoad={() => setIsMediaLoaded(true)}
                className="w-full h-full rounded-2xl"
              />
            </div>
          )}

          {/* 5. Generic Document Viewer */}
          {fileType === 'document' && (
            <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 p-8 rounded-3xl flex flex-col items-center text-center shadow-2xl">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-600 to-orange-500 text-white flex items-center justify-center mb-5 shadow-lg shadow-amber-500/30">
                <File className="w-10 h-10" />
              </div>
              <h4 className="font-bold text-white text-base mb-1 truncate max-w-xs">
                {currentFile.fileName}
              </h4>
              <p className="text-xs text-amber-400 mb-6 font-mono">
                {formatBytes(currentFile.size)} • {currentFile.mimeType}
              </p>
              <button
                onClick={() => handleDownload(currentFile.telegramMessageId, currentFile.fileName)}
                className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-2xl flex items-center gap-2 shadow-lg transition-transform active:scale-95"
              >
                <Download className="w-4 h-4" /> Download Document
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. METADATA INFO DRAWER */}
      {showInfo && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-0 bottom-0 z-40 w-full sm:w-80 bg-slate-950/95 backdrop-blur-2xl border-l border-slate-800 p-6 flex flex-col justify-between animate-in slide-in-from-right duration-200 text-white"
        >
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-400" /> File Info
              </h3>
              <button
                onClick={() => setShowInfo(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-4 text-xs">
              <div>
                <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                  File Name
                </span>
                <p className="text-slate-200 font-medium break-all mt-0.5">{currentFile.fileName}</p>
              </div>

              <div>
                <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                  Size
                </span>
                <p className="text-slate-200 font-medium mt-0.5">{formatBytes(currentFile.size)}</p>
              </div>

              <div>
                <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                  Format / MIME
                </span>
                <p className="text-slate-200 font-mono text-[11px] mt-0.5">{currentFile.mimeType}</p>
              </div>

              <div>
                <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                  Uploaded Date
                </span>
                <p className="text-slate-200 font-medium mt-0.5">
                  {formatDate(currentFile.createdAt || currentFile.uploadDate)}
                </p>
              </div>

              <div>
                <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                  Telegram Message ID
                </span>
                <p className="text-blue-400 font-mono text-[11px] mt-0.5">
                  #{currentFile.telegramMessageId}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex flex-col gap-2">
            <a
              href={streamUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 rounded-xl text-xs font-semibold text-blue-400 flex items-center justify-center gap-2 border border-slate-800 transition-colors"
            >
              <span>Direct Telegram Stream</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* 4. BOTTOM THUMBNAIL FILMSTRIP SCRUBBER */}
      {files.length > 1 && (
        <div
          className={`relative z-20 px-3 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-t from-slate-950/95 via-slate-950/80 to-transparent transition-all duration-300 ${
            showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full pointer-events-none'
          }`}
        >
          <div
            ref={filmstripRef}
            className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 scroll-smooth max-w-4xl mx-auto"
          >
            {files.map((file, idx) => {
              const isSelected = idx === currentIndex;
              const type = getFileType(file);
              const thumbUrl = getStreamUrl(file.telegramMessageId);

              return (
                <button
                  key={file.id || file.telegramMessageId || idx}
                  ref={isSelected ? activeThumbRef : null}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSlideDirection(idx > currentIndex ? 'next' : 'prev');
                    onSelectFile(file);
                  }}
                  className={`relative shrink-0 w-11 h-11 sm:w-14 sm:h-14 rounded-xl overflow-hidden transition-all duration-200 border-2 ${
                    isSelected
                      ? 'border-blue-500 scale-105 ring-2 ring-blue-500/40 opacity-100 shadow-lg'
                      : 'border-transparent opacity-45 hover:opacity-85'
                  }`}
                >
                  {type === 'image' && (
                    <img
                      src={thumbUrl}
                      alt={file.fileName}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  )}
                  {type === 'video' && (
                    <div className="w-full h-full bg-slate-800 flex items-center justify-center text-purple-400">
                      <Film className="w-4 h-4" />
                    </div>
                  )}
                  {type === 'audio' && (
                    <div className="w-full h-full bg-slate-800 flex items-center justify-center text-emerald-400">
                      <Music className="w-4 h-4" />
                    </div>
                  )}
                  {type === 'pdf' && (
                    <div className="w-full h-full bg-slate-800 flex items-center justify-center text-rose-400">
                      <FileText className="w-4 h-4" />
                    </div>
                  )}
                  {type === 'document' && (
                    <div className="w-full h-full bg-slate-800 flex items-center justify-center text-amber-400">
                      <File className="w-4 h-4" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
