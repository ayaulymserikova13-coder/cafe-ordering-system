const state = {
    credentials: JSON.parse(sessionStorage.getItem("credentials") || "null"),
    currentUser: JSON.parse(sessionStorage.getItem("currentUser") || "null"),
    categories: [],
    products: [],
    users: [],
    orders: [],
    payments: [],
    cart: JSON.parse(localStorage.getItem("cart") || "{}"),
    activeCategoryId: "all",
    activeAdminTab: "products",
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function authHeader() {
    if (!state.credentials) return {};
    return { Authorization: `Basic ${btoa(`${state.credentials.email}:${state.credentials.password}`)}` };
}

async function api(path, options = {}) {
    const response = await fetch(path, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.public ? {} : authHeader()),
            ...(options.headers || {}),
        },
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(extractError(text, response.status));
    }

    const type = response.headers.get("content-type") || "";
    return type.includes("application/json") ? response.json() : response.text();
}

async function loadPublicData() {
    [state.categories, state.products] = await Promise.all([
        api("/api/categories", { public: true }),
        api("/api/products", { public: true }),
    ]);
}

async function loadPrivateData() {
    if (!state.currentUser) return;

    try {
        if (state.currentUser.role === "ADMIN") {
            [state.users, state.orders, state.payments] = await Promise.all([
                api("/api/users"),
                api("/api/orders"),
                api("/api/payments"),
            ]);
        } else {
            state.users = [];
            state.payments = [];
            state.orders = await api(`/api/orders/user/${state.currentUser.id}`);
        }
    } catch (error) {
        if (error.message.includes("Authentication required") || error.message.includes("Admin role required")) {
            clearSession();
            showAlert("Session expired. Please log in again.", "error");
            render();
            return;
        }
        throw error;
    }
}

async function refreshData() {
    await loadPublicData();
    await loadPrivateData();
    render();
}

function render() {
    renderShell();
    if (!state.currentUser) return;
    renderCategories();
    renderProducts();
    renderCart();
    renderOrders();
    renderAdmin();
}

function renderShell() {
    const loggedIn = Boolean(state.currentUser);

    $("#authView").classList.toggle("hidden", loggedIn);
    $("#appView").classList.toggle("hidden", !loggedIn);
    $("#mainNav").classList.toggle("hidden", !loggedIn);
    $("#accountBox").classList.toggle("hidden", !loggedIn);

    $("#headerSubtitle").textContent = loggedIn
        ? "Manage your cafe visit"
        : "Fresh coffee, desserts and quick lunch";

    if (!loggedIn) {
        switchView("shop", false);
        return;
    }

    $("#accountName").textContent = state.currentUser.fullName;
    $("#accountRole").textContent = `${state.currentUser.email} - ${state.currentUser.role}`;
    $$(".admin-only").forEach((item) => item.classList.toggle("hidden", state.currentUser.role !== "ADMIN"));
}

