import React from 'react';
import { Database, ExternalLink, RefreshCw, CheckCircle, HelpCircle } from 'lucide-react';
import { FIRESTORE_CONSOLE_URL } from '../lib/firebase';

interface QuotaExceededBannerProps {
  errorDetails?: string;
  onDismiss?: () => void;
}

export const QuotaExceededBanner: React.FC<QuotaExceededBannerProps> = ({
  errorDetails,
  onDismiss,
}) => {
  return (
    <div className="no-print bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 sm:p-5 shadow-sm animate-in slide-in-from-top-4 duration-200">
      <div className="flex flex-col md:flex-row items-start gap-4 justify-between">
        <div className="flex items-start gap-3.5 flex-1">
          <div className="p-2.5 bg-blue-600 rounded-xl text-white shrink-0 shadow-sm animate-pulse">
            <Database className="w-5.5 h-5.5" />
          </div>
          <div className="space-y-1.5 flex-1 min-w-0">
            <h4 className="text-sm font-black text-blue-950 flex flex-wrap items-center gap-1.5 leading-none">
              <span>ĐÃ CHUYỂN SANG CƠ CHẾ CLOUD SQL POSTGRESQL KHÔNG GIỚI HẠN</span>
              <span className="px-2 py-0.5 bg-blue-600 text-white rounded-full text-[9px] font-black tracking-wider uppercase shadow-xs">
                ACTIVE SYNC
              </span>
              <span className="px-2 py-0.5 bg-amber-600 text-white rounded-full text-[9px] font-black tracking-wider uppercase shadow-xs">
                FIRESTORE LIMIT BYPASSED
              </span>
            </h4>
            <p className="text-xs text-blue-900 leading-relaxed font-semibold">
              Hệ thống phát hiện tài khoản phụ Firestore (Spark Plan) đạt giới hạn ghi miễn phí hàng ngày của Google. 
              Chúng tôi đã <strong>chủ động định tuyến tự động (Smart Routing)</strong> chuyển sang sử dụng cổng đám mây cơ sở dữ liệu <strong>Cloud SQL PostgreSQL độc lập</strong>.
            </p>
            
            <div className="p-3.5 bg-white border border-blue-200 rounded-xl text-[11px] text-blue-950 space-y-1.5 font-medium shadow-2xs">
              <div className="flex items-center gap-1.5 text-blue-800 font-bold">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>HỆ THỐNG ĐANG HOẠT ĐỘNG 100% TRÊN NỀN TẢNG CLOUD SQL ĐÁM MÂY:</span>
              </div>
              <ul className="list-disc pl-4 space-y-1 text-slate-700 leading-relaxed font-semibold">
                <li>
                  <strong className="text-blue-900">Lưu trữ Đám mây Không giới hạn:</strong> Mọi phiếu tạo mới, in tem, cập nhật trạng thái của bạn đều được lưu trữ trực tiếp trên đám mây PostgreSQL của hệ thống trạm.
                </li>
                <li>
                  <strong className="text-blue-900">Đồng bộ Liên tục Đa máy:</strong> Tất cả các máy tính, thiết bị khác tại cửa hàng vẫn nhìn thấy, đọc và chỉnh sửa dữ liệu thời gian thực (Real-time polling 3.5s) chuẩn xác 100% với nhau.
                </li>
                <li>
                  <strong className="text-blue-900">Không bị mất mát dữ liệu:</strong> Toàn bộ dữ liệu phiếu của bạn được lưu trữ an toàn và bảo mật hoàn hảo trên cơ sở dữ liệu quan hệ Cloud SQL.
                </li>
              </ul>
            </div>

            {errorDetails && (
              <details className="text-[10px] text-blue-700 font-mono bg-blue-100/50 p-2 rounded-lg cursor-pointer">
                <summary className="font-bold hover:text-blue-900 transition-colors">Chi tiết nhật ký định tuyến kỹ thuật (Firestore Bypassed Log)</summary>
                <div className="mt-1 break-all whitespace-pre-wrap">{errorDetails}</div>
              </details>
            )}
          </div>
        </div>

        <div className="flex flex-row md:flex-col gap-2 shrink-0 w-full md:w-auto">
          <a
            href={FIRESTORE_CONSOLE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm active:scale-[0.98]"
          >
            <HelpCircle className="w-4 h-4" />
            <span>Mở Console Quản Trị</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white hover:bg-blue-100/50 text-blue-950 border border-blue-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
            >
              <RefreshCw className="w-3.5 h-3.5 text-blue-800" />
              <span>Kiểm tra lại Firestore</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
