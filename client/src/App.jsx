import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import {
  Upload,
  Image as ImageIcon,
  Film,
  Music,
  FileText,
  FileArchive,
  File,
  X,
  RefreshCw,
  Search,
  HardDrive,
  Trash2,
  Download,
  CheckCircle,
  AlertCircle,
  Play,
  ExternalLink,
  Calendar,
  Zap,
  Gauge,
  Clock,
  Check,
  Headphones,
  Lock,
  Key,
  Eye,
  EyeOff,
  ShieldCheck,
  LayoutGrid,
  Columns,
  ArrowUpDown,
  ChevronUp,
  Moon,
  Sun,
  Settings,
  ChevronDown,
  Shield,
  Layers,
} from 'lucide-react';
import MediaLightbox from './components/MediaLightbox';
import PasswordManagerModal from './components/PasswordManagerModal';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Format bytes into human-readable string (KB, MB, GB)
 */
function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Format raw bytes per second into human-readable speed
 */
function formatSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 KB/s';
  const mb = bytesPerSec / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB/s`;
  const kb = bytesPerSec / 1024;
  return `${kb.toFixed(0)} KB/s`;
}

/**
 * Format seconds into human-readable ETA
 */
function formatETA(seconds) {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return 'Calculating...';
  if (seconds > 3600) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}h ${mins}m`;
  }
  if (seconds > 60) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  }
  return `${Math.ceil(seconds)}s`;
}

/**
 * Format ISO timestamp into clean readable date
 */
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Detect file classification (image, video, audio, pdf, document)
 */
function getFileType(file) {
  const mime = (file.mimeType || '').toLowerCase();
  const ext = (file.fileName || '').split('.').pop().toLowerCase();

  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'].includes(ext)) {
    return 'audio';
  }
  if (mime === 'application/pdf' || ext === 'pdf') {
    return 'pdf';
  }
  return 'document';
}

/**
 * Groups an array of file records into Google Photos-style Timeline sections or sorted categories
 */
function groupFilesByTimeline(filesList, sortBy = 'newest') {
  if (!filesList || filesList.length === 0) return [];

  if (sortBy === 'largest') {
    const sorted = [...filesList].sort((a, b) => (Number(b.size) || 0) - (Number(a.size) || 0));
    return [{ title: 'Files by Size (Largest First)', timestamp: 0, items: sorted }];
  }
  if (sortBy === 'smallest') {
    const sorted = [...filesList].sort((a, b) => (Number(a.size) || 0) - (Number(b.size) || 0));
    return [{ title: 'Files by Size (Smallest First)', timestamp: 0, items: sorted }];
  }
  if (sortBy === 'name') {
    const sorted = [...filesList].sort((a, b) => (a.fileName || '').localeCompare(b.fileName || ''));
    return [{ title: 'Alphabetical Order (A to Z)', timestamp: 0, items: sorted }];
  }

  const groups = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  filesList.forEach((file) => {
    const rawDate = file.createdAt || file.uploadDate || new Date().toISOString();
    const fileDate = new Date(rawDate);
    const fileDateMidnight = new Date(fileDate);
    fileDateMidnight.setHours(0, 0, 0, 0);

    let sectionTitle;
    if (fileDateMidnight.getTime() === today.getTime()) {
      sectionTitle = 'Today';
    } else if (fileDateMidnight.getTime() === yesterday.getTime()) {
      sectionTitle = 'Yesterday';
    } else {
      sectionTitle = fileDate.toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      });
    }

    if (!groups[sectionTitle]) {
      groups[sectionTitle] = {
        title: sectionTitle,
        timestamp: fileDateMidnight.getTime(),
        items: [],
      };
    }
    groups[sectionTitle].items.push(file);
  });

  const sections = Object.values(groups);
  if (sortBy === 'oldest') {
    sections.sort((a, b) => a.timestamp - b.timestamp);
    sections.forEach((s) => {
      s.items.sort((a, b) => new Date(a.createdAt || a.uploadDate || 0) - new Date(b.createdAt || b.uploadDate || 0));
    });
  } else {
    // Default 'newest'
    sections.sort((a, b) => b.timestamp - a.timestamp);
    sections.forEach((s) => {
      s.items.sort((a, b) => new Date(b.createdAt || b.uploadDate || 0) - new Date(a.createdAt || a.uploadDate || 0));
    });
  }

  return sections;
}

const AUTH_TOKEN_KEY = 'telephotos_vault_token';