function renderCategories() {
    $("#categoryTabs").innerHTML = [
        `<button class="${state.activeCategoryId === "all" ? "active" : ""}" data-category="all">All</button>`,
        ...state.categories.map((category) =>
            `<button class="${String(category.id) === String(state.activeCategoryId) ? "active" : ""}" data-category="${category.id}">${escapeHtml(category.name)}</button>`
        ),
    ].join("");

    $("#productCategory").innerHTML = state.categories
        .map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`)
        .join("");
}

function renderProducts() {
    const products = state.activeCategoryId === "all"
        ? state.products
        : state.products.filter((product) => String(product.category?.id) === String(state.activeCategoryId));

    $("#productGrid").innerHTML = products.map((product) => `
        <article class="product-card">
            <span class="badge ${product.available ? "READY" : "CANCELLED"}">${product.available ? "AVAILABLE" : "UNAVAILABLE"}</span>
            <h3>${escapeHtml(product.name)}</h3>
            <p class="muted">${escapeHtml(product.description || "Cafe product")}</p>
            <div class="price">${money.format(product.price || 0)}</div>
            <button data-add-product="${product.id}" ${product.available ? "" : "disabled"}>Add to cart</button>
        </article>
    `).join("") || `<p class="muted">No products yet.</p>`;
}

function renderCart() {
    const lines = Object.entries(state.cart);
    let total = 0;

    $("#cartItems").innerHTML = lines.map(([id, quantity]) => {
        const product = state.products.find((item) => String(item.id) === String(id));
        if (!product) return "";
        total += product.price * quantity;
        return `
            <div class="cart-line">
                <div>
                    <strong>${escapeHtml(product.name)}</strong>
                    <p class="muted">${money.format(product.price)} each</p>
                </div>
                <div class="qty">
                    <button data-cart-minus="${product.id}">-</button>
                    <span>${quantity}</span>
                    <button data-cart-plus="${product.id}">+</button>
                </div>
            </div>
        `;
    }).join("") || `<p class="muted">Your cart is empty.</p>`;

    $("#cartTotal").textContent = money.format(total);
    $("#createOrderBtn").disabled = lines.length === 0;
    localStorage.setItem("cart", JSON.stringify(state.cart));
}

function renderOrders() {
    const orders = state.currentUser.role === "ADMIN" ? [] : state.orders;
    $("#ordersList").innerHTML = orders.map((order) => {
        return `
            <article class="row-card">
                <div class="row">
                    <div>
                        <h3>Order #${order.id} - ${money.format(order.totalPrice || 0)}</h3>
                        <p class="muted">${escapeHtml(order.user?.fullName || state.currentUser.fullName)} - ${formatDate(order.createdAt)}</p>
                        <span class="badge ${order.status}">${order.status}</span>
                    </div>
                    <div class="actions">
                        <button data-pay-order="${order.id}">Pay</button>
                    </div>
                </div>
            </article>
        `;
    }).join("") || `<p class="muted">No orders yet.</p>`;
}

function renderAdmin() {
    if (state.currentUser.role !== "ADMIN") return;

    $$(".admin-tab").forEach((button) => button.classList.toggle("active", button.dataset.adminTab === state.activeAdminTab));
    $$(".admin-panel").forEach((panel) => panel.classList.remove("active"));
    $(`#admin${capitalize(state.activeAdminTab)}Panel`)?.classList.add("active");

    renderAdminProducts();
    renderAdminCategories();
    renderAdminOrders();
    renderAdminUsers();
}

function renderAdminProducts() {
    $("#productAdminList").innerHTML = state.products.map((product) => `
        <article class="row-card">
            <div class="row">
                <div>
                    <h3>${escapeHtml(product.name)} - ${money.format(product.price || 0)}</h3>
                    <p class="muted">${escapeHtml(product.description || "No description")}</p>
                    <div class="meta-grid">
                        <span class="badge ${product.available ? "READY" : "CANCELLED"}">${product.available ? "AVAILABLE" : "UNAVAILABLE"}</span>
                        <span class="badge">${escapeHtml(product.category?.name || "No category")}</span>
                    </div>
                </div>
                <div class="actions">
                    <button class="secondary" data-edit-product="${product.id}">Edit</button>
                    <button class="secondary" data-delete-product="${product.id}">Delete</button>
                </div>
            </div>
        </article>
    `).join("") || `<p class="muted">No products yet.</p>`;
}

function renderAdminCategories() {
    $("#categoryList").innerHTML = state.categories.map((category) => `
        <article class="row-card">
            <div class="row">
                <div>
                    <h3>${escapeHtml(category.name)}</h3>
                    <p class="muted">${escapeHtml(category.description || "No description")}</p>
                </div>
                <div class="actions">
                    <button class="secondary" data-edit-category="${category.id}">Edit</button>
                    <button class="secondary" data-delete-category="${category.id}">Delete</button>
                </div>
            </div>
        </article>
    `).join("") || `<p class="muted">No categories yet.</p>`;
}

