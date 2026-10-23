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
let catBudgets = load("catBudgets", {});
if (!catBudgets || typeof catBudgets !== "object" || Array.isArray(catBudgets)) catBudgets = {};
const persistCatBudgets = () => save("catBudgets", catBudgets);
let showAllRecent = false;
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

// Budget alert levels: below 70% = green, 70% and above = yellow, 90% and above = red
const WARN_AT = 70, DANGER_AT = 90;
const level = p => p >= DANGER_AT ? 2 : p >= WARN_AT ? 1 : 0;
function barColor(p) { return ["bg-green-500", "bg-yellow-500", "bg-red-500"][level(p)]; }
function textColor(p) { return ["text-green-600", "text-yellow-600", "text-red-500"][level(p)]; }

const monthExpenses = () => transactions.filter(t => t.type === "expense" && monthKey(t.date) === thisMonth);

// Alerts for the monthly budget and for every category plan (70%+ yellow, 90%+ red)
function budgetAlerts() {
    const month = monthExpenses(), out = [];
    if (budget > 0) {
        const spent = sum(month), p = (spent / budget) * 100;
        if (level(p)) out.push({ lvl: level(p), text: p >= 100
            ? "Monthly budget exceeded by " + money(spent - budget) + "."
            : "Monthly budget " + Math.floor(p) + "% used. Only " + money(budget - spent) + " left." });
    }
    const totals = Object.fromEntries(categoryTotals(month));
    Object.entries(catBudgets).forEach(([c, limit]) => {
        const spent = totals[c] || 0, p = (spent / limit) * 100;
        if (level(p)) out.push({ lvl: level(p), text: p >= 100
            ? c + " plan exceeded by " + money(spent - limit) + " (" + money(spent) + " of " + money(limit) + ")."
            : c + " plan " + Math.floor(p) + "% used (" + money(spent) + " of " + money(limit) + ")." });
    });
    return out.sort((a, b) => b.lvl - a.lvl);
}

function alertsHtml() {
    return budgetAlerts().map(a =>
        `<div class="alert-box ${a.lvl === 2 ? "danger" : "warn"}" role="alert"><span>${a.lvl === 2 ? "🚨" : "⚠️"}</span><span>${esc(a.text)}</span></div>`
    ).join("");
}

