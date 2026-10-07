import { LabelItem } from '../types/label';
import { ShortageBookingItem } from '../types/shortage';
import { DeviceIotBookingItem } from '../types/deviceIot';
import { TechnicianItem } from '../types/technician';

// Comprehensive genuine OPPO / Realme / OnePlus hardware reference database
export interface DeviceHardwareSpec {
  modelName: string;
  modelCodes: string[];
  batteryCode: string;
  batteryCapacity: string;
  chargingWatt: string;
  displayType: string;
  screenSpecs: string;
  backCoverNotes: string;
  cameraSpecs: string;
  commonPartsNotes: string;
}

export const GENUINE_OPPO_HARDWARE_SPECS: Record<string, DeviceHardwareSpec> = {
  reno_13f_5g: {
    modelName: 'OPPO Reno13 F 5G / 4G',
    modelCodes: ['CPH2699', 'CPH2713'],
    batteryCode: 'BLPA63 / BLPA65',
    batteryCapacity: '5000 mAh / 5800 mAh',
    chargingWatt: '45W SuperVOOC',
    displayType: 'AMOLED phẳng 6.67 inch, 120Hz, FHD+ (2400 x 1080)',
    screenSpecs: 'Màn hình 6.67 inch đục lỗ giữa, tần số quét 120Hz',
    backCoverNotes: 'Cụm camera vuông bo xẻ rãnh, thiết kế mặt lưng nhám mờ thanh lịch',
    cameraSpecs: '3 Camera sau: 50MP Chính + 8MP Siêu rộng + 2MP Macro',
    commonPartsNotes: 'Linh kiện chuyên biệt cho series Reno 13F (CPH2699), KHÔNG DÙNG CHUNG với Find X8 hay Reno 13 5G!',
  },
  reno_13_5g: {
    modelName: 'OPPO Reno13 5G',
    modelCodes: ['CPH2689', 'PKM110'],
    batteryCode: 'BLPA59',
    batteryCapacity: '5600 mAh',
    chargingWatt: '80W SuperVOOC',
    displayType: 'AMOLED 6.59 inch, 120Hz, FHD+ (2760 x 1256)',
    screenSpecs: 'Kính Gorilla Glass 7i',
    backCoverNotes: 'Thiết kế mặt lưng nhám mờ đơn khối',
    cameraSpecs: '3 Camera sau: 50MP OIS + 8MP Siêu rộng + 50MP Tele',
    commonPartsNotes: 'Pin BLPA59 và màn hình chuyên biệt cho Reno 13 5G',
  },
  find_x8: {
    modelName: 'OPPO Find X8',
    modelCodes: ['CPH2651', 'PKB110'],
    batteryCode: 'BLPA41',
    batteryCapacity: '5630 mAh (Công nghệ Pin Silicon-Carbon Glacier)',
    chargingWatt: '80W SuperVOOC, 50W AirVOOC không dây',
    displayType: 'LTPS AMOLED phẳng hoàn toàn, 120Hz, 1.5K (2760 x 1256)',
    screenSpecs: 'Kích thước 6.59 inch, viền siêu mỏng 1.45mm đều 4 cạnh, kính Gorilla Glass 7i',
    backCoverNotes: 'Mặt lưng kính phẳng cường lực, khung sườn nhôm vuông vức. Khác ngàm với Find X8 Pro!',
    cameraSpecs: '3 Camera sau: Chính 50MP Sony LYT-700 OIS + Siêu rộng 50MP JN5 + Tele tiềm vọng 3X 50MP Sony LYT-600 OIS',
    commonPartsNotes: 'Màn hình, nắp lưng, pin, cụm camera và cáp sub KHÔNG DÙNG CHUNG với Find X8 Pro (CPH2659)',
  },
  find_x8_pro: {
    modelName: 'OPPO Find X8 Pro',
    modelCodes: ['CPH2659', 'CPH2691', 'PKC110'],
    batteryCode: 'BLPA45',
    batteryCapacity: '5910 mAh (Công nghệ Pin Silicon-Carbon Glacier)',
    chargingWatt: '80W SuperVOOC, 50W AirVOOC không dây',
    displayType: 'LTPO AMOLED Micro-Quad Curved (cong nhẹ 4 cạnh), 120Hz, 1.5K (2780 x 1264)',
    screenSpecs: 'Kích thước 6.78 inch, kính Gorilla Glass Victus 2',
    backCoverNotes: 'Mặt lưng kính bo cong 4 cạnh nhẹ, có khoét ngàm nút cảm ứng Quick Button (Camera Control)',
    cameraSpecs: '4 Camera sau: Chính 50MP Sony LYT-808 1/1.4" OIS + Siêu rộng 50MP JN5 + Tele 3X 50MP LYT-600 + Tele 6X 50MP Sony IMX858 OIS',
    commonPartsNotes: 'Màn hình, pin BLPA45, nắp lưng và cụm camera KHÔNG DÙNG CHUNG với Find X8 thường',
  },
  reno_12_5g: {
    modelName: 'OPPO Reno 12 5G',
    modelCodes: ['CPH2625'],
    batteryCode: 'BLPA17',
    batteryCapacity: '5000 mAh',
    chargingWatt: '80W SuperVOOC',
    displayType: 'AMOLED cong 3D viền 2 bên, 120Hz, FHD+ (2412 x 1080)',
    screenSpecs: 'Kích thước 6.7 inch, kính Gorilla Glass 7i',
    backCoverNotes: 'Mặt lưng họa tiết sóng nước Fluid Ripple đơn khối, ngàm camera phẳng. KHÔNG DÙNG CHUNG với Reno 12 Pro!',
    cameraSpecs: '3 Camera sau: Chính 50MP Sony LYT-600 OIS + Siêu rộng 8MP + Macro 2MP',
    commonPartsNotes: 'Nắp lưng, khung sườn, màn hình, cáp sub KHÔNG DÙNG CHUNG với Reno 12 Pro (CPH2629)',
  },
  reno_12_pro_5g: {
    modelName: 'OPPO Reno 12 Pro 5G',
    modelCodes: ['CPH2629'],
    batteryCode: 'BLPA19',
    batteryCapacity: '5000 mAh',
    chargingWatt: '80W SuperVOOC',
    displayType: 'AMOLED Quad-Curved (cong nhẹ 4 cạnh), 120Hz, FHD+ (2412 x 1080)',
    screenSpecs: 'Kích thước 6.7 inch, kính Gorilla Glass Victus 2',
    backCoverNotes: 'Mặt lưng Two-Tone (hai dải màu ruy-băng kim loại), viền camera khắc họa tiết Clous de Paris kim cương',
    cameraSpecs: '3 Camera sau: Chính 50MP Sony LYT-600 OIS + Siêu rộng 8MP + Tele 50MP Samsung JN5 zoom 2X',
    commonPartsNotes: 'Nắp lưng, màn hình và pin BLPA19 chuyên biệt cho Reno 12 Pro',
  },
  reno_12f_5g: {
    modelName: 'OPPO Reno 12F 5G / 4G',
    modelCodes: ['CPH2637', 'CPH2687'],
    batteryCode: 'BLPA21',
    batteryCapacity: '5000 mAh',
    chargingWatt: '45W SuperVOOC',
    displayType: 'AMOLED phẳng 6.67 inch, 120Hz, FHD+',
    screenSpecs: 'Kích thước 6.67 inch phẳng hoàn toàn',
    backCoverNotes: 'Cụm camera tròn Cosmos Ring có dải đèn LED Halo Light phát sáng đa sắc',
    cameraSpecs: 'Chính 50MP + Siêu rộng 8MP + Macro 2MP',
    commonPartsNotes: 'Pin BLPA21, bo sạc và nắp lưng dùng riêng cho series Reno 12F',
  },
  find_n3: {
    modelName: 'OPPO Find N3 (Màn gập)',
    modelCodes: ['CPH2499'],
    batteryCode: 'Hệ thống Pin kép BLPA23 (2095 mAh) + BLPA25 (2710 mAh)',
    batteryCapacity: 'Tổng dung lượng 4805 mAh',
    chargingWatt: '67W SuperVOOC',
    displayType: 'Màn hình trong: 7.82" OLED 120Hz gập; Màn hình ngoài: 6.31" OLED 120Hz',
    screenSpecs: 'Bản lề giọt nước Flexion Hinge hợp kim titan, cảm ứng lực',
    backCoverNotes: 'Mặt lưng da nhân tạo hoặc kính cường lực cao cấp',
    cameraSpecs: 'Cụm camera tròn Hasselblad: 48MP LYT-T808 + 48MP Siêu rộng + 64MP Tele tiềm vọng 3X',
    commonPartsNotes: 'Cần KTV được đào tạo chứng chỉ chuyên sâu dòng Fold để tháo lắp cáp bản lề',
  },
  reno_11_5g: {
    modelName: 'OPPO Reno 11 5G',
    modelCodes: ['CPH2599'],
    batteryCode: 'BLPA01',
    batteryCapacity: '5000 mAh',
    chargingWatt: '67W SuperVOOC',
    displayType: 'AMOLED cong 6.7 inch, 120Hz, FHD+',
    screenSpecs: 'Kính cong 3D 2 cạnh viền',
    backCoverNotes: 'Mặt lưng lượn sóng lụa (Wave Silk)',
    cameraSpecs: '50MP Sony LYT-600 OIS + 32MP Tele Sony IMX709 2X + 8MP Siêu rộng',
    commonPartsNotes: 'Pin BLPA01, màn hình và nắp lưng chuyên biệt CPH2599',
  },
  reno_11_pro_5g: {
    modelName: 'OPPO Reno 11 Pro 5G',
    modelCodes: ['CPH2607'],
    batteryCode: 'BLPA03',
    batteryCapacity: '4600 mAh',
    chargingWatt: '80W SuperVOOC',
    displayType: 'AMOLED cong 6.7 inch, 120Hz, 1.5K',
    screenSpecs: 'Kính cong 3D',
    backCoverNotes: 'Mặt lưng ngọc trai trắng hoặc đen nhám',
    cameraSpecs: '50MP Sony IMX890 OIS + 32MP Tele IMX709 + 8MP Siêu rộng',
    commonPartsNotes: 'Pin BLPA03, màn hình 1.5K không dùng chung với Reno 11 thường',
  },
  reno_10_5g: {
    modelName: 'OPPO Reno 10 5G',
    modelCodes: ['CPH2531'],
    batteryCode: 'BLP993',
    batteryCapacity: '5000 mAh',
    chargingWatt: '67W SuperVOOC',
    displayType: 'AMOLED cong 6.7 inch, 120Hz, FHD+',
    screenSpecs: 'Màn hình cong 3D',
    backCoverNotes: 'Thiết kế Glow xám hoặc xanh băng tuyết',
    cameraSpecs: '64MP Chính + 32MP Tele IMX709 + 8MP Siêu rộng',
    commonPartsNotes: 'Pin BLP993 dùng chung với OPPO A79 5G',
  },
  reno_10_pro_plus: {
    modelName: 'OPPO Reno 10 Pro+ 5G',
    modelCodes: ['CPH2521'],
    batteryCode: 'BLPA07',
    batteryCapacity: '4700 mAh',
    chargingWatt: '100W SuperVOOC',
    displayType: 'AMOLED cong 6.74 inch 1.5K, 120Hz',
    screenSpecs: 'Kính cong 3D 1.5K',
    backCoverNotes: 'Mặt lưng kính tím hoặc xám bạc, có camera tiềm vọng hình chữ nhật',
    cameraSpecs: '50MP IMX890 OIS + 64MP Tele tiềm vọng OIS + 8MP Siêu rộng',
    commonPartsNotes: 'Pin BLPA07 sạc 100W chuyên biệt',
  },
  oppo_a78_4g: {
    modelName: 'OPPO A78 4G',
    modelCodes: ['CPH2565'],
    batteryCode: 'BLP987',
    batteryCapacity: '5000 mAh',
    chargingWatt: '67W SuperVOOC',
    displayType: 'AMOLED phẳng 6.43 inch, 90Hz, FHD+',
    screenSpecs: 'Đục lỗ góc trái, kính Gorilla Glass 5',
    backCoverNotes: 'Thiết kế kim cương vát phẳng góc cạnh',
    cameraSpecs: '50MP Chính + 2MP Đo chiều sâu',
    commonPartsNotes: 'Pin BLP987, màn hình AMOLED 6.43" phẳng',
  },
  oppo_a78_5g: {
    modelName: 'OPPO A78 5G',
    modelCodes: ['CPH2483'],
    batteryCode: 'BLP923',
    batteryCapacity: '5000 mAh',
    chargingWatt: '33W SuperVOOC',
    displayType: 'IPS LCD giọt nước 6.56 inch, 90Hz, HD+',
    screenSpecs: 'Màn giọt nước IPS LCD, KHÔNG dùng chung với A78 4G',
    backCoverNotes: 'Khung sườn vuông vức',
    cameraSpecs: '50MP Chính + 2MP Mono',
    commonPartsNotes: 'Màn hình LCD và Pin BLP923 khác biệt hoàn toàn bản 4G',
  },
  oppo_a58: {
    modelName: 'OPPO A58',
    modelCodes: ['CPH2577'],
    batteryCode: 'BLP997',
    batteryCapacity: '5000 mAh',
    chargingWatt: '33W SuperVOOC',
    displayType: 'IPS LCD đục lỗ giữa 6.72 inch, FHD+',
    screenSpecs: 'Màn hình lớn 6.72 inch FHD+',
    backCoverNotes: 'Mặt lưng Glowing silk lụa xanh hoặc đen nhám',
    cameraSpecs: '50MP Chính + 2MP Mono',
    commonPartsNotes: 'Pin BLP997 dùng chung với OPPO A38 và A18',
  },
  oppo_a38_a18: {
    modelName: 'OPPO A38 / OPPO A18',
    modelCodes: ['CPH2579', 'CPH2591'],
    batteryCode: 'BLP997',
    batteryCapacity: '5000 mAh',
    chargingWatt: 'A38 sạc 33W, A18 sạc 18W',
    displayType: 'IPS LCD giọt nước 6.56 inch, 90Hz',
    screenSpecs: 'Màn hình giọt nước 6.56"',
    backCoverNotes: 'Mặt lưng Oppo Glow',
    cameraSpecs: 'A38: 50MP + 2MP; A18: 8MP + 2MP',
    commonPartsNotes: 'Pin BLP997 và màn hình dùng chung giữa A38 và A18',
  },
  oppo_a60: {
    modelName: 'OPPO A60',
    modelCodes: ['CPH2631'],
    batteryCode: 'BLPA15',
    batteryCapacity: '5000 mAh',
    chargingWatt: '45W SuperVOOC',
    displayType: 'IPS LCD đục lỗ giữa 6.67 inch, 90Hz, độ sáng 950 nits',
    screenSpecs: 'Chuẩn độ bền quân đội MIL-STD-810H',
    backCoverNotes: 'Mặt lưng vân gợn sóng biển',
    cameraSpecs: '50MP Chính + 2MP Đo chiều sâu',
    commonPartsNotes: 'Pin BLPA15 và màn hình LCD 6.67"',
  },
  oppo_a79_5g: {
    modelName: 'OPPO A79 5G',
    modelCodes: ['CPH2557'],
    batteryCode: 'BLP993',
    batteryCapacity: '5000 mAh',
    chargingWatt: '33W SuperVOOC',
    displayType: 'IPS LCD 6.72 inch FHD+, 90Hz',
    screenSpecs: 'Đục lỗ giữa',
    backCoverNotes: 'Thiết kế lông vũ phát sáng hoặc xanh tím',
    cameraSpecs: '50MP Chính + 2MP Đo chiều sâu',
    commonPartsNotes: 'Pin BLP993 dùng chung với Reno 10 5G',
  },
};