function renderAdminOrders() {
    $("#adminOrdersList").innerHTML = state.orders.map((order) => {
        const payment = state.payments.find((item) => item.order?.id === order.id);
        return `
            <article class="row-card">
                <div class="row">
                    <div>
                        <h3>Order #${order.id} - ${money.format(order.totalPrice || 0)}</h3>
                        <p class="muted">${escapeHtml(order.user?.fullName || "Unknown user")} - ${formatDate(order.createdAt)}</p>
                        <div class="meta-grid">
                            <span class="badge ${order.status}">${order.status}</span>
                            ${payment ? `<span class="badge ${payment.status}">${payment.paymentMethod}: ${payment.status}</span>` : `<span class="badge PENDING">NOT PAID</span>`}
                        </div>
                    </div>
                    <div class="actions">
                        ${adminStatusButtons(order)}
                        ${payment ? "" : `<button data-pay-order="${order.id}">Pay</button>`}
                        <button class="secondary" data-delete-order="${order.id}">Delete</button>
                    </div>
                </div>
            </article>
        `;
    }).join("") || `<p class="muted">No orders yet.</p>`;
}

function renderAdminUsers() {
    $("#usersList").innerHTML = state.users.map((user) => `
        <article class="row-card">
            <div class="row">
                <div>
                    <h3>${escapeHtml(user.fullName)}</h3>
                    <p class="muted">ID ${user.id} - ${escapeHtml(user.email)} - ${escapeHtml(user.role)}</p>
                </div>
                <div class="actions">
                    <button class="secondary" data-edit-user="${user.id}">Edit</button>
                    <button class="secondary" data-delete-user="${user.id}">Delete</button>
                </div>
            </div>
        </article>
    `).join("") || `<p class="muted">No users yet.</p>`;
}

function adminStatusButtons(order) {
    return ["PREPARING", "READY", "DELIVERED", "CANCELLED"]
        .filter((status) => status !== order.status)
        .slice(0, 2)
        .map((status) => `<button class="secondary" data-order-status="${order.id}:${status}">${status}</button>`)
        .join("");
}

function switchView(view, enforceAuth = true) {
    if (enforceAuth && !state.currentUser) return;
    if (view === "admin" && state.currentUser?.role !== "ADMIN") {
        showAlert("Admin section is available only for ADMIN role.", "error");
        return;
    }

    $$(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
    $$(".view").forEach((panel) => panel.classList.remove("active"));
    const panel = $(`#${view}View`);
    if (panel) panel.classList.add("active");
}

function setAuthMode(mode) {
    $("#showLoginBtn").classList.toggle("active", mode === "login");
    $("#showRegisterBtn").classList.toggle("active", mode === "register");
    $("#loginForm").classList.toggle("active", mode === "login");
    $("#registerForm").classList.toggle("active", mode === "register");
}

function setAdminTab(tab) {
    state.activeAdminTab = tab;
    renderAdmin();
}

function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function addToCart(productId, delta = 1) {
    const next = (state.cart[productId] || 0) + delta;
    if (next <= 0) delete state.cart[productId];
    else state.cart[productId] = next;
    renderCart();
}

async function createOrder() {
    const items = Object.entries(state.cart).map(([productId, quantity]) => ({
        productId: Number(productId),
        quantity,
    }));

    if (items.length === 0) return;

    await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({ userId: state.currentUser.id, items }),
    });

    state.cart = {};
    showAlert("Order created.");
    await refreshData();
    switchView("orders");
}

function saveAuth(user, email, password) {
    state.currentUser = user;
    state.credentials = { email, password };
    sessionStorage.setItem("currentUser", JSON.stringify(user));
    sessionStorage.setItem("credentials", JSON.stringify(state.credentials));
}

function logout() {
    clearSession();
    render();
    showAlert("Logged out.");
}

function clearSession() {
    state.currentUser = null;
    state.credentials = null;
    state.users = [];
    state.orders = [];
    state.payments = [];
    state.cart = {};
    sessionStorage.clear();
    localStorage.removeItem("cart");
}

function fillCategoryForm(category) {
    $("#categoryId").value = category.id;
    $("#categoryName").value = category.name || "";
    $("#categoryDescription").value = category.description || "";
    $("#categoryFormTitle").textContent = "Edit category";
    $("#cancelCategoryEditBtn").classList.remove("hidden");
    setAdminTab("categories");
}

function resetCategoryForm() {
    $("#categoryForm").reset();
    $("#categoryId").value = "";
    $("#categoryFormTitle").textContent = "Add category";
    $("#cancelCategoryEditBtn").classList.add("hidden");
}

