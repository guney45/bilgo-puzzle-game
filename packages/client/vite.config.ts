import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    // Cloudflare quick tunnel (*.trycloudflare.com) üzerinden telefonda test
    // ederken Vite'ın host kontrolü isteği reddetmesin diye. Yerel ağda WebSocket
    // upgrade'i aradaki cihaz tarafından düşürüldüğü için tünel kullanılıyor.
    allowedHosts: ['.trycloudflare.com'],
  },
  // `shared`, workspace paketi olduğu için Vite onu kaynaktan (/@fs/) sunuyor ve
  // ön-paketlemiyor. shared'ın CJS derlemesi `export * from` ifadelerini çalışma
  // zamanı `__exportStar` döngüsüyle üretiyor (bkz. ADR-006) — bu, esbuild'in dev
  // sunucusundaki statik CJS→ESM adlandırılmış export algılamasını atlıyor ve
  // "does not provide an export named ..." hatası veriyor. optimizeDeps.include
  // ile esbuild'in tam bağımlılık ön-paketleme geçişinden (build ile aynı yol)
  // geçmesini zorluyoruz.
  optimizeDeps: {
    include: ['shared'],
  },
});
