/* General */
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, sans-serif; }

/* Sidebar */
.sidebar { width: 250px; min-height: 100vh; flex-shrink: 0; }
.nav-link {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 15px; border-radius: 10px;
    color: #6b7280; font-size: 14px; transition: 0.3s;
}
.nav-link:hover { background-color: #f0fdf4; color: #16a34a; }
.nav-link.active { background-color: #dcfce7; color: #15803d; font-weight: bold; }
.nav-link:focus-visible, button:focus-visible { outline: 2px solid #16a34a; outline-offset: 2px; }

/* Cards */
.summary-card { transition: 0.3s; }
.summary-card:hover { transform: translateY(-4px); box-shadow: 0 8px 20px rgba(0, 0, 0, 0.05); }

/* Tables */
tbody tr:hover { background-color: #f9fafb; }
.icon-btn { font-size: 13px; padding: 4px 10px; border-radius: 8px; transition: 0.2s; }
.icon-btn.edit { color: #15803d; background: #f0fdf4; }
.icon-btn.edit:hover { background: #dcfce7; }
.icon-btn.del { color: #dc2626; background: #fef2f2; margin-left: 6px; }
.icon-btn.del:hover { background: #fee2e2; }

/* Goals */
.pill-btn { font-size: 12px; font-weight: 600; padding: 5px 12px; border-radius: 999px; transition: 0.2s; }
.pill-btn.on { background: #dcfce7; color: #15803d; }
.pill-btn.off { background: #f3f4f6; color: #6b7280; }
.pill-btn:disabled, .icon-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* On/Off switch */
.switch { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
.switch input { position: absolute; opacity: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; z-index: 1; }
.slider { position: absolute; inset: 0; background: #d1d5db; border-radius: 999px; transition: 0.2s; }
.slider::before { content: ""; position: absolute; width: 18px; height: 18px; left: 3px; top: 3px; background: #fff; border-radius: 50%; transition: 0.2s; }
.switch input:checked + .slider { background: #16a34a; }
.switch input:checked + .slider::before { transform: translateX(20px); }
.switch input:disabled { cursor: not-allowed; }
.switch input:disabled + .slider { opacity: 0.5; }
.switch input:focus-visible + .slider { outline: 2px solid #16a34a; outline-offset: 2px; }

/* Calculator */
.calc-display { background: #f9fafb; border: 1px solid #f3f4f6; }
.calc-btn {
    height: 56px; border-radius: 12px; font-size: 20px; font-weight: 600;
    background: #f3f4f6; color: #1f2937; transition: 0.15s;
}
.calc-btn:hover { background: #e5e7eb; }
.calc-btn:active { transform: scale(0.96); }
.calc-btn.fn { background: #e5e7eb; color: #374151; }
.calc-btn.fn:hover { background: #d1d5db; }
.calc-btn.op { background: #dcfce7; color: #15803d; }
.calc-btn.op:hover { background: #bbf7d0; }
.calc-btn.op.pending { background: #16a34a; color: #fff; }
.calc-btn.eq { background: #16a34a; color: #fff; }
.calc-btn.eq:hover { background: #15803d; }

/* Charts */
.chart-box { position: relative; height: 280px; }

/* Toast */
.toast {
    padding: 12px 18px; border-radius: 10px; color: #fff; font-size: 14px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.15);
    animation: toastIn 0.25s ease;
}
.toast.success { background: #16a34a; }
.toast.error { background: #dc2626; }
.toast.warn { background: #d97706; }
@keyframes toastIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

@media (prefers-reduced-motion: reduce) {
    * { transition: none !important; animation: none !important; }
}

/* Mobile */
@media (max-width: 768px) {
    .sidebar { width: 75px; padding: 12px; }
    .sidebar h1 { font-size: 13px; margin-bottom: 30px; word-break: break-word; }
    .sidebar nav a { font-size: 0; justify-content: center; padding: 14px 5px; }
    .sidebar nav a span { font-size: 20px; }
    .sidebar > div:last-child { display: none; }
}

@media (max-width: 480px) {
    main { padding: 15px !important; }
}
/* ================= Dark theme ================= */
html[data-theme="dark"] { color-scheme: dark; }
html[data-theme="dark"] body.bg-gray-50 { background-color: #0b1220; }
html[data-theme="dark"] .bg-white { background-color: #111827; }
html[data-theme="dark"] .bg-gray-100 { background-color: #1f2937; }
html[data-theme="dark"] .bg-green-50 { background-color: #052e16; }
html[data-theme="dark"] .border-gray-100,
html[data-theme="dark"] .border-gray-200,
html[data-theme="dark"] .border { border-color: #1f2937; }
html[data-theme="dark"] .border-red-200 { border-color: #7f1d1d; }
html[data-theme="dark"] .border-b { border-color: #1f2937; }

html[data-theme="dark"] .text-gray-800 { color: #f3f4f6; }
html[data-theme="dark"] .text-gray-700 { color: #e5e7eb; }
html[data-theme="dark"] .text-gray-500 { color: #9ca3af; }
html[data-theme="dark"] .text-gray-400 { color: #6b7280; }
html[data-theme="dark"] .text-green-800 { color: #bbf7d0; }
html[data-theme="dark"] .text-green-700 { color: #86efac; }
html[data-theme="dark"] .text-green-600 { color: #4ade80; }
html[data-theme="dark"] .text-red-600 { color: #f87171; }

html[data-theme="dark"] .hover\:bg-gray-50:hover { background-color: #1f2937; }
html[data-theme="dark"] .hover\:bg-gray-100:hover { background-color: #1f2937; }
html[data-theme="dark"] .hover\:bg-red-50:hover { background-color: #3b1212; }

/* Form fields */
html[data-theme="dark"] input,
html[data-theme="dark"] select {
    background-color: #0f172a; color: #f3f4f6; border-color: #374151;
}
html[data-theme="dark"] input::placeholder { color: #6b7280; }

/* Custom components */
html[data-theme="dark"] .nav-link { color: #9ca3af; }
html[data-theme="dark"] .nav-link:hover { background-color: #052e16; color: #4ade80; }
html[data-theme="dark"] .nav-link.active { background-color: #14532d; color: #bbf7d0; }
html[data-theme="dark"] tbody tr:hover { background-color: #1f2937; }
html[data-theme="dark"] .summary-card:hover { box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4); }
html[data-theme="dark"] .icon-btn.edit { color: #86efac; background: #052e16; }
html[data-theme="dark"] .icon-btn.edit:hover { background: #14532d; }
html[data-theme="dark"] .icon-btn.del { color: #f87171; background: #3b1212; }
html[data-theme="dark"] .icon-btn.del:hover { background: #4c1717; }
html[data-theme="dark"] .pill-btn.on { background: #14532d; color: #bbf7d0; }
html[data-theme="dark"] .pill-btn.off { background: #1f2937; color: #9ca3af; }
html[data-theme="dark"] .slider { background: #4b5563; }

/* Calculator (dark) */
html[data-theme="dark"] .calc-display { background: #0f172a; border-color: #1f2937; }
html[data-theme="dark"] .calc-btn { background: #1f2937; color: #f3f4f6; }
html[data-theme="dark"] .calc-btn:hover { background: #374151; }
html[data-theme="dark"] .calc-btn.fn { background: #374151; color: #e5e7eb; }
html[data-theme="dark"] .calc-btn.fn:hover { background: #4b5563; }
html[data-theme="dark"] .calc-btn.op { background: #14532d; color: #bbf7d0; }
html[data-theme="dark"] .calc-btn.op:hover { background: #166534; }
html[data-theme="dark"] .calc-btn.op.pending { background: #16a34a; color: #fff; }
html[data-theme="dark"] .calc-btn.eq { background: #16a34a; color: #fff; }
html[data-theme="dark"] .calc-btn.eq:hover { background: #15803d; }

/* Theme menu */
.theme-opt.active { background-color: #dcfce7; color: #15803d; font-weight: 600; }
html[data-theme="dark"] .theme-opt { color: #e5e7eb; }
html[data-theme="dark"] .theme-opt:hover { background-color: #1f2937; }
html[data-theme="dark"] .theme-opt.active { background-color: #14532d; color: #bbf7d0; }
