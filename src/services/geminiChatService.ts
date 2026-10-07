export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  modelUsed?: string;
  roleUsed?: string;
}

export type AiRoleType = 'hardware_expert' | 'inventory_label' | 'shortage_cs' | 'data_analyst';

export interface AiRoleDef {
  id: AiRoleType;
  name: string;
  title: string;
  badge: string;
  description: string;
  iconColor: string;
  accentBg: string;
  suggestedPrompts: string[];
}

export const AI_ROLES: AiRoleDef[] = [
  {
    id: 'hardware_expert',
    name: 'Chuyên gia Kỹ thuật OPPO',
    title: 'Kỹ thuật Phần cứng & Mã Linh kiện',
    badge: 'Hardware Pro',
    description: 'Chuyên tra cứu mã linh kiện, sơ đồ mạch, chẩn đoán pan bệnh và tương thích dòng máy Find, Reno, A-series, Realme.',
    iconColor: 'text-emerald-600',
    accentBg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    suggestedPrompts: [
      'Tra cứu mã linh kiện màn hình và pin cho Find X8 Pro',
      'Phân biệt nắp lưng Reno 12 5G và Reno 12 Pro 5G',
      'Cách chẩn đoán lỗi mất sóng hoặc sạc chậm trên dòng Reno',
      'Mã cáp nối bo sạc chính hãng OPPO A78 4G là gì?',
    ],
  },
  {
    id: 'inventory_label',
    name: 'Cố vấn Quản lý Kho & Tem',
    title: 'In Tem Barcode 3x2 inch & Kho GCSM',
    badge: 'Inventory & Label',
    description: 'Tư vấn quy chuẩn in tem 3x2 inch, mã vạch Code 128, mã QR, kiểm kê kho và đồng bộ dữ liệu Excel.',
    iconColor: 'text-blue-600',
    accentBg: 'bg-blue-50 border-blue-200 text-blue-800',
    suggestedPrompts: [
      'Hướng dẫn căn lề và khổ in tem 3x2 inch chuẩn không bị lệch',
      'Cách sắp xếp vị trí kệ kho (Location) cho linh kiện dễ tìm nhất',
      'Định dạng file Excel nhập xuất danh mục tem nhãn cần những cột nào?',
      'Cách tạo mã vạch Code 128 và mã QR chuẩn GCSM',
    ],
  },
  {
    id: 'shortage_cs',
    name: 'Trợ lý Đặt Chờ & CSKH',
    title: 'Quản lý Phiếu Thiếu & Kịch bản CSKH',
    badge: 'Shortage & CS',
    description: 'Theo dõi phiếu đặt chờ linh kiện, phân loại trạng thái, tạo kịch bản gọi hẹn khách chuẩn Service Center.',
    iconColor: 'text-amber-600',
    accentBg: 'bg-amber-50 border-amber-200 text-amber-800',
    suggestedPrompts: [
      'Soạn kịch bản gọi điện thông báo linh kiện đặt chờ đã về kho',
      'Cách xử lý khiếu nại khách hàng khi linh kiện về trễ hơn 7 ngày',
      'Quy trình đổi trạng thái từ Đã nhập kho sang Đã gọi hẹn khách',
      'Soạn tin nhắn Zalo/SMS thông báo hẹn khách đến thay linh kiện',
    ],
  },
  {
    id: 'data_analyst',
    name: 'Chuyên gia Báo cáo Vận hành',
    title: 'Phân tích Tồn Kho & Hiệu suất Xưởng',
    badge: 'Analytics & Insights',
    description: 'Phân tích dữ liệu tồn kho, thống kê linh kiện hỏng nhiều nhất, đánh giá năng suất và dự báo nhu cầu.',
    iconColor: 'text-purple-600',
    accentBg: 'bg-purple-50 border-purple-200 text-purple-800',
    suggestedPrompts: [
      'Phân tích những loại linh kiện nào có nguy cơ tồn đọng lâu ngày',
      'Lập báo cáo tổng kết tình hình đặt chờ linh kiện tuần này',
      'Đề xuất định mức an toàn tồn kho tối thiểu cho các mã linh kiện hot',
      'Cách phân tích tỷ lệ hoàn thành sửa chữa của kỹ thuật viên',
    ],
  },
];

export const AI_MODELS = [
  {
    id: 'auto',
    name: '⚡ Tự động (Auto Fallback)',
    speed: 'Tối ưu Quota 429',
    desc: 'Tự động luân chuyển mô hình AI (3.8 ➔ 3.7 ➔ 3.6 ➔ 2.5 ➔ 3.5 ➔ 3.1 Lite) khi gặp lỗi 429 hết Quota.',
    badge: 'Tự động luân chuyển',
    badgeColor: 'bg-gradient-to-r from-amber-500 to-emerald-600 text-white font-bold',
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    speed: 'Siêu ổn định & Nhanh',
    desc: 'Mô hình chuẩn mới nhất với hạn mức cao, phản hồi nhanh và suy luận phần cứng chính xác.',
    badge: 'Khuyên dùng',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    speed: 'Suy luận cao',
    desc: 'Thế hệ mô hình 3.7 hỗ trợ suy luận logic kỹ thuật nâng cao.',
    badge: 'Kỹ thuật cao',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    speed: 'Cân bằng Quota',
    desc: 'Phiên bản Flash 3.6 cân bằng tốt giữa tốc độ và khả năng đáp ứng.',
    badge: 'Cân bằng',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    speed: 'Ổn định bền bỉ',
    desc: 'Mô hình dự phòng thế hệ 2.5 độ tin cậy cực cao, ổn định liên tục.',
    badge: 'Dự phòng cao',
    badgeColor: 'bg-sky-100 text-sky-800 border-sky-300',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    speed: 'Siêu tốc',
    desc: 'Tối ưu cho phản hồi tức thì, tóm tắt nhanh và các câu hỏi ngắn.',
    badge: 'Tốc độ cao',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    speed: 'Đa năng',
    desc: 'Mô hình xử lý ngữ cảnh linh hoạt cho hầu hết các tác vụ kỹ thuật và quản lý kho.',
    badge: 'Đa năng',
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-300',
  },
];

export interface SendChatMessageParams {
  messages: Array<{ role: 'user' | 'model'; text: string }>;
  model?: string;
  role?: AiRoleType;
  customSystemInstruction?: string;
  contextData?: any;
}

export interface ChatResponse {
  text: string;
  model: string;
  role: string;
  isFallback?: boolean;
  autoSwitched?: boolean;
  switchedFrom?: string;
}

export async function sendChatMessage(params: SendChatMessageParams): Promise<ChatResponse> {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      let errMsg = errorData.error || `Lỗi kết nối máy chủ (${response.status})`;
      if (typeof errMsg === 'string' && (errMsg.includes('Quota exceeded') || errMsg.includes('429'))) {
        errMsg = 'Tất cả mô hình Gemini đều đang bận Quota. Đã chuyển sang chế độ Tri thức Offline.';
      }
      throw new Error(errMsg);
    }

    return await response.json();
  } catch (err: any) {
    if (err.message && (err.message.includes('Quota') || err.message.includes('ResourceExhausted'))) {
      throw new Error('Hạn mức yêu cầu Gemini AI đã vượt quá giới hạn tức thời. Hệ thống tự động chuyển đổi mô hình.');
    }
    throw err;
  }
}
