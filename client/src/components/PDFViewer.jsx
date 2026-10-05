import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RefreshCw,
  FileText,
  AlertCircle,
  Maximize2,
  Minimize2,
} from 'lucide-react';

// Configure Mozilla PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export default function PDFViewer({
  url,
  fileName = 'Document.pdf',
  onLoadSuccess,
  onLoadError,
}) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.1);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pageRendering, setPageRendering] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const renderTaskRef = useRef(null);

  // Load PDF Document
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setErrorMessage('');
    setPdfDoc(null);
    setPageNum(1);

    const loadingTask = pdfjsLib.getDocument({
      url,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/standard_fonts/',
    });

    loadingTask.promise
      .then((pdf) => {
        if (!isCancelled) {
          setPdfDoc(pdf);
          setNumPages(pdf.numPages);
          setLoading(false);
          if (onLoadSuccess) onLoadSuccess(pdf);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error('PDF.js document loading error:', err);
          setErrorMessage('Could not load PDF document from cloud storage.');
          setLoading(false);
          if (onLoadError) onLoadError(err);
        }
      });

    return () => {
      isCancelled = true;
      loadingTask.destroy().catch(() => {});
    };
  }, [url]);

  // Render specific page
  const renderPage = useCallback(
    async (num) => {
      if (!pdfDoc || !canvasRef.current) return;

      try {
        setPageRendering(true);

        // Cancel previous rendering task if running
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const page = await pdfDoc.getPage(num);
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        const viewport = page.getViewport({ scale, rotation });

        // High-DPI screen support (Retina / OLED crisp text)
        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const transform =
          outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

        const renderContext = {
          canvasContext: context,
          transform,
          viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        setPageRendering(false);
      } catch (err) {
        if (err.name !== 'RenderingCancelledException') {
          console.error('PDF Page render error:', err);
        }
        setPageRendering(false);
      }
    },
    [pdfDoc, scale, rotation]
  );

  useEffect(() => {
    if (pdfDoc && pageNum) {
      renderPage(pageNum);
    }
  }, [pdfDoc, pageNum, scale, rotation, renderPage]);

  // Adjust initial scale to fit mobile screen width
  useEffect(() => {
    const autoFitScale = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        if (containerWidth < 600) {
          setScale(Math.max(0.75, (containerWidth - 32) / 600));
        } else {
          setScale(1.2);
        }
      }
    };
    autoFitScale();
    window.addEventListener('resize', autoFitScale);
    return () => window.removeEventListener('resize', autoFitScale);
  }, [pdfDoc]);

  const handlePrevPage = () => {
    if (pageNum > 1) setPageNum((prev) => prev - 1);
  };

  const handleNextPage = () => {
    if (pageNum < numPages) setPageNum((prev) => prev + 1);
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3.0));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[78vh] sm:h-[82vh] max-w-5xl flex flex-col bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top Floating Control Bar */}
      <div className="z-20 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-3 py-2 flex items-center justify-between gap-2 text-xs font-semibold text-slate-200 shadow-sm">
        {/* Document Info */}
        <div className="flex items-center gap-2 min-w-0 max-w-[40%] sm:max-w-[30%]">
          <FileText className="w-4 h-4 text-red-400 shrink-0" />
          <span className="truncate text-white text-[11px] sm:text-xs" title={fileName}>
            {fileName}
          </span>
        </div>

        {/* Page Navigation Controls */}
        <div className="flex items-center gap-1.5 bg-slate-950/80 px-2 py-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={pageNum <= 1 || loading}
            className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Previous Page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="font-mono text-[11px] px-1 text-slate-300">
            <span className="font-bold text-white">{pageNum}</span> / {numPages || 1}
          </span>

          <button
            type="button"
            onClick={handleNextPage}
            disabled={pageNum >= numPages || loading}
            className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Next Page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom & Rotation Actions */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={scale <= 0.5 || loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <span className="font-mono text-[10px] sm:text-[11px] text-slate-400 min-w-[36px] text-center hidden sm:inline">
            {Math.round(scale * 100)}%
          </span>

          <button
            type="button"
            onClick={handleZoomIn}
            disabled={scale >= 3.0 || loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <button
            type="button"
            onClick={handleRotate}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-colors"
            title="Rotate 90°"
          >
            <RotateCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>

      {/* Main Canvas Scroll Area */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-2 sm:p-6 relative bg-[#131722]">
        {/* Loading Spinner */}
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-slate-950/80 backdrop-blur-xs text-slate-400 z-10">
            <RefreshCw className="w-7 h-7 text-blue-500 animate-spin" />
            <span className="text-xs font-semibold">Streaming PDF from Telegram MTProto...</span>
          </div>
        )}

        {/* Page Rendering Indicator */}
        {pageRendering && !loading && (
          <div className="absolute top-3 right-3 bg-slate-900/90 text-slate-300 text-[10px] font-mono px-2 py-1 rounded-md border border-slate-700 flex items-center gap-1.5 shadow z-10">
            <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
            <span>Rendering page {pageNum}...</span>
          </div>
        )}

        {/* Error Fallback */}
        {errorMessage && (
          <div className="flex flex-col items-center text-center p-6 bg-slate-900 border border-slate-800 rounded-2xl max-w-sm text-slate-300">
            <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
            <p className="text-sm font-bold mb-1">Failed to load PDF</p>
            <p className="text-xs text-slate-500 mb-4">{errorMessage}</p>
            <a
              href={url}
              download={fileName}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl"
            >
              Download PDF Directly
            </a>
          </div>
        )}

        {/* Crisp HTML5 PDF Page Canvas */}
        <canvas
          ref={canvasRef}
          className={`shadow-2xl rounded-sm transition-opacity duration-150 ${
            loading || errorMessage ? 'opacity-0' : 'opacity-100'
          }`}
        />
      </div>

      {/* Bottom Floating Quick Page Thumbnails Bar on Multi-Page Documents */}
      {numPages > 1 && (
        <div className="bg-slate-900/90 border-t border-slate-800/80 px-3 py-1.5 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <button
            onClick={handlePrevPage}
            disabled={pageNum <= 1}
            className="hover:text-white disabled:opacity-30 flex items-center gap-0.5"
          >
            &larr; Prev
          </button>
          <span>•</span>
          <span className="font-mono">
            Page {pageNum} of {numPages}
          </span>
          <span>•</span>
          <button
            onClick={handleNextPage}
            disabled={pageNum >= numPages}
            className="hover:text-white disabled:opacity-30 flex items-center gap-0.5"
          >
            Next &rarr;
          </button>
        </div>
      )}
    </div>
  );
}
