import React, { useState, useEffect, useMemo } from 'react';
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Calendar,
  Clock,
  XCircle,
  Check,
  Copy,
  Plus,
  Edit2,
  Trash2,
  X,
  History,
  User,
  MessageSquare,
  AlertCircle,
  ArrowRight,
  RotateCcw,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { DateTimePicker, formatViDateTime } from './DateTimePicker';

export interface CustomerCallLogItem {
  id: string;
  calledDate: string;           // Thời gian gọi (VD: 29/08/2026 16:22)
  subStatus: 'hen_ngay' | 'khong_nghe_may' | 'cho_them_thoi_gian' | 'khach_bao_huy' | string;
  appointmentDate?: string;     // Ngày/giờ hẹn khách lên nếu có (VD: 05/09/2026 16:00)
  note?: string;                // Ghi chú cuộc gọi
  callerName?: string;          // Tên KTV / nhân viên gọi
  createdAt?: string;           // Timestamp tạo bản ghi
}

export interface CustomerCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketNumber: string;
  customerName: string;
  customerPhone?: string;
  itemDetail?: string; // Tên linh kiện hoặc Tên máy / IMEI
  initialCalledDate?: string;
  initialSubStatus?: string;
  initialAppointmentDate?: string;
  initialNote?: string;
  callLogs?: CustomerCallLogItem[];
  currentUserName?: string;
  moduleType?: 'shortage' | 'device_iot' | 'deviceIot';
  onSave: (data: {
    calledCustomerDate?: string;
    callSubStatus?: 'hen_ngay' | 'khong_nghe_may' | 'cho_them_thoi_gian' | 'khach_bao_huy';
    appointmentDate?: string;
    callNote?: string;
    callLogs: CustomerCallLogItem[];
    shouldCloseTicket?: boolean;
    isDeletedAll?: boolean;
  }) => void;
  onShowToast?: (msg: string, type?: any) => void;
}

export const CALL_SUBSTATUS_CONFIG: Record<
  string,
  {
    label: string;
    shortLabel: string;
    badgeBg: string;
    textColor: string;
    borderColor: string;
    description: string;
  }
> = {
  hen_ngay: {
    label: 'Gọi khách hẹn ngày/giờ lên thay/nhận máy',
    shortLabel: 'Hẹn ngày lên',
    badgeBg: 'bg-indigo-50 text-indigo-900',
    textColor: 'text-indigo-900',
    borderColor: 'border-indigo-300',
    description: 'Khách hàng chốt thời gian cụ thể mang máy lên trung tâm',
  },
  khong_nghe_may: {
    label: 'Gọi không nghe máy / Máy bận',
    shortLabel: 'K.Nghe máy/Bận',
    badgeBg: 'bg-amber-50 text-amber-950',
    textColor: 'text-amber-950',
    borderColor: 'border-amber-300',
    description: 'Đã gọi điện thoại nhưng khách không bắt máy, máy bận hoặc thuê bao',
  },
  cho_them_thoi_gian: {
    label: 'Gọi khách báo chờ thêm thời gian (Đi công tác...)',
    shortLabel: 'Chờ thêm (Công tác)',
    badgeBg: 'bg-blue-50 text-blue-950',
    textColor: 'text-blue-950',
    borderColor: 'border-blue-300',
    description: 'Khách bận đi công tác hoặc cần thêm thời gian thu xếp chưa lên ngay được',
  },
  khach_bao_huy: {
    label: 'Gọi khách báo hủy không đặt nữa / Không thay',
    shortLabel: 'Báo hủy / Không thay',
    badgeBg: 'bg-rose-50 text-rose-950',
    textColor: 'text-rose-950',
    borderColor: 'border-rose-300',
    description: 'Khách từ chối thay thế, đã sửa chỗ khác hoặc không có nhu cầu nữa',
  },
};

export function parseDateToMillis(dateStr?: string): number {
  if (!dateStr) return 0;
  const trimmed = dateStr.trim();
  if (!trimmed) return 0;
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  const vnRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/;
  const match = trimmed.match(vnRegex);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    const hours = match[4] ? parseInt(match[4], 10) : 0;
    const minutes = match[5] ? parseInt(match[5], 10) : 0;
    const seconds = match[6] ? parseInt(match[6], 10) : 0;
    const d = new Date(year, month, day, hours, minutes, seconds);
    if (!isNaN(d.getTime())) return d.getTime();
  }
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) return parsed.getTime();
  return 0;
}