// Current alert level of the monthly budget and of each category plan (used for toasts)
function levelMap() {
    const month = monthExpenses(), m = {};
    if (budget > 0) m["Monthly budget"] = level((sum(month) / budget) * 100);
    const totals = Object.fromEntries(categoryTotals(month));
    Object.entries(catBudgets).forEach(([c, limit]) => { m[c + " plan"] = level(((totals[c] || 0) / limit) * 100); });
    return m;
}

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
        <td class="py-4 font-medium text-gray-800">${esc(t.title)}${t.recurringId ? ' <span class="ml-1 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Auto</span>' : ""}</td>
        <td data-label="Category" class="py-4 text-gray-500">${esc(t.category)}</td>
        <td data-label="Date" class="py-4 text-gray-500">${esc(t.date)}</td>
        <td data-label="Amount" class="py-4 text-right font-semibold ${inc ? "text-green-600" : "text-red-500"}">${inc ? "+" : "-"} ${money(t.amount)}</td>
        ${withActions ? `<td data-label="Actions" class="py-4 text-right whitespace-nowrap">
            <button class="icon-btn edit" data-edit="${t.id}">Edit</button>
            <button class="icon-btn del" data-del="${t.id}">Delete</button></td>` : ""}
    </tr>`;
}

const sorted = list => [...list].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
const emptyRow = (cols, text) => `<tr><td colspan="${cols}" class="py-10 text-center text-gray-400 text-sm">${text}</td></tr>`;

/* ================= Navigation ================= */

const TITLES = { dashboard: "Dashboard", transactions: "Transactions", budget: "Budget", goals: "Goals", recurring: "Recurring", reports: "Reports", calculator: "Calculator" };

function showPage(page) {
    if (!TITLES[page]) page = "dashboard";
    runRecurring();
    document.querySelectorAll(".page").forEach(p => p.classList.toggle("hidden", p.id !== "page-" + page));
    document.querySelectorAll(".nav-link").forEach(a => a.classList.toggle("active", a.dataset.page === page));
    $("pageTitle").textContent = TITLES[page];
    renderAll();
}

window.addEventListener("hashchange", () => showPage(location.hash.slice(1)));
$("viewAllBtn").addEventListener("click", () => { showAllRecent = !showAllRecent; renderDashboard(); });

/* ================= Dashboard ================= */

function renderDashboard() {
    const income = sum(transactions.filter(t => t.type === "income"));
    const expense = sum(transactions.filter(t => t.type === "expense"));
    $("totalIncome").textContent = money(income);
    $("totalExpense").textContent = money(expense);
    const avail = income - expense - lockedTotal();
    $("totalBalance").textContent = money(avail);
    $("totalBalance").className = "text-3xl font-bold mt-3 " + (avail < 0 ? "text-red-500" : "text-gray-800");
    $("balNote").textContent = lockedTotal() > 0 ? "Locked in goals: " + money(lockedTotal()) : "Your available balance";

    // This month's income / expense
    const monthInc = sum(transactions.filter(t => t.type === "income" && monthKey(t.date) === thisMonth));
    const monthExp = sum(transactions.filter(t => t.type === "expense" && monthKey(t.date) === thisMonth));
    $("monthIncome").textContent = money(monthInc);
    $("monthExpense").textContent = money(monthExp);

    // Money left from the previous month (its income minus its expense)
    const pd = new Date(+thisMonth.slice(0, 4), +thisMonth.slice(5) - 2, 1);
    const prevKey = `${pd.getFullYear()}-${pad(pd.getMonth() + 1)}`;
    const prevInc = sum(transactions.filter(t => t.type === "income" && monthKey(t.date) === prevKey));
    const prevExp = sum(transactions.filter(t => t.type === "expense" && monthKey(t.date) === prevKey));
    const prevNet = prevInc - prevExp;
    $("prevLeft").textContent = money(prevNet);
    $("prevLeft").className = "text-3xl font-bold mt-3 " + (prevNet < 0 ? "text-red-500" : "text-gray-800");
    $("prevNote").textContent = monthLabel(prevKey) + ": " + money(prevInc) + " − " + money(prevExp);

    const spent = monthExp;
    const s = budgetStatus(spent);
    $("dashMonth").textContent = MONTHS[+thisMonth.slice(5) - 1];
    $("dashSpent").textContent = "Spent: " + money(spent);
    $("dashBudget").textContent = money(budget);
    $("dashBar").className = "h-3 rounded-full " + s.bar;
    $("dashBar").style.width = s.width;
    $("dashRemain").className = "text-sm mt-3 " + s.text;
    $("dashRemain").textContent = s.msg;
    $("dashAlerts").innerHTML = alertsHtml();

    // Latest 5 transactions; "View All" shows the rest in the same list
    const all = sorted(transactions);
    if (all.length <= 5) showAllRecent = false;
    const recent = showAllRecent ? all : all.slice(0, 5);
    $("recentList").innerHTML = recent.length ? recent.map(t => rowHtml(t, false)).join("") : emptyRow(4, "No transactions yet. Use “Add Transaction” to start.");
    $("viewAllBtn").classList.toggle("hidden", all.length <= 5);
    $("viewAllBtn").textContent = showAllRecent ? "Show Less" : "View All (" + all.length + ")";
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
        snapshot();
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

    $("budAlerts").innerHTML = alertsHtml();

    // Category-wise plan: how much you plan to spend vs. how much you have spent
    fillSelect($("catBudgetCat"), CATS.expense.map(c => [c, c]), true);
    const totals = Object.fromEntries(categoryTotals(month));
    const planned = Object.values(catBudgets).reduce((t, v) => t + v, 0);
    $("catPlanTotal").textContent = planned
        ? "Total planned: " + money(planned) + (budget > 0 ? " of " + money(budget) + " monthly budget" + (planned > budget ? " (plans are higher than your budget)" : "") : "")
        : "";
    const cats = CATS.expense.filter(c => catBudgets[c] || totals[c]);
    $("budCats").innerHTML = cats.length ? cats.map(c => {
        const spentC = totals[c] || 0, limit = catBudgets[c] || 0;
        if (!limit) {
            return `<div>
                <div class="flex justify-between items-center gap-2 text-sm">
                    <span class="text-gray-700 font-medium">${esc(c)}</span>
                    <span class="text-gray-500">${money(spentC)} spent · no plan set</span>
                </div>
                <div class="mt-1 text-right"><button class="icon-btn edit" data-cat-edit="${esc(c)}">Set plan</button></div></div>`;
        }
        const p = (spentC / limit) * 100, left = limit - spentC;
        const msg = left < 0 ? "Over plan by " + money(-left) : level(p) === 2 ? "Almost full. Only " + money(left) + " left" : level(p) === 1 ? "Be careful. " + money(left) + " left" : money(left) + " left";
        return `<div>
            <div class="flex justify-between items-center gap-2 text-sm mb-1">
                <span class="text-gray-700 font-medium">${esc(c)}</span>
                <span class="${textColor(p)} font-semibold">${money(spentC)} / ${money(limit)} (${Math.floor(p)}%)</span>
            </div>
            <div class="w-full bg-gray-100 rounded-full h-2.5"><div class="${barColor(p)} h-2.5 rounded-full" style="width:${Math.min(100, p).toFixed(1)}%"></div></div>
            <div class="flex justify-between items-center gap-2 mt-2">
                <span class="text-xs ${textColor(p)}">${esc(msg)}</span>
                <span class="whitespace-nowrap"><button class="icon-btn edit" data-cat-edit="${esc(c)}">Edit</button><button class="icon-btn del" data-cat-del="${esc(c)}">Remove</button></span>
            </div></div>`;
    }).join("") : `<p class="text-sm text-gray-400">No plans yet. Choose a category above and set how much you plan to spend.</p>`;
}

$("catBudgetForm").addEventListener("submit", e => {
    e.preventDefault();
    const c = $("catBudgetCat").value, v = Number($("catBudgetAmount").value);
    if (!CATS.expense.includes(c)) return;
    if (!(v > 0)) return toast("Enter a plan amount greater than 0", "error");
    snapshot();
    catBudgets[c] = v;
    persistCatBudgets();
    $("catBudgetAmount").value = "";
    renderAll();
    toast(c + " plan saved");
});

$("budCats").addEventListener("click", e => {
    const edit = e.target.closest("[data-cat-edit]"), del = e.target.closest("[data-cat-del]");
    if (edit) {
        $("catBudgetCat").value = edit.dataset.catEdit;
        $("catBudgetAmount").value = catBudgets[edit.dataset.catEdit] || "";
        $("catBudgetAmount").focus();
    } else if (del && confirm("Remove the plan for " + del.dataset.catDel + "?")) {
        snapshot();
        delete catBudgets[del.dataset.catDel];
        persistCatBudgets();
        renderAll();
        toast("Plan removed");
    }
});

$("budgetForm").addEventListener("submit", e => {
    e.preventDefault();
    const v = Number($("budgetInput").value);
    if (!(v > 0)) return toast("Enter a budget greater than 0", "error");
    snapshot();
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

    // Chart text and grid colours follow the current theme
    const dark = currentTheme() === "dark";
    Chart.defaults.color = dark ? "#9ca3af" : "#6b7280";
    Chart.defaults.borderColor = dark ? "#1f2937" : "#e5e7eb";

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
                datasets: [{ data: cats.map(c => c[1]), backgroundColor: cats.map((_, i) => COLORS[i % COLORS.length]), borderColor: dark ? "#111827" : "#ffffff" }]
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
    const levelsBefore = levelMap();
    snapshot();
    if (editingId) {
        transactions = transactions.map(t => t.id === editingId ? { ...t, ...data } : t);
    } else {
        transactions.push({ id: Date.now(), ...data });
    }
    persist();

    const balance = sum(transactions.filter(t => t.type === "income")) - sum(transactions.filter(t => t.type === "expense"));
    const wasEdit = !!editingId;
    closeModal();
    renderAll();
    toast(wasEdit ? "Transaction updated" : "Transaction added");
    if (balance < 0) toast("Your balance is now negative", "warn");
    const levelsAfter = levelMap();
    Object.keys(levelsAfter).forEach(k => {
        if (levelsAfter[k] > (levelsBefore[k] || 0)) {
            toast(k + (levelsAfter[k] === 2 ? ": 90% used. Red alert!" : ": 70% used. Be careful!"), levelsAfter[k] === 2 ? "error" : "warn");
        }
    });
});

/* ================= Goals ================= */

let goals = load("goals", []);
if (!Array.isArray(goals)) goals = [];
const persistGoals = () => save("goals", goals);
const lockedTotal = () => goals.reduce((t, g) => t + g.saved, 0);
const balanceNow = () => sum(transactions.filter(t => t.type === "income")) - sum(transactions.filter(t => t.type === "expense"));
const availableNow = () => balanceNow() - lockedTotal();

// How many monthly installments have come due since the goal started (same day each month)
function dueCount(start) {
    const s = new Date(start + "T00:00:00"), n = new Date();
    let m = (n.getFullYear() - s.getFullYear()) * 12 + n.getMonth() - s.getMonth();
    if (n.getDate() < s.getDate()) m--;
    return m + 1;
}

function runAutoSave() {
    let changed = false;
    goals.forEach(g => {
        if (!g.auto) return;
        const due = Math.min(g.months, dueCount(g.start));
        while (g.paid < due && g.saved < g.target) {
            const amt = Math.min(g.monthly, g.target - g.saved);
            if (amt > availableNow()) { toast(`Not enough available balance to auto-save for "${g.name}"`, "warn"); break; }
            g.saved += amt; g.paid++; changed = true;
            g.history.push({ date: localDate(), amount: amt, auto: true });
        }
        if (g.saved >= g.target) { g.auto = false; changed = true; toast(`Goal "${g.name}" completed!`); }
    });
    if (changed) persistGoals();
}

function renderGoals() {
    $("goalAvail").textContent = "Available: " + money(availableNow()) + " · Locked in goals: " + money(lockedTotal());
    $("goalList").innerHTML = goals.length ? goals.map(g => {
        const p = Math.min(100, (g.saved / g.target) * 100), done = g.saved >= g.target;
        const status = done ? "Completed" : g.auto ? "Auto-Save ON" : "Paused";
        return `<div class="bg-white p-6 rounded-2xl border border-gray-100">
            <div class="flex justify-between items-start gap-3 mb-4">
                <div><h3 class="font-bold text-gray-800 text-lg">${esc(g.name)}</h3>
                <p class="text-sm text-gray-500 mt-1">${status} · ${money(g.monthly)} / month · ${g.paid}/${g.months} months</p></div>
                <label class="flex items-center gap-2 text-xs text-gray-500 whitespace-nowrap">Auto-Save <span class="switch"><input type="checkbox" data-act="toggle" data-id="${g.id}" aria-label="Auto-Save" ${g.auto ? "checked" : ""} ${done ? "disabled" : ""}><span class="slider"></span></span></label>
            </div>
            <div class="flex justify-between text-sm mb-2"><span class="text-gray-500">Saved: ${money(g.saved)}</span><span class="font-semibold text-gray-800">${money(g.target)}</span></div>
            <div class="w-full bg-gray-100 rounded-full h-3"><div class="${done ? "bg-green-600" : "bg-green-500"} h-3 rounded-full" style="width:${p.toFixed(1)}%"></div></div>
            <p class="text-sm mt-3 ${done ? "text-green-600" : "text-gray-500"}">${p.toFixed(0)}% complete · ${money(Math.max(0, g.target - g.saved))} to go</p>
            <div class="mt-4 flex flex-wrap gap-2">
                <button class="icon-btn edit" data-act="add" data-id="${g.id}" ${done ? "disabled" : ""}>Add Savings</button>
                <button class="icon-btn edit" data-act="withdraw" data-id="${g.id}">Withdraw</button>
                <button class="icon-btn del" data-act="delete" data-id="${g.id}">Delete</button>
            </div></div>`;
    }).join("") : `<p class="text-sm text-gray-400">No goals yet. Create your first goal above.</p>`;
}

$("goalForm").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("goalName").value.trim(), target = Number($("goalTarget").value), months = Math.floor(Number($("goalMonths").value));
    if (!name) return toast("Enter a goal name", "error");
    if (!(target > 0)) return toast("Target must be greater than 0", "error");
    if (!(months >= 1 && months <= 60)) return toast("Months must be between 1 and 60", "error");
    snapshot();
    goals.push({ id: Date.now(), name, target, months, monthly: Math.ceil(target / months), saved: 0, paid: 0, auto: true, start: localDate(), history: [] });
    persistGoals();
    runAutoSave();
    $("goalForm").reset();
    renderAll();
    toast("Goal created");
});

$("goalList").addEventListener("click", e => {
    const b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    const g = goals.find(x => x.id == b.dataset.id);
    if (!g) return;
    const act = b.dataset.act;
    if (act === "toggle") {
        snapshot();
        g.auto = !g.auto;
        if (g.auto) g.paid = Math.min(g.months, dueCount(g.start)); // resume from the next installment
        toast(g.auto ? "Auto-Save turned ON" : "Auto-Save turned OFF");
    } else if (act === "add" || act === "withdraw") {
        const amt = Number(prompt(act === "add" ? "Amount to save (BDT):" : "Amount to withdraw (BDT):"));
        if (!amt) return;
        if (!(amt > 0)) return toast("Enter a valid amount", "error");
        if (act === "add") {
            if (amt > availableNow()) return toast("Not enough available balance", "error");
            if (amt > g.target - g.saved) return toast("That is more than the remaining target", "error");
            snapshot();
            g.saved += amt; g.history.push({ date: localDate(), amount: amt, auto: false });
        } else {
            if (amt > g.saved) return toast("You have not saved that much", "error");
            snapshot();
            g.saved -= amt; g.history.push({ date: localDate(), amount: -amt, auto: false });
        }
    } else if (act === "delete") {
        if (!confirm("Delete this goal? Saved money returns to your available balance.")) return;
        snapshot();
        goals = goals.filter(x => x !== g);
    }
    persistGoals();
    renderAll();
});

/* ================= Recurring transactions ================= */

let recurring = load("recurring", []);
if (!Array.isArray(recurring)) recurring = [];
const persistRecurring = () => save("recurring", recurring);
let idSeq = 0;

function nextKey(k) {
    const [y, m] = k.split("-").map(Number);
    const d = new Date(y, m, 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
function prevKey(k) {
    const [y, m] = k.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
const dueDate = (key, day) => {
    const [y, m] = key.split("-").map(Number);
    return `${key}-${pad(Math.min(day, new Date(y, m, 0).getDate()))}`;
};

// Adds every due monthly transaction that has not been added yet
function runRecurring() {
    const today = localDate(), nowKey = monthKey(today);
    let added = 0;
    recurring.forEach(r => {
        if (!r.active) return;
        let key = r.lastKey ? nextKey(r.lastKey) : r.start;
        while (key <= nowKey) {
            const date = dueDate(key, r.day);
            if (date > today) break;
            transactions.push({ id: Date.now() + (idSeq++), title: r.title, type: r.type, category: r.category, amount: r.amount, date, recurringId: r.id });
            r.lastKey = key;
            added++;
            key = nextKey(key);
        }
    });
    if (added) {
        persist(); persistRecurring();
        toast(added + " recurring transaction" + (added === 1 ? "" : "s") + " added automatically");
    }
}

function renderRecurring() {
    fillSelect($("recCategory"), CATS[$("recType").value].map(c => [c, c]), true);
    const out = sum(recurring.filter(r => r.active && r.type === "expense"));
    const inc = sum(recurring.filter(r => r.active && r.type === "income"));
    $("recSummary").textContent = "Auto expense per month: " + money(out) + " · Auto income per month: " + money(inc);
    $("recList").innerHTML = recurring.length ? recurring.map(r => {
        const inc = r.type === "income";
        return `<div class="bg-white p-6 rounded-2xl border border-gray-100">
            <div class="flex justify-between items-start gap-3">
                <div><h3 class="font-bold text-gray-800 text-lg">${esc(r.title)}</h3>
                <p class="text-sm text-gray-500 mt-1">${inc ? "Income" : "Expense"} · ${esc(r.category)} · every month on day ${r.day}</p></div>
                <label class="flex items-center gap-2 text-xs text-gray-500 whitespace-nowrap">${r.active ? "Active" : "Paused"} <span class="switch"><input type="checkbox" data-ract="toggle" data-id="${r.id}" aria-label="Active" ${r.active ? "checked" : ""}><span class="slider"></span></span></label>
            </div>
            <p class="text-2xl font-bold mt-4 ${inc ? "text-green-600" : "text-red-500"}">${inc ? "+" : "-"} ${money(r.amount)}</p>
            <div class="mt-4"><button class="icon-btn del" data-ract="delete" data-id="${r.id}">Delete</button></div></div>`;
    }).join("") : `<p class="text-sm text-gray-400">No recurring transactions yet. Add rent, WiFi bill or salary above.</p>`;
}

$("recType").addEventListener("change", renderRecurring);

$("recForm").addEventListener("submit", e => {
    e.preventDefault();
    const title = $("recName").value.trim(), amount = Number($("recAmount").value), day = Math.floor(Number($("recDay").value));
    if (!title) return toast("Enter a name", "error");
    if (!(amount > 0)) return toast("Amount must be greater than 0", "error");
    if (!(day >= 1 && day <= 31)) return toast("Day must be between 1 and 31", "error");
    snapshot();
    recurring.push({ id: Date.now(), title, type: $("recType").value, category: $("recCategory").value, amount, day, active: true, start: monthKey(localDate()), lastKey: null });
    persistRecurring();
    runRecurring();
    $("recForm").reset();
    $("recDay").value = 1;
    renderAll();
    toast("Recurring transaction added");
});

$("recList").addEventListener("click", e => {
    const b = e.target.closest("[data-ract]");
    if (!b) return;
    const r = recurring.find(x => x.id == b.dataset.id);
    if (!r) return;
    if (b.dataset.ract === "toggle") {
        snapshot();
        r.active = !r.active;
        if (r.active) { // resume from the next due month, no back-filling of paused months
            const nowKey = monthKey(localDate());
            r.lastKey = dueDate(nowKey, r.day) <= localDate() ? nowKey : prevKey(nowKey);
        }
        toast(r.active ? "Recurring turned ON" : "Recurring paused");
        if (r.active) runRecurring();
    } else if (b.dataset.ract === "delete") {
        if (!confirm("Delete this recurring item? Transactions already added will stay.")) return renderAll();
        snapshot();
        recurring = recurring.filter(x => x !== r);
    }
    persistRecurring();
    renderAll();
});

/* ================= Calculator ================= */

const SYM = { "+": "+", "-": "−", "*": "×", "/": "÷" };
const calc = { cur: "0", prev: null, op: null, opJust: false, replace: false, expr: "" };

function calcFmt(n) {
    if (!isFinite(n)) return "Error";
    n = Math.round(n * 1e10) / 1e10;
    const s = String(n);
    return s.includes("e") ? n.toExponential(6) : s;
}
function calcShow(s) {
    if (s === "Error" || s.includes("e")) return s;
    const [i, d] = s.split(".");
    const neg = i.startsWith("-");
    const int = (neg ? i.slice(1) : i).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (neg ? "-" : "") + int + (d !== undefined ? "." + d : "");
}
function calcCompute(a, op, b) {
    if (op === "+") return a + b;
    if (op === "-") return a - b;
    if (op === "*") return a * b;
    return b === 0 ? NaN : a / b;
}
function calcRender() {
    const shown = calcShow(calc.cur);
    $("calcScreen").textContent = shown;
    $("calcScreen").style.fontSize = shown.length > 16 ? "20px" : shown.length > 11 ? "26px" : "";
    $("calcExpr").textContent = calc.expr;
    document.querySelectorAll("#calcPad .calc-btn.op").forEach(b =>
        b.classList.toggle("pending", calc.opJust && b.dataset.v === calc.op));
}
function calcReset() { Object.assign(calc, { cur: "0", prev: null, op: null, opJust: false, replace: false, expr: "" }); }

function calcAction(act, v) {
    if (calc.cur === "Error" && act !== "clear") calcReset();
    if (act === "clear") calcReset();
    else if (act === "num") {
        if (calc.replace) { calc.cur = v; calc.replace = false; if (!calc.op) calc.expr = ""; }
        else if (calc.cur.replace(/[-.]/g, "").length < 15) calc.cur = calc.cur === "0" ? v : calc.cur === "-0" ? "-" + v : calc.cur + v;
        calc.opJust = false;
    } else if (act === "dot") {
        if (calc.replace) { calc.cur = "0."; calc.replace = false; if (!calc.op) calc.expr = ""; }
        else if (!calc.cur.includes(".")) calc.cur += ".";
        calc.opJust = false;
    } else if (act === "back") {
        if (!calc.replace) calc.cur = calc.cur.length > 1 && calc.cur !== "-0" ? calc.cur.slice(0, -1) : "0";
        if (calc.cur === "-") calc.cur = "0";
    } else if (act === "sign") {
        if (calc.cur !== "0") calc.cur = calc.cur.startsWith("-") ? calc.cur.slice(1) : "-" + calc.cur;
    } else if (act === "percent") {
        const n = Number(calc.cur);
        // 200 + 10%  ->  10% of 200 = 20;   otherwise simply n / 100
        calc.cur = calcFmt(calc.prev !== null && (calc.op === "+" || calc.op === "-") ? calc.prev * n / 100 : n / 100);
        calc.replace = true; calc.opJust = false;
    } else if (act === "op") {
        if (calc.op && calc.opJust) calc.op = v; // just change the operator
        else {
            if (calc.op) calc.cur = calcFmt(calcCompute(calc.prev, calc.op, Number(calc.cur)));
            calc.prev = Number(calc.cur);
            calc.op = v;
        }
        if (calc.cur === "Error") { calcReset(); calc.cur = "Error"; }
        else { calc.opJust = true; calc.replace = true; calc.expr = calcFmt(calc.prev) + " " + SYM[v]; }
    } else if (act === "eq") {
        if (!calc.op) return;
        const b = Number(calc.cur);
        const res = calcFmt(calcCompute(calc.prev, calc.op, b));
        calc.expr = calcFmt(calc.prev) + " " + SYM[calc.op] + " " + calcFmt(b) + " =";
        calc.cur = res; calc.prev = null; calc.op = null; calc.opJust = false; calc.replace = true;
    }
    calcRender();
}

$("calcPad").addEventListener("click", e => {
    const b = e.target.closest("[data-calc]");
    if (b) calcAction(b.dataset.calc, b.dataset.v);
});

document.addEventListener("keydown", e => {
    if ($("page-calculator").classList.contains("hidden") || !$("transactionModal").classList.contains("hidden")) return;
    if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    const k = e.key;
    if (/^[0-9]$/.test(k)) calcAction("num", k);
    else if ("+-*/".includes(k) && k.length === 1) calcAction("op", k);
    else if (k === "." || k === ",") calcAction("dot");
    else if (k === "%") calcAction("percent");
    else if (k === "Enter" || k === "=") { e.preventDefault(); calcAction("eq"); }
    else if (k === "Backspace") calcAction("back");
    else if (k === "c" || k === "C" || k === "Delete") calcAction("clear");
    else return;
    if (k === "/") e.preventDefault();
});

/* ================= Undo & Reset ================= */

const undoStack = [];
function updateUndoBtn() { $("undoBtn").disabled = !undoStack.length; }
function snapshot() {
    undoStack.push(JSON.stringify({ transactions, goals, budget, recurring, catBudgets }));
    if (undoStack.length > 20) undoStack.shift();
    updateUndoBtn();
}

$("undoBtn").addEventListener("click", () => {
    if (!undoStack.length) return;
    const s = JSON.parse(undoStack.pop());
    transactions = s.transactions; goals = s.goals; budget = s.budget; recurring = s.recurring || []; catBudgets = s.catBudgets || {};
    persist(); persistGoals(); persistRecurring(); persistCatBudgets(); save("budget", budget);
    updateUndoBtn();
    renderAll();
    toast("Last action undone");
});

$("resetBtn").addEventListener("click", () => {
    if (!confirm("Reset everything? All transactions, goals, budgets and category plans will be deleted. You can still press Undo right after.")) return;
    snapshot();
    transactions = []; goals = []; budget = 0; recurring = []; catBudgets = {};
    persist(); persistGoals(); persistRecurring(); persistCatBudgets(); save("budget", 0);
    renderAll();
    toast("All data reset");
});

/* ================= Theme (Light / Dark) ================= */

function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function applyTheme(theme) {
    theme = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    document.querySelectorAll(".theme-opt").forEach(b => {
        const on = b.dataset.themeValue === theme;
        b.classList.toggle("active", on);
        b.setAttribute("aria-checked", on);
    });
    $("themeBtn").textContent = (theme === "dark" ? "🌙" : "☀️") + " Theme";
}

function setMenuOpen(open) {
    $("themeMenu").classList.toggle("hidden", !open);
    $("themeBtn").setAttribute("aria-expanded", open);
}

$("themeBtn").addEventListener("click", e => {
    e.stopPropagation();
    setMenuOpen($("themeMenu").classList.contains("hidden"));
});

$("themeMenu").addEventListener("click", e => {
    const b = e.target.closest("[data-theme-value]");
    if (!b) return;
    const theme = b.dataset.themeValue;
    applyTheme(theme);
    save("theme", theme);
    setMenuOpen(false);
    renderAll(); // redraw charts with the new colours
    toast(theme === "dark" ? "Dark theme on" : "Light theme on");
});

document.addEventListener("click", e => { if (!$("themeWrap").contains(e.target)) setMenuOpen(false); });
document.addEventListener("keydown", e => { if (e.key === "Escape") setMenuOpen(false); });

/* ================= Init ================= */

function renderAll() {
    renderDashboard();
    if (!$("page-transactions").classList.contains("hidden")) renderTransactions();
    if (!$("page-budget").classList.contains("hidden")) renderBudget();
    if (!$("page-goals").classList.contains("hidden")) renderGoals();
    if (!$("page-recurring").classList.contains("hidden")) renderRecurring();
    if (!$("page-reports").classList.contains("hidden")) renderReports();
}

// Tables that become stacked cards on small screens
["recentList", "txList"].forEach(id => $(id).closest("table").classList.add("rtable"));

applyTheme(load("theme", "light"));
$("currentDate").textContent = "Welcome back! " + new Date().toDateString();
persist();
updateCategoryOptions();
runRecurring();
runAutoSave();
showPage(location.hash.slice(1));