function fillProductForm(product) {
    $("#productId").value = product.id;
    $("#productName").value = product.name || "";
    $("#productDescription").value = product.description || "";
    $("#productPrice").value = product.price ?? "";
    $("#productCategory").value = product.category?.id || "";
    $("#productAvailable").checked = Boolean(product.available);
    $("#productFormTitle").textContent = "Edit product";
    $("#cancelProductEditBtn").classList.remove("hidden");
    setAdminTab("products");
}

function resetProductForm() {
    $("#productForm").reset();
    $("#productId").value = "";
    $("#productAvailable").checked = true;
    $("#productFormTitle").textContent = "Add product";
    $("#cancelProductEditBtn").classList.add("hidden");
}

function fillUserForm(user) {
    $("#userId").value = user.id;
    $("#userFullName").value = user.fullName || "";
    $("#userEmail").value = user.email || "";
    $("#userPhone").value = user.phone || "";
    $("#userPassword").value = "";
    $("#userPassword").placeholder = "Leave empty to keep current password";
    $("#userRole").value = user.role || "USER";
    $("#userFormTitle").textContent = "Edit user";
    $("#cancelUserEditBtn").classList.remove("hidden");
    setAdminTab("users");
}

function resetUserForm() {
    $("#userForm").reset();
    $("#userId").value = "";
    $("#userPassword").placeholder = "Required for new user";
    $("#userFormTitle").textContent = "Add user";
    $("#cancelUserEditBtn").classList.add("hidden");
}

function showAlert(message, type = "success") {
    const alert = $("#alert");
    alert.textContent = message;
    alert.className = `alert ${type === "error" ? "error" : ""}`;
    setTimeout(() => alert.classList.add("hidden"), 4200);
}

function extractError(text, status) {
    try {
        const parsed = JSON.parse(text);
        return parsed.message || parsed.error || `HTTP ${status}`;
    } catch {
        return text || `HTTP ${status}`;
    }
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatDate(value) {
    return value ? new Date(value).toLocaleString() : "No date";
}

async function handle(action) {
    try {
        await action();
    } catch (error) {
        showAlert(error.message, "error");
    }
}

document.addEventListener("click", (event) => {
    const target = event.target.closest("button, a");
    if (!target) return;

    handle(async () => {
        if (target.id === "showLoginBtn") setAuthMode("login");
        if (target.id === "showRegisterBtn") setAuthMode("register");
        if (target.id === "heroLoginBtn") setAuthMode("login");
        if (target.id === "heroRegisterBtn") setAuthMode("register");
        if (target.dataset.adminTab) setAdminTab(target.dataset.adminTab);
        if (target.dataset.view) switchView(target.dataset.view);
        if (target.dataset.category) {
            state.activeCategoryId = target.dataset.category;
            renderCategories();
            renderProducts();
        }
        if (target.dataset.addProduct) addToCart(target.dataset.addProduct);
        if (target.dataset.cartPlus) addToCart(target.dataset.cartPlus);
        if (target.dataset.cartMinus) addToCart(target.dataset.cartMinus, -1);
        if (target.id === "clearCartBtn") {
            state.cart = {};
            renderCart();
        }
        if (target.id === "createOrderBtn") await createOrder();
        if (target.id === "refreshBtn") await refreshData();
        if (target.id === "logoutBtn") logout();
        if (target.dataset.payOrder) {
            const method = prompt("Payment method", "CARD");
            if (method) {
                await api(`/api/payments/order/${target.dataset.payOrder}?method=${encodeURIComponent(method)}`, { method: "POST" });
                showAlert("Payment processed.");
                await refreshData();
            }
        }
        if (target.dataset.orderStatus) {
            const [id, status] = target.dataset.orderStatus.split(":");
            await api(`/api/orders/${id}/status?status=${status}`, { method: "PUT" });
            await refreshData();
        }
        if (target.dataset.deleteOrder) {
            await api(`/api/orders/${target.dataset.deleteOrder}`, { method: "DELETE" });
            await refreshData();
        }
        if (target.dataset.deleteCategory) {
            if (!confirm("Delete this category? Products in this category may also be affected.")) return;
            await api(`/api/categories/${target.dataset.deleteCategory}`, { method: "DELETE" });
            await refreshData();
        }
        if (target.dataset.editCategory) {
            const category = state.categories.find((item) => String(item.id) === String(target.dataset.editCategory));
            if (category) fillCategoryForm(category);
        }
        if (target.dataset.deleteProduct) {
            if (!confirm("Delete this product?")) return;
            await api(`/api/products/${target.dataset.deleteProduct}`, { method: "DELETE" });
            await refreshData();
        }
        if (target.dataset.editProduct) {
            const product = state.products.find((item) => String(item.id) === String(target.dataset.editProduct));
            if (product) fillProductForm(product);
        }
        if (target.dataset.deleteUser) {
            if (String(target.dataset.deleteUser) === String(state.currentUser.id)) {
                throw new Error("You cannot delete the account you are currently using.");
            }
            if (!confirm("Delete this user?")) return;
            await api(`/api/users/${target.dataset.deleteUser}`, { method: "DELETE" });
            await refreshData();
        }
        if (target.dataset.editUser) {
            const user = state.users.find((item) => String(item.id) === String(target.dataset.editUser));
            if (user) fillUserForm(user);
        }
        if (target.id === "cancelCategoryEditBtn") resetCategoryForm();
        if (target.id === "cancelProductEditBtn") resetProductForm();
        if (target.id === "cancelUserEditBtn") resetUserForm();
    });
});

$("#loginForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    handle(async () => {
        const email = $("#loginEmail").value.trim();
        const password = $("#loginPassword").value;
        if (!email || !password) {
            throw new Error("Email and password are required.");
        }
        const user = await api("/api/auth/login", {
            method: "POST",
            public: true,
            body: JSON.stringify({ email, password }),
        });
        saveAuth(user, email, password);
        form.reset();
        showAlert(`Logged in as ${user.role}.`);
        await refreshData();
        switchView(user.role === "ADMIN" ? "admin" : "shop");
    });
});