const EMPTY_CALL_LOGS: CustomerCallLogItem[] = [];

export const CustomerCallModal: React.FC<CustomerCallModalProps> = ({
  isOpen,
  onClose,
  ticketNumber,
  customerName,
  customerPhone,
  itemDetail,
  initialCalledDate,
  initialSubStatus,
  initialAppointmentDate,
  initialNote,
  callLogs = EMPTY_CALL_LOGS,
  currentUserName = 'Nhân viên',
  moduleType = 'shortage',
  onSave,
  onShowToast,
}) => {
  // Danh sách các lần gọi
  const [logs, setLogs] = useState<CustomerCallLogItem[]>([]);
  // ID lần gọi đang được chọn để xem/chỉnh sửa trong form
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  // Trạng thái: Người dùng đang bấm "+ Thêm lần gọi mới"
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);

  // Form input states
  const [formCalledDate, setFormCalledDate] = useState<string>('');
  const [formSubStatus, setFormSubStatus] = useState<
    'hen_ngay' | 'khong_nghe_may' | 'cho_them_thoi_gian' | 'khach_bao_huy'
  >('hen_ngay');
  const [formAppointmentDate, setFormAppointmentDate] = useState<string>('');
  const [formNote, setFormNote] = useState<string>('');
  const [autoCloseCancel, setAutoCloseCancel] = useState<boolean>(false);
  const [copiedPhone, setCopiedPhone] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(true);

  // Khởi tạo state khi mở modal hoặc đổi số phiếu
  useEffect(() => {
    if (!isOpen) return;

    let initialList: CustomerCallLogItem[] = [];
    if (Array.isArray(callLogs) && callLogs.length > 0) {
      initialList = callLogs.map((l, idx) => ({
        ...l,
        id: l.id || `call_${idx}_${Date.now()}`,
      }));
    } else if (initialCalledDate) {
      // Bảo toàn dữ liệu gọi đơn lẻ trước đây
      initialList = [
        {
          id: `call_legacy_${ticketNumber || Date.now()}`,
          calledDate: initialCalledDate,
          subStatus: (initialSubStatus as any) || 'hen_ngay',
          appointmentDate: initialAppointmentDate || undefined,
          note: initialNote || undefined,
          callerName: currentUserName,
          createdAt: new Date().toISOString(),
        },
      ];
    }

    setLogs(initialList);

    if (initialList.length > 0) {
      // MẶC ĐỊNH: Mở sẵn lần gọi gần nhất để xem/sửa hiện trạng (KHÔNG tự động thêm lần gọi mới)
      const latest = initialList[initialList.length - 1];
      setActiveLogId(latest.id);
      setIsAddingNew(false);
      setFormCalledDate(latest.calledDate);
      setFormSubStatus(
        (latest.subStatus as
          | 'hen_ngay'
          | 'khong_nghe_may'
          | 'cho_them_thoi_gian'
          | 'khach_bao_huy') || 'hen_ngay'
      );
      setFormAppointmentDate(latest.appointmentDate || '');
      setFormNote(latest.note || '');
      setAutoCloseCancel(latest.subStatus === 'khach_bao_huy');
    } else {
      // Chưa có cuộc gọi nào: Form ở chế độ ghi nhận lần đầu (Lần 1)
      setActiveLogId(null);
      setIsAddingNew(true);
      setFormCalledDate(formatViDateTime());
      setFormSubStatus('hen_ngay');
      setFormAppointmentDate('');
      setFormNote('');
      setAutoCloseCancel(false);
    }
  }, [isOpen, ticketNumber]);

  if (!isOpen) return null;

  // Chọn 1 lần gọi trong danh sách để xem/chỉnh sửa
  const handleSelectLog = (log: CustomerCallLogItem) => {
    setIsAddingNew(false);
    setActiveLogId(log.id);
    setFormCalledDate(log.calledDate);
    setFormSubStatus(
      (log.subStatus as
        | 'hen_ngay'
        | 'khong_nghe_may'
        | 'cho_them_thoi_gian'
        | 'khach_bao_huy') || 'hen_ngay'
    );
    setFormAppointmentDate(log.appointmentDate || '');
    setFormNote(log.note || '');
    setAutoCloseCancel(log.subStatus === 'khach_bao_huy');
  };

  // Người dùng chủ động bấm "+ Thêm lần gọi mới"
  const handleStartAddNew = () => {
    setIsAddingNew(true);
    setActiveLogId(null);
    setFormCalledDate(formatViDateTime());
    setFormSubStatus('hen_ngay');
    setFormAppointmentDate('');
    setFormNote('');
    setAutoCloseCancel(false);
  };

  // Hủy thêm mới và quay lại lần gọi gần nhất
  const handleCancelAddNew = () => {
    if (logs.length > 0) {
      handleSelectLog(logs[logs.length - 1]);
    } else {
      setIsAddingNew(false);
    }
  };

  // Xóa 1 lần gọi khỏi danh sách
  const handleDeleteLog = (logId: string) => {
    const updated = logs.filter((l) => l.id !== logId);
    setLogs(updated);

    if (activeLogId === logId) {
      if (updated.length > 0) {
        handleSelectLog(updated[updated.length - 1]);
      } else {
        setActiveLogId(null);
        setIsAddingNew(false);
        setFormCalledDate('');
        setFormSubStatus('hen_ngay');
        setFormAppointmentDate('');
        setFormNote('');
      }
    }

    if (onShowToast) {
      onShowToast('Đã xóa lần gọi. Bấm "Lưu Hiện Trạng" để cập nhật thay đổi', 'info');
    }
  };

  // Sao chép số điện thoại
  const handleCopyPhone = () => {
    if (!customerPhone) return;
    navigator.clipboard.writeText(customerPhone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
    if (onShowToast) {
      onShowToast(`Đã sao chép SĐT: ${customerPhone}`, 'success');
    }
  };

  // Tìm vị trí của lần gọi đang chọn trong mảng logs
  const activeLogIndex = logs.findIndex((l) => l.id === activeLogId);

  // Lưu thông tin lần gọi hiện tại trực tiếp vào danh sách logs trong modal
  const handleSaveCurrentLogToList = () => {
    const callDateToSave = formCalledDate.trim() || formatViDateTime();
    let updatedLogs: CustomerCallLogItem[] = [];

    if (isAddingNew || !activeLogId) {
      const newId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const newLog: CustomerCallLogItem = {
        id: newId,
        calledDate: callDateToSave,
        subStatus: formSubStatus,
        appointmentDate:
          formSubStatus === 'hen_ngay'
            ? formAppointmentDate.trim() || undefined
            : undefined,
        note: formNote.trim() || undefined,
        callerName: currentUserName,
        createdAt: new Date().toISOString(),
      };
      updatedLogs = [...logs, newLog];
      setLogs(updatedLogs);
      setActiveLogId(newId);
      setIsAddingNew(false);
      if (onShowToast) {
        onShowToast(`Đã thêm Lần ${updatedLogs.length} vào danh sách cuộc gọi`, 'success');
      }
    } else {
      updatedLogs = logs.map((log) => {
        if (log.id === activeLogId) {
          return {
            ...log,
            calledDate: callDateToSave,
            subStatus: formSubStatus,
            appointmentDate:
              formSubStatus === 'hen_ngay'
                ? formAppointmentDate.trim() || undefined
                : undefined,
            note: formNote.trim() || undefined,
            callerName: log.callerName || currentUserName,
          };
        }
        return log;
      });
      setLogs(updatedLogs);
      const currentIdx = logs.findIndex((l) => l.id === activeLogId);
      if (onShowToast) {
        onShowToast(`Đã cập nhật thông tin Lần ${currentIdx !== -1 ? currentIdx + 1 : ''} thành công`, 'success');
      }
    }
  };

  // Submit: Lưu toàn bộ và đồng bộ với phiếu
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // TRƯỜNG HỢP 1: Đã xóa hết các lần gọi và bấm Lưu Hiện Trạng
    if (logs.length === 0 && !isAddingNew) {
      onSave({
        calledCustomerDate: '',
        callSubStatus: undefined,
        appointmentDate: undefined,
        callNote: undefined,
        callLogs: [],
        shouldCloseTicket: false,
        isDeletedAll: true,
      });
      onClose();
      return;
    }

    const callDateToSave = formCalledDate.trim() || formatViDateTime();
    let updatedLogs: CustomerCallLogItem[] = [];

    // TRƯỜNG HỢP 2: Người dùng đang ở chế độ thêm mới và bấm Lưu
    if (isAddingNew) {
      const newLog: CustomerCallLogItem = {
        id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        calledDate: callDateToSave,
        subStatus: formSubStatus,
        appointmentDate:
          formSubStatus === 'hen_ngay'
            ? formAppointmentDate.trim() || undefined
            : undefined,
        note: formNote.trim() || undefined,
        callerName: currentUserName,
        createdAt: new Date().toISOString(),
      };
      updatedLogs = [...logs, newLog];
    } else if (activeLogId) {
      // TRƯỜNG HỢP 3: Cập nhật hiện trạng lần gọi đang chọn
      updatedLogs = logs.map((log) => {
        if (log.id === activeLogId) {
          return {
            ...log,
            calledDate: callDateToSave,
            subStatus: formSubStatus,
            appointmentDate:
              formSubStatus === 'hen_ngay'
                ? formAppointmentDate.trim() || undefined
                : undefined,
            note: formNote.trim() || undefined,
            callerName: log.callerName || currentUserName,
          };
        }
        return log;
      });
    } else {
      updatedLogs = [...logs];
    }

    // Đảm bảo có ít nhất 1 lần gọi
    if (updatedLogs.length === 0) {
      const fallbackLog: CustomerCallLogItem = {
        id: `call_${Date.now()}`,
        calledDate: callDateToSave,
        subStatus: formSubStatus,
        appointmentDate:
          formSubStatus === 'hen_ngay'
            ? formAppointmentDate.trim() || undefined
            : undefined,
        note: formNote.trim() || undefined,
        callerName: currentUserName,
        createdAt: new Date().toISOString(),
      };
      updatedLogs = [fallbackLog];
    }

    // Thông tin gọi lần mới nhất (phần tử cuối danh sách hoặc lần đang thao tác)
    const latestLog = updatedLogs[updatedLogs.length - 1];

    onSave({
      calledCustomerDate: latestLog.calledDate,
      callSubStatus: latestLog.subStatus as any,
      appointmentDate: latestLog.appointmentDate,
      callNote: latestLog.note,
      callLogs: updatedLogs,
      shouldCloseTicket: formSubStatus === 'khach_bao_huy' && autoCloseCancel,
      isDeletedAll: false,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-neutral-200 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="bg-slate-900 px-5 py-3.5 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/30 rounded-xl border border-blue-500/40">
              <PhoneCall className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h3 className="font-bold text-base tracking-tight text-white flex items-center gap-2">
                <span>Ghi Nhận Kết Quả Gọi Khách Hàng</span>
                {logs.length > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/30">
                    {logs.length} lần gọi
                  </span>
                )}
              </h3>
              <p className="text-xs text-blue-200/80 font-mono flex items-center gap-1.5 mt-0.5">
                <span>Phiếu #{ticketNumber}</span>
                <span>•</span>
                <span className="font-semibold text-white">{customerName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="Đóng modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Customer Quick Call Box */}
          <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200 flex items-center justify-between gap-3 shadow-2xs">
            <div className="space-y-0.5 min-w-0">
              <div className="text-[10px] uppercase font-bold text-blue-700 tracking-wide">
                Khách hàng liên hệ
              </div>
              <div className="font-bold text-sm text-neutral-900 truncate">
                {customerName}
              </div>
              <div className="font-mono text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-blue-600" />
                <span>{customerPhone || 'Chưa có SĐT'}</span>
              </div>
              {itemDetail && (
                <div className="text-[11px] text-neutral-600 truncate mt-0.5" title={itemDetail}>
                  Chi tiết: <strong className="text-neutral-800">{itemDetail}</strong>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {customerPhone && (
                <>
                  <button
                    type="button"
                    onClick={handleCopyPhone}
                    className="p-2 bg-white hover:bg-sky-100 text-sky-800 rounded-lg border border-sky-300 transition-colors cursor-pointer shadow-2xs"
                    title="Sao chép số điện thoại"
                  >
                    {copiedPhone ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <a
                    href={`tel:${customerPhone}`}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-lg shadow-xs transition-colors"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Gọi Ngay</span>
                  </a>
                </>
              )}
            </div>
          </div>

          {/* LỊCH SỬ CÁC LẦN GỌI TRƯỚC ĐÓ */}
          {logs.length > 0 && (
            <div className="border border-neutral-200 rounded-xl overflow-hidden bg-neutral-50/50 shadow-2xs">
              <div
                onClick={() => setShowHistory(!showHistory)}
                className="px-3.5 py-2.5 bg-neutral-100/90 hover:bg-neutral-200/70 border-b border-neutral-200 flex items-center justify-between cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2 font-black text-neutral-800 text-xs">
                  <History className="w-4 h-4 text-indigo-600" />
                  <span>Danh Sách Lần Gọi ({logs.length} lần)</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-neutral-500 font-bold">
                  <span>{showHistory ? 'Thu gọn' : 'Xem chi tiết'}</span>
                  {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </div>
              </div>

              {showHistory && (
                <div className="p-3 space-y-2 max-h-52 overflow-y-auto">
                  {logs.map((log, index) => {
                    const cfg = CALL_SUBSTATUS_CONFIG[log.subStatus] || CALL_SUBSTATUS_CONFIG.hen_ngay;
                    const isSelected = !isAddingNew && activeLogId === log.id;

                    return (
                      <div
                        key={log.id || index}
                        onClick={() => handleSelectLog(log)}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-400 shadow-sm'
                            : 'bg-white border-neutral-200 hover:border-neutral-300 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded-full bg-neutral-800 text-white font-black text-[10px] tracking-wide shadow-2xs">
                              Lần {index + 1}
                            </span>

                            {isSelected && (
                              <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-white font-black text-[9px] uppercase tracking-wider">
                                Đang chọn
                              </span>
                            )}

                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px] border ${cfg.badgeBg} ${cfg.borderColor}`}
                            >
                              {log.subStatus === 'hen_ngay' && <Calendar className="w-3 h-3 text-indigo-600" />}
                              {log.subStatus === 'khong_nghe_may' && <PhoneOff className="w-3 h-3 text-amber-600" />}
                              {log.subStatus === 'cho_them_thoi_gian' && <Clock className="w-3 h-3 text-blue-600" />}
                              {log.subStatus === 'khach_bao_huy' && <XCircle className="w-3 h-3 text-rose-600" />}
                              <span>{cfg.shortLabel}</span>
                            </span>

                            {log.subStatus === 'hen_ngay' && log.appointmentDate && (
                              <span className="text-[11px] font-bold text-indigo-950 bg-indigo-100/90 border border-indigo-200 px-2 py-0.5 rounded">
                                Hẹn: <strong>{log.appointmentDate}</strong>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-neutral-500 font-mono">
                            <span className="flex items-center gap-1 text-neutral-700 font-bold">
                              <Clock className="w-3 h-3 text-neutral-400" />
                              <span>{log.calledDate}</span>
                            </span>
                            {log.callerName && (
                              <span className="hidden sm:inline-block text-neutral-500">
                                ({log.callerName})
                              </span>
                            )}
                            <div className="flex items-center gap-1 ml-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => handleSelectLog(log)}
                                className={`p-1 rounded transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white'
                                    : 'hover:bg-indigo-100 text-indigo-800'
                                }`}
                                title="Sửa thông tin lần gọi này"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteLog(log.id)}
                                className="p-1 hover:bg-rose-100 text-rose-700 rounded transition-colors cursor-pointer"
                                title="Xóa lần gọi này khỏi danh sách"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Note box */}
                        {log.note && (
                          <div className="mt-1.5 p-2 bg-neutral-50 rounded-lg border border-neutral-200/80 text-[11px] text-neutral-800 italic flex items-start gap-1.5">
                            <MessageSquare className="w-3 h-3 text-indigo-500 shrink-0 mt-0.5" />
                            <span className="font-medium break-words">"{log.note}"</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* FORM: THÔNG TIN LẦN GỌI ĐANG THAO TÁC HOẶC THÊM MỚI */}
          <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
              <div className="font-black text-neutral-900 text-xs flex items-center gap-2">
                {isAddingNew ? (
                  <>
                    <span className="px-2 py-0.5 rounded-full bg-sky-600 text-white font-black text-[11px] shadow-2xs">
                      Lần {logs.length + 1} (Mới)
                    </span>
                    <span className="text-sky-950 font-extrabold flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-sky-600" />
                      <span>Ghi nhận lần gọi mới</span>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white font-black text-[11px] shadow-2xs">
                      Lần {activeLogIndex !== -1 ? activeLogIndex + 1 : logs.length}
                    </span>
                    <span className="text-neutral-900 font-extrabold flex items-center gap-1.5">
                      <Edit2 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Thông tin cuộc gọi đang thao tác</span>
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isAddingNew ? (
                  logs.length > 0 && (
                    <button
                      type="button"
                      onClick={handleCancelAddNew}
                      className="text-[11px] text-neutral-600 hover:text-neutral-900 font-bold underline flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Quay lại lần {logs.length}</span>
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={handleStartAddNew}
                    className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 font-bold text-[11px] rounded-lg shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                    title="Bấm nếu bạn vừa gọi thêm một lần mới cho khách hàng"
                  >
                    <Plus className="w-3.5 h-3.5 text-sky-600" />
                    <span>+ Thêm lần gọi (Lần {logs.length + 1})</span>
                  </button>
                )}
              </div>
            </div>

            {/* 1. Thời gian gọi điện */}
            <div className="p-3 bg-sky-50/60 rounded-xl border border-sky-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-extrabold text-sky-950 text-xs flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-sky-600" />
                  <span>1. Thời gian gọi thông báo cho khách:</span>
                </label>
                <button
                  type="button"
                  onClick={() => setFormCalledDate(formatViDateTime())}
                  className="text-[10px] text-sky-700 hover:text-sky-900 font-bold underline cursor-pointer"
                >
                  Lấy giờ hiện tại
                </button>
              </div>
              <DateTimePicker
                value={formCalledDate}
                onChange={(val) => setFormCalledDate(val)}
                placeholder="VD: 24/08/2026 16:22"
                colorScheme="indigo"
              />
              <p className="text-[10px] text-sky-800 leading-tight">
                Thời gian nhân viên liên hệ khách hàng thông báo về tình trạng linh kiện / thiết bị.
              </p>
            </div>

            {/* 2. Kết quả cuộc gọi & Lịch hẹn khách lên */}
            <div className="space-y-2">
              <label className="font-extrabold text-neutral-800 text-xs block">
                2. Kết quả cuộc gọi & Lịch hẹn khách lên <span className="text-rose-500">*</span>:
              </label>

              <div className="grid grid-cols-1 gap-2">
                {/* 1. Hẹn ngày lên */}
                <div
                  onClick={() => setFormSubStatus('hen_ngay')}
                  className={`p-3 rounded-xl border-2 transition-all cursor-pointer ${
                    formSubStatus === 'hen_ngay'
                      ? 'border-indigo-600 bg-indigo-50/70 shadow-xs'
                      : 'border-neutral-200 hover:border-neutral-300 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <input
                      type="radio"
                      name="callSubStatus"
                      checked={formSubStatus === 'hen_ngay'}
                      onChange={() => setFormSubStatus('hen_ngay')}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="space-y-1 flex-1">
                      <div className="font-extrabold text-indigo-950 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-indigo-600" />
                        <span>1. Gọi khách hẹn ngày/giờ lên thay linh kiện / nhận máy</span>
                      </div>
                      <p className="text-[11px] text-neutral-600 leading-normal">
                        Khách hàng chốt thời gian cụ thể mang máy lên trung tâm.
                      </p>

                      {/* Date/Time picker & presets when active */}
                      {formSubStatus === 'hen_ngay' && (
                        <div className="pt-2 space-y-2 animate-in fade-in" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                const d = new Date();
                                const dd = String(d.getDate()).padStart(2, '0');
                                const mm = String(d.getMonth() + 1).padStart(2, '0');
                                const yyyy = d.getFullYear();
                                setFormAppointmentDate(`${dd}/${mm}/${yyyy} 16:00`);
                              }}
                              className="px-2 py-1 bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded text-[11px] font-bold cursor-pointer"
                            >
                              Hôm nay
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const d = new Date();
                                d.setDate(d.getDate() + 1);
                                const dd = String(d.getDate()).padStart(2, '0');
                                const mm = String(d.getMonth() + 1).padStart(2, '0');
                                const yyyy = d.getFullYear();
                                setFormAppointmentDate(`${dd}/${mm}/${yyyy} 16:00`);
                              }}
                              className="px-2 py-1 bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded text-[11px] font-bold cursor-pointer"
                            >
                              Ngày mai
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const d = new Date();
                                d.setDate(d.getDate() + 2);
                                const dd = String(d.getDate()).padStart(2, '0');
                                const mm = String(d.getMonth() + 1).padStart(2, '0');
                                const yyyy = d.getFullYear();
                                setFormAppointmentDate(`${dd}/${mm}/${yyyy} 16:00`);
                              }}
                              className="px-2 py-1 bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded text-[11px] font-bold cursor-pointer"
                            >
                              2 ngày nữa
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const d = new Date();
                                d.setDate(d.getDate() + 7);
                                const dd = String(d.getDate()).padStart(2, '0');
                                const mm = String(d.getMonth() + 1).padStart(2, '0');
                                const yyyy = d.getFullYear();
                                setFormAppointmentDate(`${dd}/${mm}/${yyyy} 16:00`);
                              }}
                              className="px-2 py-1 bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded text-[11px] font-bold cursor-pointer"
                            >
                              Tuần sau
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <label className="text-[11px] font-bold text-neutral-700 whitespace-nowrap">
                              Ngày/giờ hẹn:
                            </label>
                            <div className="w-full">
                              <DateTimePicker
                                value={formAppointmentDate}
                                onChange={(val) => setFormAppointmentDate(val)}
                                placeholder="VD: 26/08/2026 16:00"
                                colorScheme="indigo"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Không nghe máy / Máy bận */}
                <div
                  onClick={() => setFormSubStatus('khong_nghe_may')}
                  className={`p-3 rounded-xl border-2 transition-all cursor-pointer ${
                    formSubStatus === 'khong_nghe_may'
                      ? 'border-amber-600 bg-amber-50/70 shadow-xs'
                      : 'border-neutral-200 hover:border-neutral-300 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <input
                      type="radio"
                      name="callSubStatus"
                      checked={formSubStatus === 'khong_nghe_may'}
                      onChange={() => setFormSubStatus('khong_nghe_may')}
                      className="mt-0.5 text-amber-600 focus:ring-amber-500"
                    />
                    <div className="space-y-1">
                      <div className="font-extrabold text-amber-950 flex items-center gap-1.5">
                        <PhoneOff className="w-4 h-4 text-amber-600" />
                        <span>2. Gọi không nghe máy / Máy bận</span>
                      </div>
                      <p className="text-[11px] text-neutral-600 leading-normal">
                        Đã gọi điện thoại nhưng khách không bắt máy, máy bận hoặc thuê bao.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. Khách báo chờ thêm thời gian */}
                <div
                  onClick={() => setFormSubStatus('cho_them_thoi_gian')}
                  className={`p-3 rounded-xl border-2 transition-all cursor-pointer ${
                    formSubStatus === 'cho_them_thoi_gian'
                      ? 'border-blue-600 bg-blue-50/70 shadow-xs'
                      : 'border-neutral-200 hover:border-neutral-300 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <input
                      type="radio"
                      name="callSubStatus"
                      checked={formSubStatus === 'cho_them_thoi_gian'}
                      onChange={() => setFormSubStatus('cho_them_thoi_gian')}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="space-y-1">
                      <div className="font-extrabold text-blue-950 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-blue-600" />
                        <span>3. Gọi khách báo chờ thêm thời gian (Đi công tác...)</span>
                      </div>
                      <p className="text-[11px] text-neutral-600 leading-normal">
                        Khách bận đi công tác hoặc cần thêm thời gian thu xếp chưa lên ngay được.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4. Khách báo hủy không đặt nữa / Không thay */}
                <div
                  onClick={() => setFormSubStatus('khach_bao_huy')}
                  className={`p-3 rounded-xl border-2 transition-all cursor-pointer ${
                    formSubStatus === 'khach_bao_huy'
                      ? 'border-rose-600 bg-rose-50/70 shadow-xs'
                      : 'border-neutral-200 hover:border-neutral-300 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <input
                      type="radio"
                      name="callSubStatus"
                      checked={formSubStatus === 'khach_bao_huy'}
                      onChange={() => setFormSubStatus('khach_bao_huy')}
                      className="mt-0.5 text-rose-600 focus:ring-rose-500"
                    />
                    <div className="space-y-1 flex-1">
                      <div className="font-extrabold text-rose-950 flex items-center gap-1.5">
                        <XCircle className="w-4 h-4 text-rose-600" />
                        <span>4. Gọi khách báo hủy không đặt nữa / Không thay</span>
                      </div>
                      <p className="text-[11px] text-neutral-600 leading-normal">
                        Khách từ chối thay thế, đã sửa chỗ khác hoặc đã đổi máy mới.
                      </p>

                      {formSubStatus === 'khach_bao_huy' && (
                        <div className="pt-2 animate-in fade-in" onClick={(e) => e.stopPropagation()}>
                          <label className="flex items-center gap-2 p-2 bg-rose-100/80 rounded-lg border border-rose-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={autoCloseCancel}
                              onChange={(e) => setAutoCloseCancel(e.target.checked)}
                              className="rounded text-rose-600 focus:ring-rose-500"
                            />
                            <span className="font-bold text-rose-950 text-[11px]">
                              Đồng thời Đóng Hoàn Tất phiếu này ngay (Lý do: Khách báo hủy)
                            </span>
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Note Textarea */}
            <div className="space-y-1">
              <label className="font-bold text-neutral-700 block text-xs">
                Ghi chú chi tiết cuộc gọi (Tùy chọn):
              </label>
              <textarea
                rows={2}
                placeholder="VD: KHÁCH HẸN T2 GHÉ, BỮA H KHÁCH BẬN QUÁ / Khách báo chiều thứ 6 em gái mang máy lên..."
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-medium text-neutral-800 focus:bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-neutral-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                {logs.length > 0 && !isAddingNew && (
                  <span className="text-[11px] text-neutral-500 font-medium">
                    Đang sửa: <strong className="text-neutral-900">Lần {activeLogIndex !== -1 ? activeLogIndex + 1 : logs.length}</strong>
                  </span>
                )}
                {isAddingNew && (
                  <span className="text-[11px] text-sky-700 font-bold">
                    Đang thêm mới: <strong>Lần {logs.length + 1}</strong>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap justify-end">
                {/* Nút lưu nhanh lần gọi này vào danh sách (không đóng modal để có thể sửa tiếp lần khác) */}
                <button
                  type="button"
                  onClick={handleSaveCurrentLogToList}
                  className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold text-xs rounded-xl border border-indigo-200 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  title="Lưu thông tin lần gọi này vào danh sách bên trên để có thể chuyển qua sửa lần gọi khác mà không mất dữ liệu"
                >
                  <Check className="w-3.5 h-3.5 text-indigo-600" />
                  <span>
                    {isAddingNew
                      ? `Lưu Lần ${logs.length + 1} Vào Danh Sách`
                      : `Cập Nhật Lần ${activeLogIndex !== -1 ? activeLogIndex + 1 : logs.length}`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs rounded-xl border border-neutral-300 transition-colors cursor-pointer"
                >
                  Đóng
                </button>

                <button
                  type="submit"
                  className={`px-4 py-2 font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                    isAddingNew
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : logs.length === 0
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {isAddingNew ? (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Lưu Lần {logs.length + 1} & Cập Nhật Phiếu</span>
                    </>
                  ) : logs.length === 0 ? (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Lưu Hiện Trạng (Xóa cuộc gọi)</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Lưu Tất Cả & Cập Nhật Phiếu</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
