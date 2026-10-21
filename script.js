/* ================= Helpers & Config ================= */

const CATS = {
    income: ["Salary", "Freelance", "Gift", "Other Income"],
    expense: ["Food", "Transport", "Education", "Shopping", "Entertainment", "Health", "Bills", "Others"]
};
const ALL_CATS = [...CATS.income, ...CATS.expense];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const COLORS = ["#16a34a", "#0ea5e9", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#64748b"];

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = n => "৳ " + Number(n).toLocaleString("en-BD");
const pad = n => String(n).padStart(2, "0");
const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthKey = d => d.slice(0, 7);
const monthLabel = k => { const [y, m] = k.split("-"); return MONTHS[+m - 1] + " " + y; };
const sum = list => list.reduce((t, x) => t + x.amount, 0);

function load(key, fallback) {
    try {
        const v = JSON.parse(localStorage.getItem(key));
        return v === null ? fallback : v;
    } catch (e) { return fallback; }
}
function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { toast("Could not save data", "error"); }
}

const thisMonth = monthKey(localDate());

/* ================= Data ================= */

let transactions = load("transactions", []);
if (!Array.isArray(transactions)) transactions = [];

// One-time cleanup: remove the old demo transactions saved by earlier versions
const DEMO = ["Monthly Salary|30000", "Grocery Shopping|2000", "Bus Fare|500", "Course Fee|1500"];
if (!load("demoRemoved", false)) {
    transactions = transactions.filter(t => !DEMO.includes(t.title + "|" + t.amount));
    save("demoRemoved", true);
}

// Make older saved data compatible (add id, fix categories)
transactions = transactions.map((t, i) => {
    t.id = t.id || Date.now() + i;
    t.amount = Number(t.amount) || 0;
    if (!CATS[t.type]) t.type = "expense";
    if (!CATS[t.type].includes(t.category)) t.category = t.type === "income" ? "Salary" : "Others";
    return t;
});
let budget = Number(load("budget", 0)) || 0;
if (budget === 15000 && !load("budgetUserSet", false)) budget = 0; // old default, not chosen by user
let editingId = null;
let charts = {};

const persist = () => save("transactions", transactions);

/* ================= UI helpers ================= */

