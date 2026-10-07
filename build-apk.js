import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('=========================================================================');
echoHeader('HCM4 OPPO - DONG GOI VA BIEN DICH FILE APK CHO ANDROID');
console.log('=========================================================================\n');

function echoHeader(msg) {
  console.log(`\x1b[36m${msg}\x1b[0m`);
}

try {
  console.log('[1/3] Đang biên dịch ứng dụng Web (Vite Build)...');
  execSync('npx vite build', { stdio: 'inherit' });

  console.log('\n[2/3] Đang đồng bộ mã nguồn vào Android (Capacitor Sync)...');
  execSync('npx cap sync android', { stdio: 'inherit' });

  console.log('\n[3/3] Đang biên dịch mã nguồn Android thành file APK (Gradle Build)...');
  const androidDir = path.join(process.cwd(), 'android');
  const isWin = process.platform === 'win32';
  
  // Use absolute path or relative path to gradlew executable
  const gradlewExec = isWin 
    ? path.join(androidDir, 'gradlew.bat')
    : './gradlew';

  execSync(`"${gradlewExec}" assembleDebug`, { cwd: androidDir, stdio: 'inherit' });

  const apkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  
  console.log('\n=========================================================================');
  console.log('\x1b[32m [THÀNH CÔNG RỰC RỠ] File APK đã được tạo thành công tại:\x1b[0m');
  console.log(`\x1b[33m${apkPath}\x1b[0m`);
  console.log('=========================================================================\n');
  console.log('Bạn có thể chép file app-debug.apk này gửi qua Zalo để cài trên mọi điện thoại Android!');
} catch (error) {
  console.error('\n\x1b[31m[LỖI THỰC THI]\x1b[0m', error.message);
  console.log('\n-------------------------------------------------------------------------');
  console.log('👉 NẾU MÁY TÍNH CHƯA CÓ JAVA JDK 17 HẶC ANDROID SDK:');
  console.log('   Vui lòng mở dự án bằng Android Studio bằng cách chạy lệnh:');
  console.log('   \x1b[36mnpx cap open android\x1b[0m');
  console.log('   Sau đó bấm Menu: Build -> Build Bundle(s) / APK(s) -> Build APK(s)');
  console.log('-------------------------------------------------------------------------\n');
  process.exit(1);
}