// Helper to remove Vietnamese diacritics for flexible fuzzy matching
export function removeDiacritics(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/**
 * Technician workload profile
 */
export interface TechnicianWorkloadStat {
  name: string;
  totalAssigned: number;
  totalCreated: number;
  step1_da_tao_phieu: number;
  step2_da_xin_lk: number;
  step3_da_nhap_kho: number;
  step4_da_goi_kh: number;
  step5_da_hoan_tat: number;
  da_bo_mau: number;
  overdue_7_days: number;
  svd_3_days: number;
  cancel_requested: number;
  device_iot_count: number;
  active_pending_total: number;
  urgent_tickets: Array<{
    ticketNumber: string;
    customerName: string;
    customerPhone: string;
    model: string;
    partName: string;
    status: string;
    bookingDate: string;
    isOverdue7: boolean;
    isSvd3: boolean;
    note: string;
  }>;
}

/**
 * Calculates detailed workload statistics for all technicians & employees
 */
export function analyzeTechniciansWorkload(
  shortageBookings: ShortageBookingItem[] = [],
  deviceIotBookings: DeviceIotBookingItem[] = [],
  techniciansList: TechnicianItem[] = []
): Map<string, TechnicianWorkloadStat> {
  const statsMap = new Map<string, TechnicianWorkloadStat>();

  // Helper to ensure technician entry
  const getOrCreate = (name: string): TechnicianWorkloadStat => {
    const cleanName = name.trim();
    if (!statsMap.has(cleanName)) {
      statsMap.set(cleanName, {
        name: cleanName,
        totalAssigned: 0,
        totalCreated: 0,
        step1_da_tao_phieu: 0,
        step2_da_xin_lk: 0,
        step3_da_nhap_kho: 0,
        step4_da_goi_kh: 0,
        step5_da_hoan_tat: 0,
        da_bo_mau: 0,
        overdue_7_days: 0,
        svd_3_days: 0,
        cancel_requested: 0,
        device_iot_count: 0,
        active_pending_total: 0,
        urgent_tickets: [],
      });
    }
    return statsMap.get(cleanName)!;
  };

  // Pre-seed known technicians
  techniciansList.forEach((t) => {
    if (t.name) getOrCreate(t.name);
  });

  const now = Date.now();

  // Parse shortage bookings
  shortageBookings.forEach((b) => {
    const techName = (b.technicianName || '').trim();
    const creatorTech = (b.creatorTechnician || '').trim();
    const createdBy = (b.createdBy || '').trim();

    // Check aging
    const createdTs = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    const isOverdue7 = createdTs > 0 && now - createdTs > 7 * 24 * 3600 * 1000 && b.status !== 'da_hoan_tat' && b.status !== 'da_bo_mau';
    const isSvd3 = Boolean(b.customerKeepsPart) && createdTs > 0 && now - createdTs > 3 * 24 * 3600 * 1000 && b.status !== 'da_hoan_tat' && b.status !== 'da_bo_mau';

    // Account for assigned technician
    if (techName && techName !== 'Chưa gán') {
      const s = getOrCreate(techName);
      s.totalAssigned += 1;

      if (b.status === 'da_tao_phieu') {
        s.step1_da_tao_phieu += 1;
        s.active_pending_total += 1;
      } else if (b.status === 'da_xin_lk' || b.status === 'chua_xin_du_lk') {
        s.step2_da_xin_lk += 1;
        s.active_pending_total += 1;
      } else if (b.status === 'da_nhap_kho') {
        s.step3_da_nhap_kho += 1;
        s.active_pending_total += 1;
      } else if (b.status === 'da_goi_kh') {
        s.step4_da_goi_kh += 1;
        s.active_pending_total += 1;
      } else if (b.status === 'da_hoan_tat') {
        s.step5_da_hoan_tat += 1;
      } else if (b.status === 'da_bo_mau' || b.isCompletedWithoutRepair) {
        s.da_bo_mau += 1;
      }

      if (isOverdue7) s.overdue_7_days += 1;
      if (isSvd3) s.svd_3_days += 1;
      if (b.cancelRequested) s.cancel_requested += 1;

      if ((b.status === 'da_tao_phieu' || isOverdue7 || isSvd3 || b.cancelRequested) && s.urgent_tickets.length < 8) {
        s.urgent_tickets.push({
          ticketNumber: b.ticketNumber,
          customerName: b.customerName,
          customerPhone: b.customerPhone,
          model: b.model || '',
          partName: b.partName || b.partCode,
          status: b.status,
          bookingDate: b.bookingDate,
          isOverdue7,
          isSvd3,
          note: b.note || '',
        });
      }
    }

    // Account for creator technician / user
    if (creatorTech && creatorTech !== techName) {
      const s = getOrCreate(creatorTech);
      s.totalCreated += 1;
    }
    if (createdBy && createdBy !== techName && createdBy !== creatorTech) {
      const s = getOrCreate(createdBy);
      s.totalCreated += 1;
    }
  });

  // Parse device & IOT bookings
  deviceIotBookings.forEach((d) => {
    const techName = (d.technicianName || d.creatorTechnician || d.loanHandoverBy || d.loanReceivedBy || '').trim();
    if (techName) {
      const s = getOrCreate(techName);
      s.device_iot_count += 1;
    }
  });

  return statsMap;
}

/**
 * Customer backorder summary for a specific part code or model
 */
export interface PartBackorderStat {
  partCode: string;
  partName: string;
  model: string;
  location: string;
  stockQty: number;
  price?: string;
  totalWaitingCount: number;
  totalCompletedCount: number;
  waitingTickets: Array<{
    ticketNumber: string;
    customerName: string;
    customerPhone: string;
    model: string;
    bookingDate: string;
    status: string;
    technicianName: string;
    note: string;
  }>;
}

/**
 * Analyzes part codes and customer waitlists across the shortage database
 */
export function analyzePartCodeBackorders(
  shortageBookings: ShortageBookingItem[] = [],
  catalog: LabelItem[] = []
): Map<string, PartBackorderStat> {
  const map = new Map<string, PartBackorderStat>();

  // Pre-seed from catalog
  catalog.forEach((item) => {
    const code = (item.code || '').trim();
    if (code && !map.has(code)) {
      map.set(code, {
        partCode: code,
        partName: item.name || '',
        model: item.model || '',
        location: item.location || 'Chưa gán kệ',
        stockQty: item.quantity || 0,
        price: item.price,
        totalWaitingCount: 0,
        totalCompletedCount: 0,
        waitingTickets: [],
      });
    }
  });

  // Aggregate shortage bookings
  shortageBookings.forEach((b) => {
    const code = (b.partCode || '').trim();
    if (!code) return;

    if (!map.has(code)) {
      map.set(code, {
        partCode: code,
        partName: b.partName || 'Linh kiện đặt chờ',
        model: b.model || '',
        location: b.location || 'Chưa gán kệ',
        stockQty: 0,
        totalWaitingCount: 0,
        totalCompletedCount: 0,
        waitingTickets: [],
      });
    }

    const stat = map.get(code)!;
    const isCompleted = b.status === 'da_hoan_tat' || b.status === 'da_bo_mau';

    if (isCompleted) {
      stat.totalCompletedCount += 1;
    } else {
      stat.totalWaitingCount += 1;
      if (stat.waitingTickets.length < 15) {
        stat.waitingTickets.push({
          ticketNumber: b.ticketNumber,
          customerName: b.customerName,
          customerPhone: b.customerPhone,
          model: b.model || '',
          bookingDate: b.bookingDate,
          status: b.status,
          technicianName: b.technicianName || 'Chưa gán',
          note: b.note || '',
        });
      }
    }
  });

  return map;
}

/**
 * High-precision Catalog Search Matcher:
 * Directly scores all items from the master catalog (5,700+ rows) against user query.
 */
export function searchAccurateCatalogItems(
  query: string,
  catalog: LabelItem[] = [],
  maxResults = 20
): Array<{
  ma_sp_cot_a: string;
  ten_linh_kien_cot_b: string;
  model_cot_c: string;
  phan_loai: string;
  vi_tri_kho: string;
  ton_kho_thuc_te: number;
  don_gia: string;
  action_deep_link: string;
  quick_ask_link: string;
  score: number;
}> {
  if (!catalog || catalog.length === 0) return [];
  const cleanQ = (query || '').toLowerCase().trim();
  if (!cleanQ) return [];

  const normQ = removeDiacritics(cleanQ);

  // Extract query alphanumeric code tokens (e.g. "4886441", "621033000404", "a76", "cph2599")
  const queryTokens = normQ
    .split(/[\s,+/|;:-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 1);

  if (queryTokens.length === 0) return [];

  const matchedItemsWithScore: Array<{
    item: LabelItem;
    score: number;
  }> = [];

  for (const item of catalog) {
    const code = (item.code || '').trim();
    const name = (item.name || '').trim();
    const model = (item.model || '').trim();
    const category = (item.category || '').trim();
    const location = (item.location || '').trim();

    const normCode = removeDiacritics(code);
    const normName = removeDiacritics(name);
    const normModel = removeDiacritics(model);
    const normCategory = removeDiacritics(category);
    const combinedSearchStr = `${normCode} ${normName} ${normModel} ${normCategory} ${removeDiacritics(location)}`;

    let score = 0;

    // 1. Exact Code Match (+1000)
    if (normCode && (normQ === normCode || cleanQ === code.toLowerCase())) {
      score += 1000;
    } else if (normCode && normCode.length >= 4 && normQ.includes(normCode)) {
      score += 600;
    }

    // 2. Exact Model Match (+350)
    if (normModel && normModel.length >= 2) {
      if (normQ === normModel) score += 400;
      else if (normQ.includes(normModel)) score += 300;
    }

    // 3. Exact Substring in Name (+250)
    if (normName && normName.includes(normQ)) {
      score += 300;
    }

    // 4. Token Intersection Match
    let matchedTokenCount = 0;
    for (const token of queryTokens) {
      if (token.length === 0) continue;
      // Check if token matches code, name, model, category
      if (normCode.includes(token)) {
        score += 100;
        matchedTokenCount++;
      } else if (normModel.includes(token)) {
        score += 80;
        matchedTokenCount++;
      } else if (normName.includes(token)) {
        score += 50;
        matchedTokenCount++;
      } else if (combinedSearchStr.includes(token)) {
        score += 25;
        matchedTokenCount++;
      }
    }

    // Huge bonus if ALL query tokens are present in this item
    if (matchedTokenCount === queryTokens.length && queryTokens.length >= 2) {
      score += 250;
    } else if (matchedTokenCount >= 2) {
      score += 60 * matchedTokenCount;
    }

    if (score >= 40) {
      matchedItemsWithScore.push({ item, score });
    }
  }

  // Sort descending by match score
  matchedItemsWithScore.sort((a, b) => b.score - a.score);

  return matchedItemsWithScore.slice(0, maxResults).map(({ item, score }) => ({
    ma_sp_cot_a: item.code || '',
    ten_linh_kien_cot_b: item.name || '',
    model_cot_c: item.model || '',
    phan_loai: item.category || 'Linh kiện',
    vi_tri_kho: item.location || 'Chưa gán kệ',
    ton_kho_thuc_te: Number(item.quantity) || 0,
    don_gia: item.price ? `${item.price}` : 'Theo bảng giá GCSM',
    action_deep_link: `[[ACTION:catalog?search=${encodeURIComponent(item.code || '')}|🔍 Xem mã ${item.code} trong Bảng Dữ Liệu Tem]]`,
    quick_ask_link: `[[ACTION:ask:Chi tiết mã ${item.code} ${item.name}|📦 Tra cứu ${item.name} (${item.code})]]`,
    score,
  }));
}

/**
 * Generates smart interactive clarification buttons when query is broad or ambiguous
 */
export function generateSmartClarification(
  query: string,
  matchedCatalog: Array<{ ma_sp_cot_a: string; ten_linh_kien_cot_b: string; model_cot_c: string; ton_kho_thuc_te: number }>,
  technicians: Array<{ ten_nhan_vien: string; tong_dang_cho_xu_ly: number }>
): { isAmbiguous: boolean; promptMessage: string; interactiveOptions: string[] } {
  const cleanQ = (query || '').toLowerCase().trim();
  const normQ = removeDiacritics(cleanQ);
  const options: string[] = [];

  // 1. If multiple distinct catalog items matched (e.g. user just typed "A76" or "miếng dán")
  if (matchedCatalog.length > 1 && !matchedCatalog.some((c) => normQ === removeDiacritics(c.ma_sp_cot_a))) {
    const topCandidates = matchedCatalog.slice(0, 4);
    topCandidates.forEach((c) => {
      options.push(`[[ACTION:ask:Mã linh kiện ${c.ma_sp_cot_a} ${c.ten_linh_kien_cot_b}|📦 ${c.ten_linh_kien_cot_b} (Mã ${c.ma_sp_cot_a})]]`);
    });
    return {
      isAmbiguous: true,
      promptMessage: `Hệ thống tìm thấy nhiều linh kiện liên quan đến "${query}". Bạn có thể bấm chọn nhanh mục cần tra cứu:`,
      interactiveOptions: options,
    };
  }

  // 2. If broad technician question
  if (technicians.length > 1 && (normQ.includes('ktv') || normQ.includes('nhan vien')) && !technicians.some((t) => normQ.includes(removeDiacritics(t.ten_nhan_vien)))) {
    technicians.slice(0, 4).forEach((t) => {
      options.push(`[[ACTION:ask:KTV ${t.ten_nhan_vien} còn bao nhiêu linh kiện chờ?|👤 KTV ${t.ten_nhan_vien} (${t.tong_dang_cho_xu_ly} phiếu)]]`);
    });
    return {
      isAmbiguous: true,
      promptMessage: `Vui lòng chọn Kỹ thuật viên bạn muốn kiểm tra tải công việc:`,
      interactiveOptions: options,
    };
  }

  return {
    isAmbiguous: false,
    promptMessage: '',
    interactiveOptions: [],
  };
}

/**
 * Intelligent RAG helper: Extracts relevant catalog items, technician statistics,
 * customer waitlists, and hardware specs for the given user query.
 */
export function buildRagContextForQuery(
  query: string,
  catalog: LabelItem[] = [],
  shortageBookings: ShortageBookingItem[] = [],
  workspaceSummary?: {
    labelsCount?: number;
    catalogCount?: number;
    shortageCount?: number;
    pendingBookingsCount?: number;
    techniciansCount?: number;
    currentUser?: { name: string; role: string };
  },
  deviceIotBookings: DeviceIotBookingItem[] = [],
  techniciansList: TechnicianItem[] = []
) {
  const cleanQ = (query || '').toLowerCase();
  const normalizedQ = removeDiacritics(cleanQ);

  // 1. Exact High-Precision Catalog Items Matching
  const accurateCatalogMatches = searchAccurateCatalogItems(query, catalog, 20);

  // 2. Identify Hardware Specs from genuine DB
  const matchedSpecsWithScore: Array<{ spec: DeviceHardwareSpec; score: number }> = [];
  for (const [key, spec] of Object.entries(GENUINE_OPPO_HARDWARE_SPECS)) {
    const normSpecName = removeDiacritics(spec.modelName);
    const isNameMatch = normalizedQ.includes(normSpecName);
    const matchedCode = spec.modelCodes.find((c) => normalizedQ.includes(removeDiacritics(c)));
    const isKeyMatch = normalizedQ.includes(key.replace(/_/g, ' '));

    if (isNameMatch || matchedCode || isKeyMatch) {
      let score = 0;
      if (matchedCode) score += 50;
      if (isNameMatch) score += normSpecName.length;
      if (isKeyMatch) score += 10;
      matchedSpecsWithScore.push({ spec, score });
    }
  }

  // Sort highest score first
  matchedSpecsWithScore.sort((a, b) => b.score - a.score);
  const matchedSpecs: DeviceHardwareSpec[] = matchedSpecsWithScore.map((m) => m.spec);

  // 3. Identify Technician Queries & Workload
  const techStatsMap = analyzeTechniciansWorkload(shortageBookings, deviceIotBookings, techniciansList);
  const matchedTechnicians: Array<{
    ten_nhan_vien: string;
    tong_phieu_phu_trach: number;
    tong_phieu_tao: number;
    dang_cho_xu_ly_b1: number;
    da_xin_lk_b2: number;
    da_ve_kho_b3: number;
    da_goi_kh_b4: number;
    da_hoan_tat_b5: number;
    bo_mau_dong_phieu: number;
    tong_dang_cho_xu_ly: number;
    canh_bao_qua_7_ngay: number;
    canh_bao_svd_3_ngay: number;
    phieu_may_iot: number;
    phieu_uu_tien_can_xu_ly: any[];
    action_deep_link: string;
  }> = [];

  const isAskingTechnician =
    normalizedQ.includes('ktv') ||
    normalizedQ.includes('ky thuat') ||
    normalizedQ.includes('nhan vien') ||
    normalizedQ.includes('phu trach') ||
    normalizedQ.includes('ai dang') ||
    normalizedQ.includes('tai cong viec') ||
    normalizedQ.includes('danh sach ktv');

  // Search each technician
  for (const [name, stat] of techStatsMap.entries()) {
    const normName = removeDiacritics(name);
    const isDirectMatch = normName && (normalizedQ.includes(normName) || (normName.length >= 3 && normalizedQ.includes(normName.split(' ').pop() || '')));
    if (isDirectMatch || isAskingTechnician) {
      matchedTechnicians.push({
        ten_nhan_vien: stat.name,
        tong_phieu_phu_trach: stat.totalAssigned,
        tong_phieu_tao: stat.totalCreated,
        dang_cho_xu_ly_b1: stat.step1_da_tao_phieu,
        da_xin_lk_b2: stat.step2_da_xin_lk,
        da_ve_kho_b3: stat.step3_da_nhap_kho,
        da_goi_kh_b4: stat.step4_da_goi_kh,
        da_hoan_tat_b5: stat.step5_da_hoan_tat,
        bo_mau_dong_phieu: stat.da_bo_mau,
        tong_dang_cho_xu_ly: stat.active_pending_total,
        canh_bao_qua_7_ngay: stat.overdue_7_days,
        canh_bao_svd_3_ngay: stat.svd_3_days,
        phieu_may_iot: stat.device_iot_count,
        phieu_uu_tien_can_xu_ly: stat.urgent_tickets,
        action_deep_link: `[[ACTION:shortage?search=${encodeURIComponent(stat.name)}|🔍 Xem tất cả phiếu của KTV ${stat.name}]]`,
      });
    }
  }

  // Sort matched technicians by highest active pending tickets first
  matchedTechnicians.sort((a, b) => b.tong_dang_cho_xu_ly - a.tong_dang_cho_xu_ly);

  // 4. Search relevant Part Code Backorders & Waitlists
  const partBackordersMap = analyzePartCodeBackorders(shortageBookings, catalog);
  const matchedPartBackorders: Array<{
    ma_linh_kien: string;
    ten_linh_kien: string;
    model_may: string;
    vi_tri_kho: string;
    ton_kho_hien_tai: number;
    don_gia?: string;
    so_khach_dang_cho: number;
    so_khach_da_hoan_tat: number;
    tinh_trang_cung_cau: string;
    danh_sach_khach_cho: any[];
    action_deep_link: string;
  }> = [];

  const tokens = normalizedQ
    .split(/[\s,+/|;:-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  // Scan part backorders
  for (const [code, stat] of partBackordersMap.entries()) {
    const normCode = removeDiacritics(code);
    const normName = removeDiacritics(stat.partName);
    const normModel = removeDiacritics(stat.model);

    let match = false;
    if (normalizedQ.includes(normCode) && normCode.length >= 4) {
      match = true;
    } else if (normCode && tokens.some((t) => t.length >= 4 && normCode.includes(t))) {
      match = true;
    } else if (tokens.length >= 2 && tokens.every((t) => normName.includes(t) || normModel.includes(t))) {
      match = true;
    }

    if (match) {
      const diff = stat.stockQty - stat.totalWaitingCount;
      const statusText =
        diff >= 0
          ? `Đủ hàng (Tồn kho ${stat.stockQty} >= Đang chờ ${stat.totalWaitingCount})`
          : `Thiếu ${Math.abs(diff)} cái (Tồn kho ${stat.stockQty} < Đang chờ ${stat.totalWaitingCount})`;

      matchedPartBackorders.push({
        ma_linh_kien: stat.partCode,
        ten_linh_kien: stat.partName,
        model_may: stat.model || 'Chưa gán',
        vi_tri_kho: stat.location || 'Chưa gán kệ',
        ton_kho_hien_tai: stat.stockQty,
        don_gia: stat.price,
        so_khach_dang_cho: stat.totalWaitingCount,
        so_khach_da_hoan_tat: stat.totalCompletedCount,
        tinh_trang_cung_cau: statusText,
        danh_sach_khach_cho: stat.waitingTickets,
        action_deep_link: `[[ACTION:shortage?search=${encodeURIComponent(stat.partCode)}|📋 Xem ${stat.totalWaitingCount} phiếu chờ đặt mã ${stat.partCode}]]`,
      });

      if (matchedPartBackorders.length >= 15) break;
    }
  }

  // 5. Search specific Shortage Bookings
  const isAskingAboutShortage =
    normalizedQ.includes('phieu') ||
    normalizedQ.includes('dat cho') ||
    normalizedQ.includes('thieu') ||
    normalizedQ.includes('cho xu ly') ||
    normalizedQ.includes('khach') ||
    normalizedQ.includes('gap') ||
    normalizedQ.includes('canh bao') ||
    normalizedQ.includes('qua han') ||
    normalizedQ.includes('svd');

  let queryMatchedTickets: any[] = [];
  if (isAskingAboutShortage && shortageBookings.length > 0) {
    queryMatchedTickets = shortageBookings
      .filter((b) => {
        const tNum = removeDiacritics(b.ticketNumber || '');
        const cName = removeDiacritics(b.customerName || '');
        const cPhone = removeDiacritics(b.customerPhone || '');
        const pCode = removeDiacritics(b.partCode || '');
        const pModel = removeDiacritics(b.model || '');
        const pTech = removeDiacritics(b.technicianName || '');

        return (
          tNum.includes(normalizedQ) ||
          cName.includes(normalizedQ) ||
          cPhone.includes(normalizedQ) ||
          pCode.includes(normalizedQ) ||
          pModel.includes(normalizedQ) ||
          pTech.includes(normalizedQ)
        );
      })
      .slice(0, 10)
      .map((b) => ({
        ma_phieu: b.ticketNumber,
        khach_hang: b.customerName,
        dien_thoai: b.customerPhone,
        model_may: b.model,
        ma_linh_kien: b.partCode,
        ten_linh_kien: b.partName,
        trang_thai: b.status,
        ngay_tao: b.bookingDate,
        ktv_phu_trach: b.technicianName,
        ghi_chu: b.note,
      }));
  }

  // 6. Device & IOT Analytics
  const deviceIotSummary = {
    tong_phieu_may_iot: deviceIotBookings.length,
    doi_truc_tiep: deviceIotBookings.filter((d) => d.flowType === 'direct_exchange').length,
    xin_may: deviceIotBookings.filter((d) => d.flowType === 'request_device').length,
    khach_muon_may: deviceIotBookings.filter((d) => d.flowType === 'customer_loan').length,
    dang_muon_chua_tra: deviceIotBookings.filter((d) => d.status === 'dang_muon').length,
  };

  // 7. Interactive Clarification Options
  const clarification = generateSmartClarification(query, accurateCatalogMatches, matchedTechnicians);

  return {
    thong_ke_tong_quan_he_thong: {
      tong_ma_catalog: workspaceSummary?.catalogCount ?? catalog.length,
      tong_phieu_dat_cho: workspaceSummary?.shortageCount ?? shortageBookings.length,
      phieu_b1_cho_xu_ly: shortageBookings.filter((b) => b.status === 'da_tao_phieu').length,
      phieu_b2_da_xin_lk: shortageBookings.filter((b) => b.status === 'da_xin_lk' || b.status === 'chua_xin_du_lk').length,
      phieu_b3_da_nhap_kho: shortageBookings.filter((b) => b.status === 'da_nhap_kho').length,
      phieu_b4_da_goi_kh: shortageBookings.filter((b) => b.status === 'da_goi_kh').length,
      phieu_b5_da_hoan_tat: shortageBookings.filter((b) => b.status === 'da_hoan_tat').length,
      tong_ktv_truc: workspaceSummary?.techniciansCount ?? techniciansList.length,
      nguoi_dung_hien_tai: workspaceSummary?.currentUser?.name || 'Nhân viên OPPO HCM4',
      vai_tro: workspaceSummary?.currentUser?.role || 'staff',
    },
    danh_sach_linh_kien_trong_kho_khop_chinh_xac: accurateCatalogMatches.length > 0 ? accurateCatalogMatches : undefined,
    danh_sach_ma_linh_kien_va_khach_cho_dat: matchedPartBackorders.length > 0 ? matchedPartBackorders : undefined,
    thong_ke_nhan_su_va_ktv: matchedTechnicians.length > 0 ? matchedTechnicians : undefined,
    thong_so_phan_cung_chinh_xac_oppo: matchedSpecs.length > 0 ? matchedSpecs : undefined,
    phieu_khop_theo_tu_khoa: queryMatchedTickets.length > 0 ? queryMatchedTickets : undefined,
    tong_quan_may_va_iot: deviceIotBookings.length > 0 ? deviceIotSummary : undefined,
    nut_tuong_tac_lam_ro: clarification.isAmbiguous ? clarification : undefined,
  };
}
