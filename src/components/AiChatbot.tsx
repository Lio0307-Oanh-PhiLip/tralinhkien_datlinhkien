import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ChatMessage,
  AiRoleType,
  AI_ROLES,
  AI_MODELS,
  sendChatMessage,
} from '../services/geminiChatService';
import { LabelItem } from '../types/label';
import { ShortageBookingItem } from '../types/shortage';
import { DeviceIotBookingItem } from '../types/deviceIot';
import { TechnicianItem } from '../types/technician';
import { buildRagContextForQuery } from '../utils/aiRagHelper';
import { CuteAiRobot } from './CuteAiRobot';
import {
  Sparkles,
  Send,
  Trash2,
  Copy,
  Check,
  User,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  Download,
  Lightbulb,
  Database,
  Cpu,
  Boxes,
  HelpCircle,
  MessageSquare,
  Zap,
  Info,
  Layers,
  ArrowDown,
  Minimize2,
  Maximize2,
  X,
  UserCheck,
  Users as UsersIcon,
  PackageSearch,
  AlertTriangle,
  Clock,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

export interface AiNavigationTarget {
  tab: 'overview' | 'labels' | 'shortage' | 'device_iot';
  subTab?: string;
  statusFilter?: string;
  searchTerm?: string;
  ticketNumber?: string;
  warningBranch?: 'all' | 'overdue_7' | 'step1' | 'step2' | 'step3' | 'svd' | 'cancel' | 'edit';
}

interface AiChatbotProps {
  initialRole?: AiRoleType;
  initialModel?: string;
  isFloating?: boolean;
  onCloseFloating?: () => void;
  catalogLabels?: LabelItem[];
  shortageBookings?: ShortageBookingItem[];
  deviceIotBookings?: DeviceIotBookingItem[];
  techniciansList?: TechnicianItem[];
  items?: LabelItem[];
  workspaceContext?: {
    labelsCount?: number;
    catalogCount?: number;
    shortageCount?: number;
    pendingBookingsCount?: number;
    techniciansCount?: number;
    currentUser?: {
      name: string;
      role: string;
    };
  };
  onNavigateTarget?: (target: AiNavigationTarget) => void;
}

const STORAGE_KEY = 'oppo_label_studio_gemini_chat_history_v2';
const ROLE_STORAGE_KEY = 'oppo_label_studio_gemini_chat_role_v2';
const MODEL_STORAGE_KEY = 'oppo_label_studio_gemini_chat_model_v2';

export const AiChatbot: React.FC<AiChatbotProps> = ({
  initialRole = 'hardware_expert',
  initialModel = 'gemini-3.8-flash',
  isFloating = false,
  onCloseFloating,
  catalogLabels = [],
  shortageBookings = [],
  deviceIotBookings = [],
  techniciansList = [],
  items = [],
  workspaceContext,
  onNavigateTarget,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const [selectedRole, setSelectedRole] = useState<AiRoleType>(() => {
    const saved = localStorage.getItem(ROLE_STORAGE_KEY);
    return (saved as AiRoleType) || initialRole;
  });

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const saved = localStorage.getItem(MODEL_STORAGE_KEY);
    if (saved && AI_MODELS.some((m) => m.id === saved)) {
      return saved;
    }
    return initialModel;
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load chat history:', e);
    }
    return [
      {
        id: 'msg-welcome',
        role: 'model',
        text: `Xin chào! Tôi là **Trợ lý AI Gemini Chuyên Sâu** của hệ thống **OPPO Label Studio & Service Center**.\n\nTôi có thể giải đáp & phân tích **MỌI câu hỏi dữ liệu trong hệ thống**:\n* 👤 **Tải công việc Nhân viên & KTV:** Tra cứu KTV còn bao nhiêu linh kiện chờ chưa xử lý, phân bổ 5 bước, cảnh báo quá hạn 7 ngày / SVD giữ máy.\n* 📦 **Mã linh kiện & Khách đang chờ:** Thống kê mã linh kiện có bao nhiêu khách đang chờ đặt, vị trí kệ kho, tồn kho thực tế, đối soát cung - cầu.\n* 🔍 **Tra cứu phần cứng chính hãng:** Thông số kỹ thuật chuẩn, mã pin, loại màn hình, cụm camera của Find X8/X8 Pro, Reno 13F, Reno 12/12 Pro, Find N3, A-series...\n* 🏷️ **In tem nhãn 3x2 & Kho GCSM:** Quy cách in tem Code 128 / QR, điều phối kho và kịch bản gọi hẹn khách.\n\n💡 *Bấm vào các câu hỏi gợi ý nhanh bên dưới hoặc nhập câu hỏi để bắt đầu ngay!*`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      },
    ];
  });

  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [includeContext, setIncludeContext] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showQuickPrompts, setShowQuickPrompts] = useState(true);
  const [activeQuickFilter, setActiveQuickFilter] = useState<'all' | 'technicians' | 'parts' | 'warnings' | 'hardware'>('all');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Click outside listener to dismiss floating chatbot
  useEffect(() => {
    if (!isFloating || !onCloseFloating) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (containerRef.current && containerRef.current.contains(target)) {
        return;
      }
      onCloseFloating();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseFloating();
      }
    };

    const timer = setTimeout(() => {
      window.addEventListener('pointerdown', handlePointerDown, true);
      window.addEventListener('keydown', handleKeyDown);
    }, 100);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFloating, onCloseFloating]);

  // Save state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
      console.error('Failed to save chat history:', e);
    }
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(ROLE_STORAGE_KEY, selectedRole);
  }, [selectedRole]);

  useEffect(() => {
    localStorage.setItem(MODEL_STORAGE_KEY, selectedModel);
  }, [selectedModel]);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages, isLoading]);

  const currentRoleDef = useMemo(() => {
    return AI_ROLES.find((r) => r.id === selectedRole) || AI_ROLES[0];
  }, [selectedRole]);

  const currentModelDef = useMemo(() => {
    return AI_MODELS.find((m) => m.id === selectedModel) || AI_MODELS[0];
  }, [selectedModel]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputPrompt).trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: text,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInputPrompt('');
    setIsLoading(true);

    // Prepare rich RAG context data for complete grounding
    let contextPayload: any = null;
    if (includeContext) {
      const activeCatalog = catalogLabels.length > 0 ? catalogLabels : items;
      contextPayload = buildRagContextForQuery(
        text,
        activeCatalog,
        shortageBookings,
        workspaceContext,
        deviceIotBookings,
        techniciansList
      );
    }

    try {
      const apiMessages = newHistory
        .filter((m) => m.id !== 'msg-welcome' || newHistory.length <= 2)
        .map((m) => ({
          role: m.role,
          text: m.text,
        }));

      const res = await sendChatMessage({
        messages: apiMessages,
        model: selectedModel,
        role: selectedRole,
        contextData: contextPayload,
      });

      const modelMessage: ChatMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        text: res.text,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        modelUsed: res.model,
        roleUsed: res.role,
      };

      setMessages((prev) => [...prev, modelMessage]);
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'model',
        text: `⚠️ **Đã xảy ra lỗi khi kết nối với Gemini AI:**\n${err.message || 'Không thể nhận phản hồi. Vui lòng thử lại sau.'}`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  };

  // Quick Action Navigator handler
  const handleActionClick = useCallback(
    (actionStr: string) => {
      try {
        // Check if action is an interactive quick-ask prompt
        if (actionStr.startsWith('ask:')) {
          const promptToAsk = decodeURIComponent(actionStr.substring(4));
          handleSendMessage(promptToAsk);
          return;
        }

        if (!onNavigateTarget) return;

        // Format: target?param1=val1&param2=val2
        const [rawTarget, rawQuery] = actionStr.split('?');
        const params = new URLSearchParams(rawQuery || '');
        const search = params.get('search') || '';
        const status = params.get('status') || undefined;
        const subTab = params.get('subTab') || undefined;
        const ticketNumber = params.get('ticket') || undefined;

        if (rawTarget === 'shortage') {
          onNavigateTarget({
            tab: 'shortage',
            subTab: subTab || 'shortage-main',
            statusFilter: status || 'all',
            searchTerm: search,
            ticketNumber,
          });
          if (isFloating && onCloseFloating) onCloseFloating();
        } else if (rawTarget === 'catalog' || rawTarget === 'labels') {
          onNavigateTarget({
            tab: 'labels',
            subTab: subTab || 'catalog',
            searchTerm: search,
          });
          if (isFloating && onCloseFloating) onCloseFloating();
        } else if (rawTarget === 'device_iot') {
          onNavigateTarget({
            tab: 'device_iot',
            subTab: subTab || 'device-main',
            statusFilter: status || 'all',
            searchTerm: search,
          });
          if (isFloating && onCloseFloating) onCloseFloating();
        } else if (rawTarget === 'overview') {
          onNavigateTarget({
            tab: 'overview',
          });
          if (isFloating && onCloseFloating) onCloseFloating();
        }
      } catch (err) {
        console.error('Failed to parse navigation action:', err);
      }
    },
    [onNavigateTarget, isFloating, onCloseFloating, handleSendMessage]
  );

  const handleClearHistory = () => {
    const welcomeMsg: ChatMessage = {
      id: 'msg-welcome',
      role: 'model',
      text: `Lịch sử chat đã được xóa sạch. Tôi sẵn sàng hỗ trợ các câu hỏi tra cứu dữ liệu mới!`,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages([welcomeMsg]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  const handleCopyMessage = (id: string, text: string) => {
    // Strip action tags for clean copy
    const cleanText = text.replace(/\[\[ACTION:[^|]+\|([^\]]+)\]\]/g, '$1');
    navigator.clipboard.writeText(cleanText);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadHistory = () => {
    const exportContent = messages
      .map((m) => `[${m.timestamp}] ${m.role === 'user' ? 'USER' : 'GEMINI AI'}:\n${m.text.replace(/\[\[ACTION:[^|]+\|([^\]]+)\]\]/g, '$1')}\n\n`)
      .join('---\n\n');
    const blob = new Blob([exportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `oppo_gemini_chat_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Helper to render text with interactive [[ACTION:target|label]] badges
  const renderMessageContent = (text: string, isUser: boolean) => {
    if (isUser) {
      return <p className="whitespace-pre-wrap font-sans">{text}</p>;
    }

    // Split text by [[ACTION:...|...]]
    const parts = text.split(/(\[\[ACTION:[^\]]+\]\])/g);

    return (
      <div className="markdown-body prose prose-xs max-w-none text-stone-800">
        {parts.map((part, index) => {
          const actionMatch = part.match(/^\[\[ACTION:([^|]+)\|([^\]]+)\]\]$/);
          if (actionMatch) {
            const actionPath = actionMatch[1];
            const actionLabel = actionMatch[2];
            const isAsk = actionPath.startsWith('ask:');

            return (
              <button
                key={index}
                type="button"
                onClick={() => handleActionClick(actionPath)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 my-1 mr-1.5 rounded-lg text-xs font-bold shadow-2xs hover:shadow-sm cursor-pointer transition-all hover:scale-102 select-none ${
                  isAsk
                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 ring-1 ring-emerald-200'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white'
                }`}
                title={isAsk ? `Hỏi nhanh: ${actionPath.substring(4)}` : `Điều hướng đến: ${actionPath}`}
              >
                {isAsk ? (
                  <Sparkles className="w-3 h-3 text-emerald-600 shrink-0 animate-pulse" />
                ) : null}
                <span>{actionLabel}</span>
                {isAsk ? null : <ExternalLink className="w-3 h-3 text-emerald-100 shrink-0" />}
              </button>
            );
          }
          return (
            <Markdown key={index} remarkPlugins={[remarkGfm]}>
              {part}
            </Markdown>
          );
        })}
      </div>
    );
  };

  // Sample quick queries for each category
  const dynamicSuggestedPrompts = useMemo(() => {
    const list: Array<{ label: string; prompt: string; category: string; icon: any }> = [];

    // 1. Technicians
    const firstTech = techniciansList[0]?.name || 'Võ Tấn Đạt';
    list.push({
      label: `KTV ${firstTech} còn bao nhiêu phiếu chờ?`,
      prompt: `KTV ${firstTech} trong danh sách còn bao nhiêu linh kiện chờ chưa xử lý?`,
      category: 'technicians',
      icon: UserCheck,
    });
    list.push({
      label: `Thống kê tải công việc toàn bộ KTV`,
      prompt: `Thống kê tải công việc và số lượng phiếu đang chờ xử lý của tất cả kỹ thuật viên`,
      category: 'technicians',
      icon: UsersIcon,
    });

    // 2. Part Codes
    const samplePart = shortageBookings[0]?.partCode || '621033000404';
    list.push({
      label: `Mã ${samplePart} có bao nhiêu khách đang chờ đặt?`,
      prompt: `Mã linh kiện ${samplePart} trên hệ thống có bao nhiêu khách đang chờ đặt?`,
      category: 'parts',
      icon: PackageSearch,
    });
    list.push({
      label: `Top linh kiện có nhiều khách đặt chờ nhất`,
      prompt: `Thống kê những mã linh kiện đang có nhiều khách đặt chờ nhất trong xưởng`,
      category: 'parts',
      icon: Boxes,
    });

    // 3. Warnings
    list.push({
      label: `Phiếu quá hạn >7 ngày & SVD giữ máy`,
      prompt: `Báo cáo chi tiết các phiếu đặt chờ đang bị cảnh báo quá hạn 7 ngày và SVD giữ máy quá 3 ngày`,
      category: 'warnings',
      icon: AlertTriangle,
    });
    list.push({
      label: `Phiếu máy mượn khách hàng chưa trả`,
      prompt: `Có bao nhiêu phiếu máy mượn khách hàng (Customer Loan) đang mượn chưa hoàn trả?`,
      category: 'warnings',
      icon: Clock,
    });

    // 4. Hardware
    list.push({
      label: `So sánh nắp lưng Reno 12 vs Reno 12 Pro`,
      prompt: `Phân biệt chi tiết sự khác nhau giữa nắp lưng Reno 12 5G và Reno 12 Pro 5G`,
      category: 'hardware',
      icon: Cpu,
    });
    list.push({
      label: `Mã pin & màn hình chuẩn Find X8 Pro`,
      prompt: `Tra cứu mã pin chuẩn, thông số màn hình và sạc của OPPO Find X8 Pro (CPH2659)`,
      category: 'hardware',
      icon: Zap,
    });

    return list;
  }, [techniciansList, shortageBookings]);

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-stone-50 border border-stone-200 rounded-2xl overflow-hidden shadow-sm ${
        isFloating ? 'h-[540px] max-h-[85vh] text-xs' : 'h-[calc(100vh-140px)] min-h-[580px]'
      }`}
    >
      {/* Header Toolbar */}
      <div className="bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-700 flex items-center justify-center text-white shadow-xs p-1">
            <CuteAiRobot size={30} isAnimated={true} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-stone-900 leading-tight">
                {isFloating ? 'Trợ lý AI Gemini' : 'Trung Tâm Trợ Lý AI Gemini'}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                Toàn Diện Hệ Thống
              </span>
            </div>
            <p className="text-[11px] text-stone-500 line-clamp-1">
              {currentRoleDef.title} • {currentModelDef.name}
            </p>
          </div>
        </div>

        {/* Right Actions: Role selector, Model selector, Clear history */}
        <div className="flex items-center gap-1.5">
          {/* Role Picker */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer border border-stone-200"
              title="Chọn vai trò chuyên gia"
            >
              <span className={`w-2 h-2 rounded-full ${currentRoleDef.iconColor.replace('text-', 'bg-')}`} />
              <span className="hidden sm:inline">{currentRoleDef.name}</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            </button>

            {showRoleMenu && (
              <div className="absolute right-0 mt-1 w-64 bg-white rounded-xl shadow-xl border border-stone-200 py-1.5 z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1 text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                  Chọn Vai Trò Chuyên Môn
                </div>
                {AI_ROLES.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => {
                      setSelectedRole(role.id);
                      setShowRoleMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex flex-col gap-0.5 hover:bg-stone-50 transition-colors cursor-pointer ${
                      selectedRole === role.id ? 'bg-emerald-50 text-emerald-900 font-bold' : 'text-stone-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{role.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 font-normal">
                        {role.badge}
                      </span>
                    </div>
                    <span className="text-[11px] text-stone-500 font-normal line-clamp-1">
                      {role.title}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Model Picker */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowModelMenu(!showModelMenu)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer border border-emerald-200"
              title="Chọn mô hình Gemini AI"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">{currentModelDef.name}</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            </button>

            {showModelMenu && (
              <div className="absolute right-0 mt-1 w-72 bg-white rounded-xl shadow-xl border border-stone-200 py-1.5 z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1 text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                  Mô hình Gemini AI
                </div>
                {AI_MODELS.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => {
                      setSelectedModel(model.id);
                      setShowModelMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex flex-col gap-0.5 hover:bg-stone-50 transition-colors cursor-pointer ${
                      selectedModel === model.id ? 'bg-emerald-50 text-emerald-900 font-bold' : 'text-stone-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{model.name}</span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded border font-bold ${model.badgeColor}`}>
                        {model.badge}
                      </span>
                    </div>
                    <span className="text-[11px] text-stone-500 font-normal">
                      {model.speed} • {model.desc}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Download History */}
          <button
            type="button"
            onClick={handleDownloadHistory}
            className="p-1.5 hover:bg-stone-100 text-stone-500 hover:text-stone-800 rounded-lg transition-colors cursor-pointer"
            title="Tải lịch sử chat (.txt)"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Clear Chat */}
          <button
            type="button"
            onClick={handleClearHistory}
            className="p-1.5 hover:bg-rose-50 text-stone-500 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
            title="Xóa toàn bộ lịch sử chat"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Close if floating */}
          {isFloating && onCloseFloating && (
            <button
              type="button"
              onClick={onCloseFloating}
              className="p-1.5 hover:bg-stone-100 text-stone-500 hover:text-stone-800 rounded-lg transition-colors cursor-pointer ml-1"
              title="Đóng cửa sổ"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isCopied = copiedId === msg.id;
          const isErrorMsg = msg.text.startsWith('⚠️');

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-2xs overflow-hidden ${
                  isUser
                    ? 'bg-emerald-800 text-white'
                    : msg.modelUsed === 'oppo-knowledge-engine-v2'
                    ? 'bg-amber-100 p-0.5 border border-amber-300'
                    : 'bg-emerald-100 p-0.5 border border-emerald-300'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <CuteAiRobot size={24} isAnimated={false} />}
              </div>

              {/* Message Bubble Container */}
              <div
                className={`flex flex-col max-w-[85%] sm:max-w-[78%] ${
                  isUser ? 'items-end' : 'items-start'
                }`}
              >
                {/* Author Label & Time */}
                <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-stone-400">
                  <span className="font-semibold text-stone-600">
                    {isUser
                      ? 'Bạn'
                      : msg.modelUsed === 'oppo-knowledge-engine-v2'
                      ? 'Trợ lý Kỹ thuật OPPO (Dữ liệu chuyên môn)'
                      : `Gemini AI (${msg.modelUsed || selectedModel})`}
                  </span>
                  <span>•</span>
                  <span>{msg.timestamp}</span>
                </div>

                {/* Message Bubble */}
                <div
                  className={`relative group rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed shadow-2xs ${
                    isUser
                      ? 'bg-emerald-700 text-white rounded-tr-xs'
                      : isErrorMsg
                      ? 'bg-amber-50 text-amber-950 border border-amber-200 rounded-tl-xs'
                      : 'bg-white text-stone-800 border border-stone-200 rounded-tl-xs'
                  }`}
                >
                  {renderMessageContent(msg.text, isUser)}

                  {/* Retry action for error messages */}
                  {isErrorMsg && (
                    <div className="mt-3 pt-2 border-t border-amber-200 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedModel('gemini-3.8-flash');
                          const lastUserPrompt = [...messages].reverse().find((m) => m.role === 'user')?.text;
                          if (lastUserPrompt) {
                            handleSendMessage(lastUserPrompt);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Thử lại với Gemini 3.8 Flash</span>
                      </button>
                    </div>
                  )}

                  {/* Copy Button */}
                  <button
                    type="button"
                    onClick={() => handleCopyMessage(msg.id, msg.text)}
                    className={`absolute bottom-1.5 right-1.5 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${
                      isUser
                        ? 'bg-emerald-800 text-emerald-200 hover:bg-emerald-900'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                    title="Sao chép nội dung"
                  >
                    {isCopied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-600 flex items-center justify-center shrink-0 text-white shadow-2xs">
              <Sparkles className="w-4 h-4 animate-spin" />
            </div>
            <div className="bg-white border border-stone-200 rounded-2xl rounded-tl-xs px-4 py-3 shadow-2xs flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs text-stone-500 font-medium">
                Gemini đang phân tích dữ liệu xưởng & tổng hợp câu trả lời...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompt Suggestions & Category Filter */}
      {showQuickPrompts && (
        <div className="bg-white/95 border-t border-stone-200 px-3 py-2 shrink-0">
          <div className="flex items-center justify-between mb-1.5 text-[11px] text-stone-500 font-semibold px-1">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <span className="flex items-center gap-1 text-emerald-800 shrink-0">
                <Lightbulb className="w-3.5 h-3.5 text-amber-500" /> Gợi ý nhanh:
              </span>
              <button
                type="button"
                onClick={() => setActiveQuickFilter('all')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors shrink-0 ${
                  activeQuickFilter === 'all' ? 'bg-emerald-700 text-white' : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => setActiveQuickFilter('technicians')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors shrink-0 ${
                  activeQuickFilter === 'technicians' ? 'bg-emerald-700 text-white' : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                }`}
              >
                👤 KTV & Nhân sự
              </button>
              <button
                type="button"
                onClick={() => setActiveQuickFilter('parts')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors shrink-0 ${
                  activeQuickFilter === 'parts' ? 'bg-emerald-700 text-white' : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                }`}
              >
                📦 Mã LK & Khách chờ
              </button>
              <button
                type="button"
                onClick={() => setActiveQuickFilter('warnings')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors shrink-0 ${
                  activeQuickFilter === 'warnings' ? 'bg-emerald-700 text-white' : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                }`}
              >
                ⚠️ Cảnh báo tiến độ
              </button>
              <button
                type="button"
                onClick={() => setActiveQuickFilter('hardware')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors shrink-0 ${
                  activeQuickFilter === 'hardware' ? 'bg-emerald-700 text-white' : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                }`}
              >
                📱 Phần cứng OPPO
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowQuickPrompts(false)}
              className="text-stone-400 hover:text-stone-600 text-[10px] cursor-pointer ml-2 shrink-0"
            >
              Ẩn
            </button>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {dynamicSuggestedPrompts
              .filter((p) => activeQuickFilter === 'all' || p.category === activeQuickFilter)
              .map((item, i) => {
                const IconComponent = item.icon;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSendMessage(item.prompt)}
                    disabled={isLoading}
                    className="whitespace-nowrap px-2.5 py-1 text-xs bg-stone-100 hover:bg-emerald-50 hover:text-emerald-950 hover:border-emerald-300 border border-stone-200 text-stone-700 rounded-full font-medium transition-colors cursor-pointer shrink-0 disabled:opacity-50 flex items-center gap-1"
                  >
                    <IconComponent className="w-3 h-3 text-emerald-600" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="bg-white border-t border-stone-200 p-3 shrink-0">
        {/* Context Attachment Options */}
        <div className="flex items-center justify-between mb-2 text-xs text-stone-500 px-1">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeContext}
              onChange={(e) => setIncludeContext(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
            />
            <span className="text-[11px] font-medium text-stone-700">
              Đồng bộ dữ liệu thời gian thực ({workspaceContext?.catalogCount ?? catalogLabels.length} mã kho, {shortageBookings.length} phiếu đặt chờ, {deviceIotBookings.length} máy & IOT)
            </span>
          </label>

          <span className="text-[10px] text-stone-400 hidden sm:inline">
            Nhấn <kbd className="px-1 py-0.5 bg-stone-100 border border-stone-300 rounded font-mono text-[9px]">Enter</kbd> để gửi
          </span>
        </div>

        {/* Input Box & Action Buttons */}
        <div className="flex items-end gap-2 bg-stone-50 rounded-xl border border-stone-300 p-1.5 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all">
          <textarea
            ref={textareaRef}
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Hỏi về KTV còn bao nhiêu linh kiện chờ, mã linh kiện có bao nhiêu khách đặt, tồn kho...`}
            rows={1}
            disabled={isLoading}
            className="flex-1 max-h-32 min-h-[36px] bg-transparent border-0 resize-none px-2 py-1 text-xs sm:text-sm text-stone-900 focus:outline-none placeholder:text-stone-400 font-sans"
          />

          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={!inputPrompt.trim() || isLoading}
            className="p-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg font-bold shadow-xs transition-colors cursor-pointer shrink-0"
            title="Gửi tin nhắn"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