$("#registerForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    handle(async () => {
        const email = $("#email").value.trim();
        const password = $("#password").value;
        const fullName = $("#fullName").value.trim();
        const phone = $("#phone").value.trim();
        if (!fullName || !email || !phone || !password) {
            throw new Error("All registration fields are required.");
        }
        const user = await api("/api/auth/register", {
            method: "POST",
            public: true,
            body: JSON.stringify({
                fullName,
                email,
                phone,
                password,
            }),
        });
        form.reset();
        $("#loginEmail").value = user.email;
        $("#loginPassword").value = "";
        setAuthMode("login");
        showAlert("Account created. Please log in to continue.");
    });
});

$("#categoryForm").addEventListener("submit", (event) => {
    event.preventDefault();
    handle(async () => {
        const id = $("#categoryId").value;
        await api(id ? `/api/categories/${id}` : "/api/categories", {
            method: id ? "PUT" : "POST",
            body: JSON.stringify({
                name: $("#categoryName").value.trim(),
                description: $("#categoryDescription").value.trim(),
            }),
        });
        resetCategoryForm();
        await refreshData();
    });
});

$("#productForm").addEventListener("submit", (event) => {
    event.preventDefault();
    handle(async () => {
        const id = $("#productId").value;
        const categoryId = $("#productCategory").value;
        await api(id ? `/api/products/${id}/category/${categoryId}` : `/api/products/category/${categoryId}`, {
            method: id ? "PUT" : "POST",
            body: JSON.stringify({
                name: $("#productName").value.trim(),
                description: $("#productDescription").value.trim(),
                price: Number($("#productPrice").value),
                available: $("#productAvailable").checked,
            }),
        });
        resetProductForm();
        await refreshData();
    });
});

$("#userForm").addEventListener("submit", (event) => {
    event.preventDefault();
    handle(async () => {
        const id = $("#userId").value;
        const password = $("#userPassword").value;
        if (!id && !password) {
            throw new Error("Password is required for a new user.");
        }
        await api(id ? `/api/users/${id}` : "/api/users", {
            method: id ? "PUT" : "POST",
            body: JSON.stringify({
                fullName: $("#userFullName").value.trim(),
                email: $("#userEmail").value.trim(),
                phone: $("#userPhone").value.trim(),
                password: password || undefined,
                role: $("#userRole").value,
            }),
        });
        resetUserForm();
        await refreshData();
    });
});

loadPublicData()
    .then(() => render())
    .catch((error) => showAlert(error.message, "error"));