export default function App() {
  // Authentication & Vault Protection State
  const [authToken, setAuthToken] = useState(() => {
    return localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY) || '';
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [authError, setAuthError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordModalMode, setPasswordModalMode] = useState('reset'); // 'reset' | 'change'

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'images', 'videos', 'audio', 'documents'
  const [gridMode, setGridMode] = useState('grid'); // 'grid' (square Google Photos tiles) vs 'columns' (masonry flow)
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest' | 'largest' | 'smallest' | 'name'
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [showVaultMenu, setShowVaultMenu] = useState(false);
  const vaultMenuRef = useRef(null);

  // Close vault menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (vaultMenuRef.current && !vaultMenuRef.current.contains(e.target)) {
        setShowVaultMenu(false);
      }
    };
    if (showVaultMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showVaultMenu]);

  // Night Mode state with localStorage persistence & system preference fallback
  const THEME_KEY = 'telephotos_theme';
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const searchInputRef = useRef(null);

  // Apply dark mode class to root document element and persist in localStorage
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem(THEME_KEY, 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem(THEME_KEY, 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode((prev) => !prev);

  // Global keyboard shortcut: '/' focuses search input
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [isDragging, setIsDragging] = useState(false);

  // Detailed 2-Phase Upload State
  const [uploadStatus, setUploadStatus] = useState(null);

  // Modal / Preview state
  const [selectedFile, setSelectedFile] = useState(null);

  // Download speed tracker state
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadSpeed, setDownloadSpeed] = useState('');

  // Toast feedback
  const [toast, setToast] = useState(null);

  const fileInputRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 5000);
  };

  /**
   * Helper to construct authorized direct stream URL for <img>, <video>, <audio>, <iframe>
   */
  const getStreamUrl = (messageId) => {
    if (!messageId) return '';
    return authToken
      ? `${API_BASE_URL}/stream/${messageId}?token=${encodeURIComponent(authToken)}`
      : `${API_BASE_URL}/stream/${messageId}`;
  };

  /**
   * Verify saved session token on initial mount
   */
  useEffect(() => {
    const verifySavedSession = async () => {
      const savedToken =
        localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY);
      if (!savedToken) {
        setIsAuthChecking(false);
        setIsAuthenticated(false);
        return;
      }

      try {
        axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
        await axios.get(`${API_BASE_URL}/auth/verify`);
        setAuthToken(savedToken);
        setIsAuthenticated(true);
      } catch (err) {
        console.warn('Saved session expired or invalid:', err.message);
        localStorage.removeItem(AUTH_TOKEN_KEY);
        sessionStorage.removeItem(AUTH_TOKEN_KEY);
        delete axios.defaults.headers.common['Authorization'];
        setAuthToken('');
        setIsAuthenticated(false);
      } finally {
        setIsAuthChecking(false);
      }
    };

    verifySavedSession();
  }, []);

  /**
   * Global 401 Interceptor: Prompt password unlock if session expires
   */
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (
          error.response &&
          error.response.status === 401 &&
          !error.config?.url?.includes('/auth/login')
        ) {
          handleLock('Session unauthorized or expired. Please unlock again.');
        }
        return Promise.reject(error);
      }
    );
    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  /**
   * Unlocks vault using master password (@9525)
   */
  const handleUnlock = async (e) => {
    if (e) e.preventDefault();
    if (!passwordInput.trim()) {
      setAuthError('Please enter the vault password.');
      return;
    }

    setIsUnlocking(true);
    setAuthError('');

    try {
      const res = await axios.post(`${API_BASE_URL}/auth/login`, {
        password: passwordInput.trim(),
      });

      if (res.data && res.data.token) {
        const token = res.data.token;
        if (rememberDevice) {
          localStorage.setItem(AUTH_TOKEN_KEY, token);
        } else {
          sessionStorage.setItem(AUTH_TOKEN_KEY, token);
        }
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setAuthToken(token);
        setIsAuthenticated(true);
        setPasswordInput('');
        showToast('Vault unlocked. Access granted!', 'success');
      }
    } catch (err) {
      console.error('Authentication error:', err);
      setAuthError(err.response?.data?.error || 'Incorrect password. Access denied.');
    } finally {
      setIsUnlocking(false);
    }
  };

  /**
   * Callback when password is reset or updated via modal
   */
  const handlePasswordSuccess = (message, token) => {
    if (token) {
      if (rememberDevice) {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
      } else {
        sessionStorage.setItem(AUTH_TOKEN_KEY, token);
      }
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setAuthToken(token);
      setIsAuthenticated(true);
      showToast(message || 'Vault unlocked with new password!', 'success');
    } else {
      showToast(message || 'Vault password successfully changed!', 'success');
    }
  };

  /**
   * Locks the vault and clears credentials
   */
  const handleLock = (msg = 'Vault locked.') => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    delete axios.defaults.headers.common['Authorization'];
    setAuthToken('');
    setIsAuthenticated(false);
    setFiles([]);
    setSelectedFile(null);
    showToast(msg, 'info');
  };

  /**
   * Fetch all files from PostgreSQL via Prisma
   */
  const fetchGallery = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/files`);
      if (response.data && response.data.data) {
        setFiles(response.data.data);
      }
    } catch (err) {
      console.error('Failed to load media files:', err);
      showToast(
        err.response?.data?.error || 'Failed to connect to backend server. Ensure it is running on port 3001.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchGallery();
    }
  }, [isAuthenticated]);

  // Keyboard navigation for closing lightbox
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedFile) {
        setSelectedFile(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFile]);

  /**
   * Universal upload handler for Photos, Videos, Audio, PDFs, and any Documents
   */
  const handleUploadFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const uploadId = `up_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      setUploadStatus({
        uploadId,
        fileName: file.name,
        totalSize: file.size,
        phase: 'client',
        clientPercent: 0,
        clientSpeed: 'Calculating...',
        clientEta: 'Calculating...',
        telegramPercent: 0,
        telegramSpeed: 'Waiting for server buffer...',
        telegramEta: '',
      });

      let clientStartTime = Date.now();
      let pollInterval = null;

      const startTelegramProgressPolling = () => {
        pollInterval = setInterval(async () => {
          try {
            const res = await axios.get(`${API_BASE_URL}/upload-progress/${uploadId}`);
            if (res.data && res.data.status === 'telegram_upload') {
              setUploadStatus((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  phase: 'telegram',
                  telegramPercent: res.data.percent || 0,
                  telegramSpeed: res.data.speed || 'Streaming MTProto...',
                  telegramEta: res.data.eta || '',
                };
              });
            } else if (res.data && res.data.status === 'completed') {
              clearInterval(pollInterval);
            }
          } catch {
            // Ignore minor polling glitches
          }
        }, 400);
      };

      const formData = new FormData();
      formData.append('file', file);
      try {
        const response = await axios.post(
          `${API_BASE_URL}/upload?uploadId=${encodeURIComponent(uploadId)}`,
          formData,
          {
            timeout: 0, // No client-side timeout for 2GB files
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
          onUploadProgress: (progressEvent) => {
            const total = progressEvent.total || file.size;
            const percent = Math.min(100, Math.round((progressEvent.loaded * 100) / total));

            const elapsedSec = (Date.now() - clientStartTime) / 1000;
            const bytesPerSec = elapsedSec > 0 ? progressEvent.loaded / elapsedSec : 0;
            const remainingBytes = total - progressEvent.loaded;
            const etaSec = bytesPerSec > 0 ? remainingBytes / bytesPerSec : 0;

            setUploadStatus((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                clientPercent: percent,
                clientSpeed: formatSpeed(bytesPerSec),
                clientEta: formatETA(etaSec),
              };
            });

            if (percent >= 100) {
              setUploadStatus((prev) => (prev ? { ...prev, phase: 'telegram' } : null));
              if (!pollInterval) {
                startTelegramProgressPolling();
              }
            }
          },
        });

        clearInterval(pollInterval);

        if (response.data && response.data.data) {
          setFiles((prev) => [response.data.data, ...prev]);
          showToast(`Successfully uploaded "${file.name}" to Telegram Cloud!`, 'success');
        }
      } catch (err) {
        clearInterval(pollInterval);
        console.error('Upload failed for:', file.name, err);
        const serverError = err.response?.data?.details || err.response?.data?.error || err.message;
        showToast(`Upload failed: ${serverError}`, 'error');
      }
    }

    setUploadStatus(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Full-window drag & drop listeners for smooth desktop uploads
  useEffect(() => {
    let dragCounter = 0;

    const handleWindowDragEnter = (e) => {
      e.preventDefault();
      dragCounter++;
      if (e.dataTransfer?.types?.includes('Files')) {
        setIsDragging(true);
      }
    };

    const handleWindowDragLeave = (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        setIsDragging(false);
        dragCounter = 0;
      }
    };

    const handleWindowDragOver = (e) => {
      e.preventDefault();
    };

    const handleWindowDrop = (e) => {
      e.preventDefault();
      dragCounter = 0;
      setIsDragging(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        handleUploadFiles(e.dataTransfer.files);
      }
    };

    window.addEventListener('dragenter', handleWindowDragEnter);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);

    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, []);

  // Back to Top scroll listener
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 350);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  /**
   * Tracked download with live speed monitoring
   */
  const handleTrackedDownload = async (messageId, fileName) => {
    setDownloading(true);
    setDownloadProgress(0);
    setDownloadSpeed('Connecting...');
    const downloadStartTime = Date.now();
    const streamUrl = getStreamUrl(messageId);

    try {
      const response = await axios.get(streamUrl, {
        responseType: 'blob',
        timeout: 0,
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setDownloadProgress(percent);

            const elapsedSec = (Date.now() - downloadStartTime) / 1000;
            const speed = elapsedSec > 0 ? progressEvent.loaded / elapsedSec : 0;
            setDownloadSpeed(formatSpeed(speed));
          }
        },
      });

      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);

      showToast(`Downloaded "${fileName}"`, 'success');
    } catch (err) {
      console.error('Download error:', err);
      showToast('Download error. Direct stream fallback initiated.', 'error');
      window.open(streamUrl, '_blank');
    } finally {
      setDownloading(false);
      setDownloadProgress(0);
      setDownloadSpeed('');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  /**
   * Delete file from Telegram channel and PostgreSQL database
   */
  const handleDelete = async (messageId, fileName, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Are you sure you want to permanently delete "${fileName}"? This will remove it from Telegram MTProto storage.`)) {
      return;
    }

    try {
      await axios.delete(`${API_BASE_URL}/files/${messageId}`);
      setFiles((prev) => prev.filter((item) => item.telegramMessageId !== messageId));
      if (selectedFile?.telegramMessageId === messageId) {
        setSelectedFile(null);
      }
      showToast(`Deleted "${fileName}"`, 'success');
    } catch (err) {
      console.error('Failed to delete file:', err);
      showToast(err.response?.data?.error || 'Failed to delete file', 'error');
    }
  };

  // Filter files by query and active category tab
  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      const matchesSearch = file.fileName.toLowerCase().includes(searchQuery.toLowerCase());
      const type = getFileType(file);

      if (activeTab === 'images') return matchesSearch && type === 'image';
      if (activeTab === 'videos') return matchesSearch && type === 'video';
      if (activeTab === 'audio') return matchesSearch && type === 'audio';
      if (activeTab === 'documents') return matchesSearch && (type === 'pdf' || type === 'document');
      return matchesSearch;
    });
  }, [files, searchQuery, activeTab]);

  const timelineSections = useMemo(() => {
    return groupFilesByTimeline(filteredFiles, sortBy);
  }, [filteredFiles, sortBy]);

  // Aggregate statistics across categories
  const stats = useMemo(() => {
    const totalBytes = files.reduce((acc, curr) => acc + (Number(curr.size) || 0), 0);
    const imageCount = files.filter((f) => getFileType(f) === 'image').length;
    const videoCount = files.filter((f) => getFileType(f) === 'video').length;
    const audioCount = files.filter((f) => getFileType(f) === 'audio').length;
    const docCount = files.filter((f) => ['pdf', 'document'].includes(getFileType(f))).length;

    return {
      totalBytes,
      imageCount,
      videoCount,
      audioCount,
      docCount,
      totalCount: files.length,
    };
  }, [files]);

  // 1. Initial Auth Checking Screen
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Checking Vault Security...
        </p>
      </div>
    );
  }

  // 2. Master Password Lock Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden selection:bg-blue-600 selection:text-white">
        {/* Ambient cosmic radial glow auras */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-blue-600/20 via-indigo-600/15 to-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-10 left-10 w-80 h-80 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-10 right-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-[90px] pointer-events-none" />

        {/* Lock Modal Card - Premium Glassmorphism */}
        <div className="relative w-full max-w-md bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-7 sm:p-9 shadow-[0_20px_70px_-15px_rgba(0,0,0,0.8)] flex flex-col items-center text-center z-10">
          {/* Subtle Top Glowing Line */}
          <div className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-48 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent pointer-events-none" />

          {/* Glowing Vault Icon with ambient ring */}
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-blue-500/30 rounded-3xl blur-xl animate-pulse" />
            <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 p-[1.5px] shadow-2xl shadow-blue-500/30">
              <div className="w-full h-full bg-slate-950/90 rounded-[22px] flex items-center justify-center text-white">
                <Lock className="w-9 h-9 text-blue-400" />
              </div>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-semibold tracking-wide uppercase mb-3">
            <Zap className="w-3 h-3" /> Telegram MTProto Storage
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
            TelePhotos Vault
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mb-6 max-w-xs leading-relaxed font-normal">
            Personal Cloud Storage with infinite capacity. Unlock your vault to access your photos and files.
          </p>

          <form onSubmit={handleUnlock} className="w-full flex flex-col gap-4">
            <div className="relative text-left">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Master Password
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-slate-500 pointer-events-none">
                  <Key className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    if (authError) setAuthError('');
                  }}
                  placeholder="Enter vault password"
                  autoFocus
                  disabled={isUnlocking}
                  className={`w-full pl-10 pr-11 py-3 text-sm bg-slate-950/80 border ${
                    authError
                      ? 'border-rose-500 focus:ring-rose-500/30'
                      : 'border-slate-800/90 focus:border-blue-500 focus:ring-blue-500/20'
                  } rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-4 transition-all shadow-inner`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-slate-500 hover:text-slate-300 p-1 rounded-lg transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {authError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs text-left animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-400 pt-1 px-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500/30"
                />
                <span className="text-slate-300">Remember this device</span>
              </label>
              <span className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" /> 256-bit Encrypted
              </span>
            </div>

            <button
              type="submit"
              disabled={isUnlocking || !passwordInput.trim()}
              className="mt-1 w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-2xl shadow-xl shadow-blue-500/25 flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] group"
            >
              {isUnlocking ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying Password...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span>Unlock Vault</span>
                </>
              )}
            </button>
          </form>

          {/* Prominent Forgot / Reset Password Trigger */}
          <div className="w-full mt-5 pt-5 border-t border-slate-800/80 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setPasswordModalMode('reset');
                setShowPasswordModal(true);
                setAuthError('');
              }}
              className="w-full py-2.5 px-4 bg-slate-800/80 hover:bg-slate-800 hover:border-blue-500/60 border border-slate-700/70 text-blue-400 hover:text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98] group"
            >
              <Key className="w-4 h-4 text-amber-400 group-hover:rotate-12 transition-transform shrink-0" />
              <span>Forgot Password? Reset with OTP / Master Key</span>
            </button>
          </div>

          {/* Security footnote */}
          <div className="mt-4 pt-2 w-full flex items-center justify-center gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Encrypted Telegram MTProto Storage • Personal Vault</span>
          </div>
        </div>

        {/* Password Manager Modal */}
        <PasswordManagerModal
          isOpen={showPasswordModal}
          onClose={() => setShowPasswordModal(false)}
          mode={passwordModalMode}
          apiBaseUrl={API_BASE_URL}
          onSuccess={handlePasswordSuccess}
          showToast={showToast}
        />

        {/* Toast Notification on Lock Screen */}
        {toast && (
          <div
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-sm font-medium transition-all duration-300 ${
              toast.type === 'error'
                ? 'bg-rose-950 border-rose-800 text-rose-200'
                : 'bg-slate-900 border-slate-800 text-slate-200'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400" />
            ) : (
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            )}
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen ${
        isDarkMode ? 'dark bg-[#080c14] text-slate-100' : 'bg-[#f8fafc] text-slate-800'
      } flex flex-col antialiased selection:bg-blue-500 selection:text-white pb-20 sm:pb-10 transition-colors duration-200`}
    >
      {/* Full-Window Drag and Drop Active Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-blue-600/90 backdrop-blur-md flex flex-col items-center justify-center text-white pointer-events-none animate-in fade-in duration-200">
          <div className="p-8 sm:p-12 rounded-3xl bg-white/10 border-2 border-dashed border-white/60 flex flex-col items-center max-w-md text-center shadow-2xl scale-105 transition-transform mx-4">
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mb-4 animate-bounce shadow-lg">
              <Upload className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Drop to Upload</h2>
            <p className="text-sm text-blue-100">
              Release files anywhere to stream directly to your private Telegram MTProto cloud storage.
            </p>
          </div>
        </div>
      )}

      {/* Toast Notification (Mobile-Friendly Centered) */}
      {toast && (
        <div
          className={`fixed bottom-8 sm:bottom-6 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-white transition-all transform animate-in slide-in-from-bottom-5 duration-300 max-w-[92vw] sm:max-w-md ${
            toast.type === 'error' ? 'bg-rose-600' : 'bg-slate-900 dark:bg-slate-850 border dark:border-slate-800'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-200 shrink-0" />
          ) : (
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 hover:opacity-75 text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Navbar: Modern Frosted Glass Aesthetic with Theme Toggle & Vault Menu */}
      <header className="sticky top-0 z-30 bg-white/85 dark:bg-[#080c14]/90 backdrop-blur-2xl border-b border-slate-200/80 dark:border-slate-800/80 px-3.5 sm:px-8 py-2.5 sm:py-3 flex items-center justify-between gap-3 shadow-xs transition-colors duration-200">
        {/* Logo, Identity & Small Area Storage Used Indicator */}
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 flex items-center justify-center text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-500/20 shrink-0">
            <HardDrive className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight bg-gradient-to-r from-slate-900 dark:from-white via-slate-800 dark:via-slate-100 to-slate-900 dark:to-white bg-clip-text text-transparent">
                TelePhotos
              </h1>

              {/* Protocol Badge */}
              <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 border border-blue-200/70 dark:border-blue-800/70 rounded-full shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                MTProto Cloud
              </span>

              {/* Storage Indicator */}
              <span
                className="flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 rounded-full shadow-2xs"
                title={`Total Cloud Storage Used: ${formatBytes(stats.totalBytes)} across ${stats.totalCount} files`}
              >
                <HardDrive className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                <span>{formatBytes(stats.totalBytes)}</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium hidden sm:block">
              Telegram Infinite Free Cloud • Zero Compression
            </p>
          </div>
        </div>

        {/* Search Bar on Desktop with Keyboard Shortcut Hint */}
        <div className="relative max-w-md w-full hidden md:block">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search photos, videos, files (Press '/' to focus)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-12 py-2 text-sm bg-slate-100/90 dark:bg-slate-900/90 hover:bg-slate-100 dark:hover:bg-slate-800/90 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-transparent dark:border-slate-800/90 rounded-full focus:bg-white dark:focus:bg-slate-950 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all font-normal"
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-500 pointer-events-none">
              /
            </span>
          )}
        </div>

        {/* Header Actions: Theme Switcher, Refresh, Primary Upload, Vault Settings Menu */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Night Mode Toggle Button */}
          <button
            onClick={toggleTheme}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Night Mode'}
            className="p-2 text-slate-600 dark:text-amber-400 hover:text-blue-600 dark:hover:text-amber-300 hover:bg-slate-100 dark:hover:bg-slate-900 active:scale-95 rounded-xl transition-all border border-transparent dark:border-slate-800"
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
            )}
          </button>

          {/* Refresh Gallery Button */}
          <button
            onClick={fetchGallery}
            disabled={loading}
            title="Refresh gallery"
            className="p-2 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 active:scale-95 rounded-xl transition-all border border-transparent dark:border-slate-800"
          >
            <RefreshCw
              className={`w-4 h-4 sm:w-5 sm:h-5 ${
                loading ? 'animate-spin text-blue-600 dark:text-blue-400' : ''
              }`}
            />
          </button>

          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!!uploadStatus}
            className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 active:scale-95 rounded-full shadow-md shadow-blue-500/25 transition-all"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Upload</span>
          </button>

          {/* Vault Security Dropdown Menu (Organized & Clean) */}
          <div className="relative" ref={vaultMenuRef}>
            <button
              onClick={() => setShowVaultMenu(!showVaultMenu)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800 rounded-full transition-all active:scale-95 shadow-2xs"
              title="Vault Security & Settings"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="hidden sm:inline">Vault</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {/* Floating Dropdown Card */}
            {showVaultMenu && (
              <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-2xl shadow-black/30 z-50 animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-3">
                {/* Vault Status Header */}
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      TelePhotos Private Vault
                    </p>
                    <p className="text-[11px] text-emerald-500 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Session Encrypted & Active
                    </p>
                  </div>
                </div>

                {/* Storage Summary */}
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 text-xs">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                    <span>Cloud Storage:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {formatBytes(stats.totalBytes)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span>Total Media Files:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {stats.totalCount} items
                    </span>
                  </div>
                </div>

                {/* Action Items */}
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => {
                      setShowVaultMenu(false);
                      setPasswordModalMode('change');
                      setShowPasswordModal(true);
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center gap-2 transition-colors text-left"
                  >
                    <Key className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Change Password & Revoke Devices</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowVaultMenu(false);
                      handleLock('Vault locked successfully.');
                    }}
                    className="w-full py-2.5 px-3 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2 transition-colors text-left"
                  >
                    <Lock className="w-4 h-4 shrink-0" />
                    <span>Lock Vault & Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-8 flex flex-col gap-5 sm:gap-6">
        {/* Hidden Universal File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => handleUploadFiles(e.target.files)}
          multiple
          className="hidden"
        />

        {/* Accurate Real-Time 2-Phase Upload Progress Dashboard (Active Only When Uploading) */}
        {uploadStatus && (
          <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900 rounded-3xl p-5 sm:p-6 shadow-md text-center max-w-2xl mx-auto w-full animate-in fade-in duration-200">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-950/90 text-blue-700 dark:text-blue-300 animate-pulse">
                {uploadStatus.phase === 'client'
                  ? 'Phase 1 of 2: Buffering to Server'
                  : 'Phase 2 of 2: Streaming to Telegram MTProto'}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {formatBytes(uploadStatus.totalSize)}
              </span>
            </div>

            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base sm:text-lg mb-1 truncate max-w-md mx-auto">
              {uploadStatus.fileName}
            </h3>

            {/* Real-time 2-Phase Progress Display */}
            <div className="w-full bg-slate-50 dark:bg-slate-950 rounded-2xl p-4 sm:p-5 mt-3 border border-slate-200/80 dark:border-slate-800 text-left">
              {/* Step 1: Client to Server Buffer */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                  <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                    {uploadStatus.clientPercent === 100 ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Upload className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 animate-bounce" />
                    )}
                    1. Client ➔ Local Server Buffer
                  </span>
                  <span className="text-blue-600 dark:text-blue-400 font-mono">
                    {uploadStatus.clientPercent}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadStatus.clientPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  <span className="flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-slate-400" /> Speed:{' '}
                    <strong className="text-slate-700 dark:text-slate-200 font-mono">
                      {uploadStatus.clientSpeed}
                    </strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" /> ETA:{' '}
                    <strong className="text-slate-700 dark:text-slate-200 font-mono">
                      {uploadStatus.clientEta}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Step 2: Server to Telegram MTProto Storage */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                  <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                    {uploadStatus.telegramPercent === 100 ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : uploadStatus.phase === 'telegram' ? (
                      <Zap className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    2. Server ➔ Telegram MTProto Cloud Stream
                  </span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-mono">
                    {uploadStatus.telegramPercent}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadStatus.telegramPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  <span className="flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-slate-400" /> Telegram Speed:{' '}
                    <strong className="text-indigo-600 dark:text-indigo-400 font-mono">
                      {uploadStatus.telegramSpeed}
                    </strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" /> ETA:{' '}
                    <strong className="text-indigo-600 dark:text-indigo-400 font-mono">
                      {uploadStatus.telegramEta || 'Estimating...'}
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sticky Controls Bar: User-Friendly Category Tabs + Search + Sort + Layout Density */}
        <div className="sticky top-[56px] sm:top-[65px] z-20 bg-slate-50/95 dark:bg-[#080c14]/95 backdrop-blur-xl py-2 px-0.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/70 dark:border-slate-800/70 transition-colors duration-200">
          {/* Segmented Category Control Tabs (Unified & Clean) */}
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 border dark:border-slate-800/80 rounded-2xl overflow-x-auto no-scrollbar max-w-full">
            <button
              onClick={() => setActiveTab('all')}
              className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'all'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All ({stats.totalCount})
            </button>
            <button
              onClick={() => setActiveTab('images')}
              className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'images'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" /> Photos ({stats.imageCount})
            </button>
            <button
              onClick={() => setActiveTab('videos')}
              className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'videos'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Film className="w-3.5 h-3.5" /> Videos ({stats.videoCount})
            </button>
            <button
              onClick={() => setActiveTab('audio')}
              className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'audio'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Music className="w-3.5 h-3.5" /> Audio ({stats.audioCount})
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'documents'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Docs ({stats.docCount})
            </button>
          </div>

          {/* Controls: Search (Mobile), Sort Dropdown & Layout Switcher */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Search bar on mobile */}
            <div className="relative flex-1 md:hidden">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl focus:outline-none focus:border-blue-500 shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Sort Selector Dropdown */}
            <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl px-2.5 py-1.5 shadow-2xs shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 pl-1.5 pr-1 focus:outline-none cursor-pointer"
                title="Sort items"
              >
                <option value="newest" className="dark:bg-slate-900">Newest</option>
                <option value="oldest" className="dark:bg-slate-900">Oldest</option>
                <option value="largest" className="dark:bg-slate-900">Largest</option>
                <option value="smallest" className="dark:bg-slate-900">Smallest</option>
                <option value="name" className="dark:bg-slate-900">A - Z</option>
              </select>
            </div>

            {/* Layout Density Switcher: Square Grid vs Masonry Flow */}
            <div className="flex items-center bg-slate-200/80 dark:bg-slate-900 border dark:border-slate-800/80 p-0.5 rounded-xl shrink-0 shadow-2xs">
              <button
                onClick={() => setGridMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${
                  gridMode === 'grid'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Square Grid (3 columns on mobile, 4-6 on desktop)"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setGridMode('columns')}
                className={`p-1.5 rounded-lg transition-all ${
                  gridMode === 'columns'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Masonry Flow view"
              >
                <Columns className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Gallery Section — Google Photos Timeline Grouping */}
        {loading && files.length === 0 ? (
          // Loading Skeleton
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
              <div
                key={n}
                className="aspect-square bg-slate-200/70 dark:bg-slate-900 border dark:border-slate-800/60 rounded-2xl animate-pulse"
              />
            ))}
          </div>
        ) : filteredFiles.length === 0 ? (
          // Premium Empty State
          <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-10 sm:p-16 text-center flex flex-col items-center justify-center my-6 shadow-xs">
            <div className="relative mb-5">
              <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-2xl" />
              <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xl shadow-blue-500/25">
                <HardDrive className="w-10 h-10" />
              </div>
            </div>

            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              {searchQuery ? 'No matching files found' : 'Your Telegram Vault is Ready'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mt-2 mb-6 leading-relaxed">
              {searchQuery
                ? `No items match "${searchQuery}". Try a different keyword or reset your filter.`
                : 'Upload photos, videos, music, or PDFs to store them permanently in your private Telegram cloud channel with zero compression.'}
            </p>

            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="px-5 py-2.5 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-2xl transition-colors shadow-2xs"
              >
                Clear Search Filter
              </button>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-3 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 rounded-2xl transition-all shadow-lg shadow-blue-500/25 active:scale-95 flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Your First File</span>
              </button>
            )}
          </div>
        ) : (
          /* TIMELINE SECTIONS: GOOGLE PHOTOS STYLE */
          <div className="flex flex-col gap-8">
            {timelineSections.map((section) => (
              <div key={section.title} className="flex flex-col gap-3">
                {/* Section Header */}
                <div className="py-2.5 flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                      {section.title}
                    </h3>
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                      ({section.items.length}{' '}
                      {section.items.length === 1 ? 'item' : 'items'})
                    </span>
                  </div>
                </div>

                {/* Gallery Grid (Toggleable: Clean 3-col Square Grid vs Masonry) */}
                <div
                  className={
                    gridMode === 'grid'
                      ? 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1.5 sm:gap-3'
                      : 'columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-3 sm:gap-4 space-y-3 sm:space-y-4'
                  }
                >
                  {section.items.map((file) => {
                    const streamUrl = getStreamUrl(file.telegramMessageId);
                    const fileType = getFileType(file);
                    const isSquare = gridMode === 'grid';

                    return (
                      <div
                        key={file.id || file.telegramMessageId}
                        onClick={() => setSelectedFile(file)}
                        className={`group relative overflow-hidden bg-slate-900 dark:bg-slate-900/90 shadow-sm hover:shadow-xl transition-all duration-200 cursor-pointer transform active:scale-95 ${
                          isSquare
                            ? 'aspect-square rounded-xl sm:rounded-2xl'
                            : 'break-inside-avoid rounded-2xl hover:-translate-y-1'
                        }`}
                      >
                        {/* 1. Video Rendering */}
                        {fileType === 'video' && (
                          <div
                            className={`relative bg-slate-950 flex items-center justify-center overflow-hidden ${
                              isSquare ? 'w-full h-full' : 'aspect-[4/5] sm:aspect-square'
                            }`}
                          >
                            <video
                              src={streamUrl}
                              preload="metadata"
                              muted
                              playsInline
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/45 transition-colors">
                              <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-white/90 backdrop-blur-sm text-slate-900 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                <Play className="w-3.5 h-3.5 sm:w-5 sm:h-5 fill-slate-900 ml-0.5" />
                              </div>
                            </div>
                            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                              <Film className="w-3 h-3 text-purple-400" />
                              <span className="hidden sm:inline">Video</span>
                            </div>
                          </div>
                        )}

                        {/* 2. Photo Rendering */}
                        {fileType === 'image' && (
                          <div
                            className={`relative bg-slate-100 dark:bg-slate-900 flex items-center justify-center overflow-hidden ${
                              isSquare ? 'w-full h-full' : 'min-h-[140px]'
                            }`}
                          >
                            <img
                              src={streamUrl}
                              alt={file.fileName}
                              loading="lazy"
                              decoding="async"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                if (e.target.nextSibling) {
                                  e.target.nextSibling.style.display = 'flex';
                                }
                              }}
                              className={`w-full ${
                                isSquare ? 'h-full object-cover' : 'h-auto object-cover'
                              } group-hover:scale-105 transition-transform duration-300`}
                            />
                            <div className="hidden absolute inset-0 bg-slate-900 text-slate-400 flex flex-col items-center justify-center text-[10px] p-2 text-center">
                              <ImageIcon className="w-5 h-5 text-slate-500 mb-1" />
                              <span className="truncate max-w-full">{file.fileName}</span>
                            </div>
                          </div>
                        )}

                        {/* 3. Audio / Music Rendering */}
                        {fileType === 'audio' && (
                          <div className="relative aspect-square w-full h-full bg-gradient-to-tr from-emerald-950 via-slate-900 to-teal-900 p-2 sm:p-4 flex flex-col items-center justify-center text-center">
                            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-1.5 sm:mb-3 shadow-inner group-hover:scale-110 transition-transform">
                              <Headphones className="w-5 h-5 sm:w-7 sm:h-7" />
                            </div>
                            <p className="text-[11px] sm:text-xs font-bold text-white line-clamp-2 px-1">
                              {file.fileName}
                            </p>
                          </div>
                        )}

                        {/* 4. PDF Document Rendering */}
                        {fileType === 'pdf' && (
                          <div
                            className={`relative bg-gradient-to-tr from-rose-950 via-slate-900 to-red-900 p-2 sm:p-4 flex flex-col items-center justify-center text-center ${
                              isSquare ? 'w-full h-full' : 'aspect-[4/5]'
                            }`}
                          >
                            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-1.5 sm:mb-3 group-hover:scale-110 transition-transform">
                              <FileText className="w-5 h-5 sm:w-7 sm:h-7" />
                            </div>
                            <p className="text-[11px] sm:text-xs font-bold text-white line-clamp-2 px-1">
                              {file.fileName}
                            </p>
                          </div>
                        )}

                        {/* 5. Generic Document / Archive Rendering */}
                        {fileType === 'document' && (
                          <div
                            className={`relative bg-gradient-to-tr from-amber-950 via-slate-900 to-amber-900 p-2 sm:p-4 flex flex-col items-center justify-center text-center ${
                              isSquare ? 'w-full h-full' : 'aspect-[4/5]'
                            }`}
                          >
                            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-1.5 sm:mb-3 group-hover:scale-110 transition-transform">
                              <File className="w-5 h-5 sm:w-7 sm:h-7" />
                            </div>
                            <p className="text-[11px] sm:text-xs font-bold text-white line-clamp-2 px-1">
                              {file.fileName}
                            </p>
                          </div>
                        )}

                        {/* Hover Overlay with Metadata & Quick Actions (Desktop only) */}
                        <div className="hidden sm:flex absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-3 flex-col justify-between">
                          {/* Top Actions */}
                          <div className="flex items-center justify-end gap-1.5 self-end">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTrackedDownload(file.telegramMessageId, file.fileName);
                              }}
                              title="Download file"
                              className="p-1.5 rounded-full bg-white/20 hover:bg-white/40 text-white backdrop-blur-md transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleDelete(file.telegramMessageId, file.fileName, e)}
                              title="Delete permanently"
                              className="p-1.5 rounded-full bg-rose-600/80 hover:bg-rose-600 text-white backdrop-blur-md transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Bottom Details */}
                          <div className="text-white text-left">
                            <p className="text-xs font-semibold truncate drop-shadow-sm">
                              {file.fileName}
                            </p>
                            <div className="flex items-center justify-between text-[10px] text-slate-300 mt-0.5">
                              <span>{formatBytes(file.size)}</span>
                              <span>{formatDate(file.createdAt || file.uploadDate)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 left-6 z-40 p-3 rounded-full bg-slate-900/85 dark:bg-slate-800/90 hover:bg-slate-900 dark:hover:bg-slate-700 text-white backdrop-blur-md shadow-xl transition-all duration-200 active:scale-90 flex items-center justify-center border border-white/10 dark:border-slate-700"
          title="Back to Top"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      )}

      {/* Native-Style Mobile Bottom Navigation Bar (Ultra-clean, thumb-friendly navigation) */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#080c14]/95 backdrop-blur-2xl border-t border-slate-200/80 dark:border-slate-800/80 px-2 py-1.5 safe-bottom flex items-center justify-around shadow-2xl transition-colors duration-200">
        {/* Tab 1: All Files */}
        <button
          onClick={() => setActiveTab('all')}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
            activeTab === 'all'
              ? 'text-blue-600 dark:text-blue-400 font-bold'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white font-medium'
          }`}
        >
          <Layers className="w-5 h-5" />
          <span className="text-[10px]">All</span>
        </button>

        {/* Tab 2: Photos */}
        <button
          onClick={() => setActiveTab('images')}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
            activeTab === 'images'
              ? 'text-blue-600 dark:text-blue-400 font-bold'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white font-medium'
          }`}
        >
          <ImageIcon className="w-5 h-5" />
          <span className="text-[10px]">Photos</span>
        </button>

        {/* Central Floating Upload Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={!!uploadStatus}
          className="relative -top-4 w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 text-white flex items-center justify-center shadow-lg shadow-blue-500/40 active:scale-95 transition-transform border-2 border-white dark:border-[#080c14]"
          title="Upload Files"
        >
          <Upload className="w-5 h-5" />
        </button>

        {/* Tab 3: Videos */}
        <button
          onClick={() => setActiveTab('videos')}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
            activeTab === 'videos'
              ? 'text-purple-600 dark:text-purple-400 font-bold'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white font-medium'
          }`}
        >
          <Film className="w-5 h-5" />
          <span className="text-[10px]">Videos</span>
        </button>

        {/* Tab 4: Vault Security */}
        <button
          onClick={() => setShowVaultMenu(!showVaultMenu)}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
            showVaultMenu
              ? 'text-blue-600 dark:text-blue-400 font-bold'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white font-medium'
          }`}
        >
          <ShieldCheck className="w-5 h-5" />
          <span className="text-[10px]">Vault</span>
        </button>
      </nav>

      {/* High-Performance Lightbox & Media Viewer with Touch Swipe, Slide Transitions & Filmstrip */}
      {selectedFile && (
        <MediaLightbox
          files={filteredFiles}
          activeFile={selectedFile}
          onClose={() => setSelectedFile(null)}
          onSelectFile={setSelectedFile}
          getStreamUrl={getStreamUrl}
          getFileType={getFileType}
          formatBytes={formatBytes}
          formatDate={formatDate}
          handleDownload={handleTrackedDownload}
          handleDelete={handleDelete}
          downloading={downloading}
          downloadProgress={downloadProgress}
          downloadSpeed={downloadSpeed}
        />
      )}

      {/* Password Manager Modal */}
      <PasswordManagerModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        mode={passwordModalMode}
        apiBaseUrl={API_BASE_URL}
        onSuccess={handlePasswordSuccess}
        showToast={showToast}
      />
    </div>
  );
}