function toast(msg, type = "success") {
    const el = document.createElement("div");
    el.className = "toast " + type;
    el.textContent = msg;
    $("toastBox").appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

function fillSelect(select, items, keepValue) {
    const old = keepValue ? select.value : null;
    select.innerHTML = items.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("");
    if (old && items.some(([v]) => v === old)) select.value = old;
}

function barColor(p) { return p >= 100 ? "bg-red-500" : p >= 80 ? "bg-yellow-500" : "bg-green-500"; }
function textColor(p) { return p >= 100 ? "text-red-500" : p >= 80 ? "text-yellow-600" : "text-green-600"; }

function budgetStatus(spent) {
    const p = budget > 0 ? (spent / budget) * 100 : 0;
    const left = budget - spent;
    if (!(budget > 0)) return { p: 0, width: "0%", bar: "bg-green-500", text: "text-gray-500", msg: "No budget set yet. Set one on the Budget page." };
    return {
        p, width: Math.min(100, p).toFixed(1) + "%", bar: barColor(p), text: textColor(p),
        msg: left >= 0 ? money(left) + " remaining this month" : "Over budget by " + money(-left)
    };
}

function rowHtml(t, withActions) {
    const inc = t.type === "income";
    return `<tr class="border-b border-gray-100 text-sm">
        <td class="py-4 font-medium text-gray-800">${esc(t.title)}</td>
        <td class="py-4 text-gray-500">${esc(t.category)}</td>
        <td class="py-4 text-gray-500">${esc(t.date)}</td>
        <td class="py-4 text-right font-semibold ${inc ? "text-green-600" : "text-red-500"}">${inc ? "+" : "-"} ${money(t.amount)}</td>
        ${withActions ? `<td class="py-4 text-right whitespace-nowrap">
            <button class="icon-btn edit" data-edit="${t.id}">Edit</button>
            <button class="icon-btn del" data-del="${t.id}">Delete</button></td>` : ""}
    </tr>`;
}

const sorted = list => [...list].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
const emptyRow = (cols, text) => `<tr><td colspan="${cols}" class="py-10 text-center text-gray-400 text-sm">${text}</td></tr>`;

/* ================= Navigation ================= */

const TITLES = { dashboard: "Dashboard", transactions: "Transactions", budget: "Budget", reports: "Reports" };

function showPage(page) {
    if (!TITLES[page]) page = "dashboard";
    document.querySelectorAll(".page").forEach(p => p.classList.toggle("hidden", p.id !== "page-" + page));
    document.querySelectorAll(".nav-link").forEach(a => a.classList.toggle("active", a.dataset.page === page));
    $("pageTitle").textContent = TITLES[page];
    renderAll();
}

window.addEventListener("hashchange", () => showPage(location.hash.slice(1)));
$("viewAllBtn").addEventListener("click", () => { location.hash = "transactions"; });

/* ================= Dashboard ================= */

function renderDashboard() {
    const income = sum(transactions.filter(t => t.type === "income"));
    const expense = sum(transactions.filter(t => t.type === "expense"));
    $("totalIncome").textContent = money(income);
    $("totalExpense").textContent = money(expense);
    $("totalBalance").textContent = money(income - expense);
    $("totalBalance").className = "text-3xl font-bold mt-3 " + (income - expense < 0 ? "text-red-500" : "text-gray-800");

    const spent = sum(transactions.filter(t => t.type === "expense" && monthKey(t.date) === thisMonth));
    const s = budgetStatus(spent);
    $("dashMonth").textContent = MONTHS[+thisMonth.slice(5) - 1];
    $("dashSpent").textContent = "Spent: " + money(spent);
    $("dashBudget").textContent = money(budget);
    $("dashBar").className = "h-3 rounded-full " + s.bar;
    $("dashBar").style.width = s.width;
    $("dashRemain").className = "text-sm mt-3 " + s.text;
    $("dashRemain").textContent = s.msg;

    const recent = sorted(transactions).slice(0, 5);
    $("recentList").innerHTML = recent.length ? recent.map(t => rowHtml(t, false)).join("") : emptyRow(4, "No transactions yet. Use “Add Transaction” to start.");
}

/* ================= Transactions page ================= */

function setupFilters() {
    fillSelect($("filterCategory"), [["all", "All categories"], ...ALL_CATS.filter((c, i) => ALL_CATS.indexOf(c) === i).map(c => [c, c])], true);
    const months = [...new Set(transactions.map(t => monthKey(t.date)))].sort().reverse();
    fillSelect($("filterMonth"), [["all", "All months"], ...months.map(m => [m, monthLabel(m)])], true);
}

function renderTransactions() {
    setupFilters();
    const q = $("searchInput").value.trim().toLowerCase();
    const type = $("filterType").value, cat = $("filterCategory").value, mon = $("filterMonth").value;

    const list = sorted(transactions).filter(t =>
        (type === "all" || t.type === type) &&
        (cat === "all" || t.category === cat) &&
        (mon === "all" || monthKey(t.date) === mon) &&
        (!q || t.title.toLowerCase().includes(q) || t.category.toLowerCase().includes(q))
    );
    $("txCount").textContent = list.length + " transaction" + (list.length === 1 ? "" : "s");
    $("txList").innerHTML = list.length ? list.map(t => rowHtml(t, true)).join("") : emptyRow(5, "No transactions match your search.");
}

["searchInput", "filterType", "filterCategory", "filterMonth"].forEach(id => {
    $(id).addEventListener(id === "searchInput" ? "input" : "change", renderTransactions);
});

$("txList").addEventListener("click", e => {
    const edit = e.target.closest("[data-edit]"), del = e.target.closest("[data-del]");
    if (edit) openModal(transactions.find(t => t.id == edit.dataset.edit));
    if (del && confirm("Delete this transaction?")) {
        transactions = transactions.filter(t => t.id != del.dataset.del);
        persist();
        renderAll();
        toast("Transaction deleted");
    }
});

/* ================= Budget page ================= */

function renderBudget() {
    $("budgetInput").value = budget || "";
    const month = transactions.filter(t => t.type === "expense" && monthKey(t.date) === thisMonth);
    const spent = sum(month);
    const s = budgetStatus(spent);
    $("budMonth").textContent = monthLabel(thisMonth);
    $("budSpent").textContent = "Spent: " + money(spent);
    $("budTotal").textContent = money(budget);
    $("budBar").className = "h-3 rounded-full " + s.bar;
    $("budBar").style.width = s.width;
    $("budRemain").className = "text-sm mt-3 " + s.text;
    $("budRemain").textContent = s.msg;

    const byCat = categoryTotals(month);
    $("budCats").innerHTML = byCat.length ? byCat.map(([c, v]) => {
        const p = spent ? (v / spent) * 100 : 0;
        return `<div>
            <div class="flex justify-between text-sm mb-1"><span class="text-gray-700">${esc(c)}</span><span class="text-gray-500">${money(v)} (${p.toFixed(0)}%)</span></div>
            <div class="w-full bg-gray-100 rounded-full h-2"><div class="bg-green-500 h-2 rounded-full" style="width:${p.toFixed(1)}%"></div></div></div>`;
    }).join("") : `<p class="text-sm text-gray-400">No expenses this month yet.</p>`;
}

$("budgetForm").addEventListener("submit", e => {
    e.preventDefault();
    const v = Number($("budgetInput").value);
    if (!(v > 0)) return toast("Enter a budget greater than 0", "error");
    budget = v;
    save("budget", budget);
    save("budgetUserSet", true);
    renderAll();
    toast("Budget saved");
});

/* ================= Reports page ================= */

function categoryTotals(expenses) {
    const map = {};
    expenses.forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

function renderReports() {
    const months = [...new Set(transactions.map(t => monthKey(t.date)))].sort().reverse();
    if (!months.includes(thisMonth)) months.unshift(thisMonth);
    fillSelect($("repMonth"), [["all", "All time"], ...months.map(m => [m, monthLabel(m)])], true);
    if (!$("repMonth").dataset.init) { $("repMonth").value = thisMonth; $("repMonth").dataset.init = "1"; }

    const sel = $("repMonth").value;
    const inPeriod = transactions.filter(t => sel === "all" || monthKey(t.date) === sel);
    const income = sum(inPeriod.filter(t => t.type === "income"));
    const expenses = inPeriod.filter(t => t.type === "expense");
    const expense = sum(expenses);
    $("repIncome").textContent = money(income);
    $("repExpense").textContent = money(expense);
    $("repSaved").textContent = money(income - expense);
    $("repSaved").className = "text-2xl font-bold mt-2 " + (income - expense < 0 ? "text-red-500" : "text-gray-800");

    const cats = categoryTotals(expenses);
    $("repCats").innerHTML = cats.length ? cats.map(([c, v]) =>
        `<tr class="border-b border-gray-100"><td class="py-3 text-gray-800">${esc(c)}</td><td class="py-3 text-right">${money(v)}</td><td class="py-3 text-right text-gray-500">${((v / expense) * 100).toFixed(1)}%</td></tr>`
    ).join("") : emptyRow(3, "No expenses in this period.");

    drawCharts(cats);
}

function drawCharts(cats) {
    if (typeof Chart === "undefined") return;
    Object.values(charts).forEach(c => c.destroy());

    // last 6 months, oldest first
    const keys = [];
    const d = new Date();
    d.setDate(1);
    for (let i = 5; i >= 0; i--) {
        const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
        keys.push(`${x.getFullYear()}-${pad(x.getMonth() + 1)}`);
    }
    const byMonth = type => keys.map(k => sum(transactions.filter(t => t.type === type && monthKey(t.date) === k)));

    charts.bar = new Chart($("barChart"), {
        type: "bar",
        data: {
            labels: keys.map(k => MONTHS[+k.slice(5) - 1].slice(0, 3)),
            datasets: [
                { label: "Income", data: byMonth("income"), backgroundColor: "#16a34a", borderRadius: 6 },
                { label: "Expense", data: byMonth("expense"), backgroundColor: "#ef4444", borderRadius: 6 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });

    $("pieChart").parentElement.classList.toggle("hidden", !cats.length);
    $("pieEmpty").classList.toggle("hidden", cats.length > 0);
    if (cats.length) {
        charts.pie = new Chart($("pieChart"), {
            type: "doughnut",
            data: {
                labels: cats.map(c => c[0]),
                datasets: [{ data: cats.map(c => c[1]), backgroundColor: cats.map((_, i) => COLORS[i % COLORS.length]) }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }
        });
    }
}

$("repMonth").addEventListener("change", renderReports);

/* ================= Add / Edit modal ================= */

function openModal(t) {
    editingId = t ? t.id : null;
    $("modalTitle").textContent = t ? "Edit Transaction" : "Add Transaction";
    $("saveBtn").textContent = t ? "Update Transaction" : "Save Transaction";
    $("type").value = t ? t.type : "expense";
    updateCategoryOptions();
    $("title").value = t ? t.title : "";
    $("category").value = t ? t.category : CATS[$("type").value][0];
    $("amount").value = t ? t.amount : "";
    $("date").value = t ? t.date : localDate();
    $("transactionModal").classList.replace("hidden", "flex");
    $("title").focus();
}

function closeModal() {
    $("transactionModal").classList.replace("flex", "hidden");
    $("transactionForm").reset();
    editingId = null;
}

function updateCategoryOptions() {
    fillSelect($("category"), CATS[$("type").value].map(c => [c, c]), true);
}

$("addTransactionBtn").addEventListener("click", () => openModal(null));
$("closeModal").addEventListener("click", closeModal);
$("type").addEventListener("change", updateCategoryOptions);
$("transactionModal").addEventListener("click", e => { if (e.target === $("transactionModal")) closeModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

$("transactionForm").addEventListener("submit", e => {
    e.preventDefault();
    const title = $("title").value.trim();
    const amount = Number($("amount").value);
    const date = $("date").value;
    if (!title) return toast("Enter a transaction name", "error");
    if (!(amount > 0)) return toast("Amount must be greater than 0", "error");
    if (!date) return toast("Choose a date", "error");

    const data = { title, type: $("type").value, category: $("category").value, amount, date };
    if (editingId) {
        transactions = transactions.map(t => t.id === editingId ? { ...t, ...data } : t);
    } else {
        transactions.push({ id: Date.now(), ...data });
    }
    persist();

    const balance = sum(transactions.filter(t => t.type === "income")) - sum(transactions.filter(t => t.type === "expense"));
    const monthSpent = sum(transactions.filter(t => t.type === "expense" && monthKey(t.date) === thisMonth));
    const wasEdit = !!editingId;
    closeModal();
    renderAll();
    toast(wasEdit ? "Transaction updated" : "Transaction added");
    if (balance < 0) toast("Your balance is now negative", "warn");
    else if (budget > 0 && monthSpent > budget) toast("You are over this month's budget", "warn");
});

/* ================= Init ================= */

function renderAll() {
    renderDashboard();
    if (!$("page-transactions").classList.contains("hidden")) renderTransactions();
    if (!$("page-budget").classList.contains("hidden")) renderBudget();
    if (!$("page-reports").classList.contains("hidden")) renderReports();
}

$("currentDate").textContent = "Welcome back! " + new Date().toDateString();
persist();
updateCategoryOptions();
showPage(location.hash.slice(1));