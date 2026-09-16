const storageKey = "geradorOSState";
const supabaseConfig = window.SUPABASE_CONFIG || {};
let supabaseClient = null;
let currentUser = null;
let currentProfile = null;

const initialState = {
  sessionEmail: "",
  users: [],
  profile: null,
  company: {
    name: "WBM AUTO VIDROS",
    tagline: "Seu parceiro em vidros automotivos e agrícolas",
    phone: "(00) 97402-0556",
    site: "https://autovidros.app/",
    document: "",
    email: "",
    address: "",
    logo: ""
  },
  clients: [
    {
      id: crypto.randomUUID(),
      name: "Marquespan indústria de alimentos ltda",
      document: "",
      phone: "",
      email: "",
      address: ""
    }
  ],
  items: [],
  orders: [],
  finance: []
};

let state = loadState();
let draftOrderId = null;
let authMode = "login";
let clientBeingEditedId = null;
let companyLogoImage = null;
let companyLogoSource = "";
let orderItems = [];

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const planOptions = {
  free: { label: "Free", price: "R$ 0,00", limit: 30 },
  pro: { label: "Pro", price: "R$ 50,00", limit: 80 },
  standard: { label: "Standard", price: "R$ 80,00", limit: 120 },
  full: { label: "Full", price: "R$ 200,00", limit: null }
};

const els = {
  loginView: document.querySelector("#loginView"),
  appView: document.querySelector("#appView"),
  loginForm: document.querySelector("#loginForm"),
  loginBrand: document.querySelector("#loginBrand"),
  loginCompanyLogo: document.querySelector("#loginCompanyLogo"),
  loginCompanyName: document.querySelector("#loginCompanyName"),
  loginUsername: document.querySelector("#loginUsername"),
    loginName: document.querySelector("#loginName"),
    loginNameField: document.querySelector("#loginNameField"),
    loginPassword: document.querySelector("#loginPassword"),
    loginPasswordField: document.querySelector("#loginPasswordField"),
    loginPasswordConfirm: document.querySelector("#loginPasswordConfirm"),
    loginPasswordConfirmField: document.querySelector("#loginPasswordConfirmField"),
    loginSubmitButton: document.querySelector("#loginSubmitButton"),
    authDescription: document.querySelector("#authDescription"),
    togglePasswordButton: document.querySelector("#togglePasswordButton"),
    loginStatus: document.querySelector("#loginStatus"),
  logoutButton: document.querySelector("#logoutButton"),
  menuToggle: document.querySelector("#menuToggle"),
  sidebar: document.querySelector(".sidebar"),
  pageTitle: document.querySelector("#pageTitle"),
  userEmailMenu: document.querySelector("#userEmailMenu"),
  companyNameMenu: document.querySelector("#companyNameMenu"),
  companyLogoMenu: document.querySelector("#companyLogoMenu"),
  companyLogoMenuImage: document.querySelector("#companyLogoMenuImage"),
  adminNavItem: document.querySelector("#adminNavItem"),
  refreshAdminButton: document.querySelector("#refreshAdminButton"),
  adminUsersMetric: document.querySelector("#adminUsersMetric"),
  adminCompaniesMetric: document.querySelector("#adminCompaniesMetric"),
  adminOrdersMetric: document.querySelector("#adminOrdersMetric"),
  adminCompaniesTable: document.querySelector("#adminCompaniesTable"),
  adminStatus: document.querySelector("#adminStatus"),
  orderForm: document.querySelector("#orderForm"),
  osPreview: document.querySelector("#osPreview"),
  orderClient: document.querySelector("#orderClient"),
  addClientFromOrderButton: document.querySelector("#addClientFromOrderButton"),
  orderItemInput: document.querySelector("#orderItemInput"),
  companyItemsList: document.querySelector("#companyItemsList"),
  addOrderItemButton: document.querySelector("#addOrderItemButton"),
  orderItemsList: document.querySelector("#orderItemsList"),
  quickClientModal: document.querySelector("#quickClientModal"),
  quickClientForm: document.querySelector("#quickClientForm"),
  closeQuickClientButton: document.querySelector("#closeQuickClientButton"),
  cancelQuickClientButton: document.querySelector("#cancelQuickClientButton"),
  financeClient: document.querySelector("#financeClient"),
  clientForm: document.querySelector("#clientForm"),
  itemForm: document.querySelector("#itemForm"),
  itemCode: document.querySelector("#itemCode"),
  itemEan: document.querySelector("#itemEan"),
  itemNcmSh: document.querySelector("#itemNcmSh"),
  itemName: document.querySelector("#itemName"),
  itemDescription: document.querySelector("#itemDescription"),
  itemsList: document.querySelector("#itemsList"),
  clientSubmitButton: document.querySelector("#clientSubmitButton"),
  cancelClientEditButton: document.querySelector("#cancelClientEditButton"),
  searchCnpjButton: document.querySelector("#searchCnpjButton"),
  cnpjSearchStatus: document.querySelector("#cnpjSearchStatus"),
  settingsForm: document.querySelector("#settingsForm"),
  companyLogoCanvas: document.querySelector("#companyLogoCanvas"),
  companyLogoInput: document.querySelector("#companyLogoInput"),
  companyLogoZoom: document.querySelector("#companyLogoZoom"),
  companyLogoX: document.querySelector("#companyLogoX"),
  companyLogoY: document.querySelector("#companyLogoY"),
  centerCompanyLogoButton: document.querySelector("#centerCompanyLogoButton"),
  companyLogoStatus: document.querySelector("#companyLogoStatus"),
  financeForm: document.querySelector("#financeForm"),
  reportSearch: document.querySelector("#reportSearch")
};

const pageNames = {
  dashboard: "Painel",
  orders: "Gerar OS",
  reports: "Relatório de OS",
  finance: "Financeiro",
  clients: "Clientes",
  items: "Itens",
  settings: "Configuração",
  admin: "Administração"
};

document.addEventListener("DOMContentLoaded", async () => {
  wireEvents();
  hydrateSettingsForm();
  setTodayDefaults();
  renderAll();
  await restoreSupabaseSession();
});

function loadState() {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return structuredClone(initialState);

  try {
    return { ...structuredClone(initialState), ...JSON.parse(raw) };
  } catch {
    return structuredClone(initialState);
  }
}

function saveState() {
  saveLocalState();
  syncStateToSupabase();
}

function saveLocalState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function wireEvents() {
  els.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitAuthForm();
  });

    document.querySelectorAll("[data-auth-mode]").forEach((button) => {
      button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
    });

    els.togglePasswordButton.addEventListener("click", togglePasswordVisibility);

  els.logoutButton.addEventListener("click", async () => {
    const client = getSupabaseClient();
    if (client) await client.auth.signOut();
    currentUser = null;
    currentProfile = null;
    state.sessionEmail = "";
    saveLocalState();
    els.loginView.classList.remove("hidden");
    els.appView.classList.add("hidden");
  });

  els.menuToggle.addEventListener("click", () => {
    els.sidebar.classList.toggle("open");
  });

  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => showPage(button.dataset.page));
  });

  document.querySelectorAll("[data-shortcut]").forEach((button) => {
    button.addEventListener("click", () => showPage(button.dataset.shortcut));
  });

  els.orderForm.addEventListener("input", renderOrderPreview);
  els.orderForm.addEventListener("change", renderOrderPreview);
  els.orderForm.addEventListener("submit", saveOrder);
  els.addClientFromOrderButton.addEventListener("click", openQuickClientModal);
  els.addOrderItemButton.addEventListener("click", addOrderItem);
  els.orderItemInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addOrderItem();
    }
  });
  els.quickClientForm.addEventListener("submit", saveClientFromOrder);
  els.closeQuickClientButton.addEventListener("click", closeQuickClientModal);
  els.cancelQuickClientButton.addEventListener("click", closeQuickClientModal);
  els.quickClientModal.addEventListener("click", (event) => {
    if (event.target === els.quickClientModal) closeQuickClientModal();
  });

  document.querySelector("#printOrderButton").addEventListener("click", () => {
    renderOrderPreview();
    window.print();
  });

  els.clientForm.addEventListener("submit", saveClient);
  els.itemForm.addEventListener("submit", saveItem);
  els.cancelClientEditButton.addEventListener("click", resetClientForm);
  els.searchCnpjButton.addEventListener("click", searchCnpj);
  els.settingsForm.addEventListener("submit", saveSettings);
  els.companyLogoInput.addEventListener("change", loadCompanyLogo);
  [els.companyLogoZoom, els.companyLogoX, els.companyLogoY].forEach((control) => {
    control.addEventListener("input", drawCompanyLogo);
  });
  els.centerCompanyLogoButton.addEventListener("click", centerCompanyLogo);
  els.financeForm.addEventListener("submit", saveFinance);
  els.reportSearch.addEventListener("input", renderOrdersTable);
  els.refreshAdminButton.addEventListener("click", loadAdminOverview);

  const client = getSupabaseClient();
  if (client) {
    client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        setTimeout(() => openAuthenticatedApp(session.user), 0);
      }
    });
  }
}

function getSupabaseClient() {
  if (!isSupabaseReady()) return null;
  if (!supabaseClient) {
    supabaseClient = window.supabase.createClient(supabaseConfig.url, getSupabasePublicKey(), {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    });
  }
  return supabaseClient;
}

function isSupabaseReady() {
  const key = getSupabasePublicKey();
  return Boolean(
    window.supabase &&
    supabaseConfig.url &&
    key &&
    isBrowserSafeSupabaseKey(key) &&
    supabaseConfig.tableName
  );
}

function getSupabasePublicKey() {
  return supabaseConfig.publishableKey || supabaseConfig.anonKey || "";
}

function isBrowserSafeSupabaseKey(key) {
  const value = String(key || "").trim();
  if (!value || value.includes("COLE_AQUI")) return false;
  return !value.startsWith("sb_secret_");
}

function getSupabaseConfigError() {
  const key = getSupabasePublicKey();
  if (!window.supabase) return "Biblioteca do Supabase não carregou. Verifique sua conexão.";
  if (!supabaseConfig.url) return "Configure a URL do projeto em supabase-config.js.";
  if (!key || key.includes("COLE_AQUI")) return "Cole a chave pública do Supabase em supabase-config.js.";
  if (String(key).startsWith("sb_secret_")) {
    return "Você colocou uma secret key. Use a publishable key (sb_publishable_...) ou a anon key legada no navegador.";
  }
  if (!supabaseConfig.tableName) return "Configure o nome da tabela em supabase-config.js.";
  return "Configuração do Supabase inválida.";
}

async function restoreSupabaseSession() {
  const client = getSupabaseClient();
  if (!client) {
    setLoginStatus(getSupabaseConfigError(), "error");
    return false;
  }

  const { data, error } = await client.auth.getSession();
  if (error) {
    setLoginStatus("Não foi possível validar a sessão do Supabase.", "error");
    return false;
  }

  if (data.session?.user) {
    await openAuthenticatedApp(data.session.user);
    return true;
  }

  return false;
}

async function submitAuthForm() {
  const username = els.loginUsername.value.trim();
  if (!username) return;

  if (authMode === "signup") {
    if (els.loginPassword.value !== els.loginPasswordConfirm.value) {
      setLoginStatus("As senhas não conferem.", "error");
      return;
    }
    await requestSupabaseSignup(username, els.loginPassword.value, els.loginName.value.trim());
    return;
  }

  await requestSupabasePasswordLogin(username, els.loginPassword.value);
}

function getInternalAuthEmail(username) {
  const normalized = username
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "");
  return `${normalized}@gerador-os.local`;
}

async function requestSupabasePasswordLogin(username, password) {
  const client = getSupabaseClient();
  if (!client) {
    setLoginStatus(getSupabaseConfigError(), "error");
    return false;
  }

  setLoginStatus("Validando acesso...", "");
  const { error } = await client.auth.signInWithPassword({
    email: getInternalAuthEmail(username),
    password
  });
  if (error) {
    setLoginStatus(getSupabaseAuthErrorMessage(error), "error");
    return false;
  }
  return true;
}

async function requestSupabaseSignup(username, password, fullName) {
  const client = getSupabaseClient();
  if (!client) {
    setLoginStatus(getSupabaseConfigError(), "error");
    return false;
  }

  setLoginStatus("Criando sua conta...", "");
  const { data, error } = await client.auth.signUp({
    email: getInternalAuthEmail(username),
    password,
    options: {
      data: { full_name: fullName, username: username.trim() }
    }
  });

  if (error) {
    setLoginStatus(getSupabaseAuthErrorMessage(error), "error");
    return false;
  }

  if (data.session?.user) {
    await openAuthenticatedApp(data.session.user);
  } else {
    setLoginStatus("Cadastro criado, mas o Supabase exige confirmação de e-mail. Desative essa exigência no painel Auth.", "error");
  }
  return true;
}

function getAuthRedirectUrl() {
  return supabaseConfig.siteUrl || `${window.location.origin}${window.location.pathname}`;
}

function getSupabaseLoginErrorMessage(error) {
  const errorText = `${error?.message || ""} ${error?.code || ""}`.toLowerCase();
  const isRateLimited = error?.status === 429 || errorText.includes("rate limit") || errorText.includes("too many requests");

  if (isRateLimited) {
    return "O Supabase atingiu o limite temporário de envio de e-mails. Aguarde alguns minutos antes de tentar novamente ou configure um provedor SMTP próprio no painel do Supabase.";
  }

  return error?.message || "Não foi possível enviar o link de acesso.";
}

function getSupabaseAuthErrorMessage(error) {
  const errorText = `${error?.message || ""} ${error?.code || ""}`.toLowerCase();
  if (errorText.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (errorText.includes("user already registered")) return "Este e-mail já está cadastrado. Entre ou recupere sua senha.";
  if (errorText.includes("password should be at least")) return "A senha precisa ter pelo menos 6 caracteres.";
  return getSupabaseLoginErrorMessage(error);
}

function setAuthMode(mode) {
  authMode = mode;
  const isSignup = mode === "signup";
  const isLogin = mode === "login";

  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    const active = button.dataset.authMode === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });

  els.authDescription.textContent = isSignup
    ? "Crie seu acesso em poucos segundos e comece a organizar suas ordens de serviço."
    : "Entre com seu usuário e senha para abrir seu perfil de trabalho.";
  els.loginNameField.classList.toggle("hidden", !isSignup);
  els.loginName.classList.toggle("hidden", !isSignup);
  els.loginName.required = isSignup;
  els.loginPassword.classList.remove("hidden");
  els.loginPasswordField.classList.remove("hidden");
  els.togglePasswordButton.classList.remove("hidden");
  els.loginPassword.required = true;
  els.loginPasswordConfirmField.classList.toggle("hidden", !isSignup);
  els.loginPasswordConfirm.classList.toggle("hidden", !isSignup);
  els.loginPasswordConfirm.required = isSignup;
  els.loginPassword.autocomplete = isLogin ? "current-password" : "new-password";
  els.loginSubmitButton.textContent = isSignup ? "Criar minha conta" : "Entrar";
  setLoginStatus(isSignup ? "Use uma senha com pelo menos 6 caracteres." : "Use seu usuário e senha cadastrados.", "");
}

function togglePasswordVisibility() {
  const isPassword = els.loginPassword.type === "password";
  els.loginPassword.type = isPassword ? "text" : "password";
  els.togglePasswordButton.textContent = isPassword ? "Ocultar" : "Mostrar";
  els.togglePasswordButton.setAttribute("aria-label", isPassword ? "Ocultar senha" : "Mostrar senha");
}

async function openAuthenticatedApp(user) {
  currentUser = user;
  const profile = await loadOrCreateProfile(user);
  if (!profile) return false;

  currentProfile = profile;
  state.sessionEmail = user.email || profile.email || "";
  state.profile = profile;
  saveLocalState();

  await loadStateFromSupabase(user);
  setAdminAccess(profile);
  hydrateSettingsForm();
  showApp();
  return true;
}

function isAdministrator() {
  return ["admin", "administrador"].includes(String(currentProfile?.role || "").trim().toLowerCase());
}

function getCurrentPlan() {
  return planOptions[String(currentProfile?.plan_code || "free").trim().toLowerCase()] || planOptions.free;
}

function getMonthlyOrderCount() {
  const now = new Date();
  return state.orders.filter((order) => {
    if (!order.createdAt) return false;
    const createdAt = new Date(order.createdAt);
    return createdAt.getFullYear() === now.getFullYear() && createdAt.getMonth() === now.getMonth();
  }).length;
}

function canCreateOrder() {
  const plan = getCurrentPlan();
  const used = getMonthlyOrderCount();
  if (plan.limit !== null && used >= plan.limit) {
    alert(`O plano ${plan.label} atingiu o limite de ${plan.limit} OS neste mês. Escolha um plano superior para continuar.`);
    return false;
  }
  return true;
}

function setAdminAccess(profile) {
  const allowed = ["admin", "administrador"].includes(String(profile?.role || "").trim().toLowerCase());
  els.adminNavItem.classList.toggle("hidden", !allowed);
  if (allowed) loadAdminOverview();
}

async function loadAdminOverview() {
  if (!isAdministrator()) return;

  els.adminStatus.textContent = "Carregando indicadores...";
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_admin_overview");
  if (error) {
    console.error("Erro ao carregar visão administrativa:", error);
    els.adminStatus.textContent = "Não foi possível carregar os indicadores. Execute o SQL de administração no Supabase.";
    return;
  }

  const rows = data || [];
  els.adminUsersMetric.textContent = rows.length;
  els.adminCompaniesMetric.textContent = new Set(rows.map((row) => row.company_name || "Sem empresa")).size;
  els.adminOrdersMetric.textContent = rows.reduce((total, row) => total + Number(row.orders_count || 0), 0);
  els.adminCompaniesTable.innerHTML = rows.length
    ? rows.map((row) => `
      <tr>
        <td>${escapeHtml(row.username || row.email || "-")}</td>
        <td>${escapeHtml(row.company_name || "Sem empresa")}</td>
        <td>${escapeHtml(row.role || "operador")}</td>
        <td>${escapeHtml(formatPlan(row.plan_code))}</td>
        <td>
          <select class="admin-plan-select" data-user-plan="${escapeHtml(row.user_id)}" aria-label="Plano de ${escapeHtml(row.email || row.username || "usuário")}">
            ${renderPlanOptions(row.plan_code)}
          </select>
          <small>${escapeHtml(`${row.monthly_orders_count || 0}/${row.monthly_order_limit ?? "Ilimitadas"} OS no mês`)}</small>
        </td>
        <td>${escapeHtml(row.orders_count || 0)}</td>
        <td>${escapeHtml(formatAdminDate(row.updated_at))}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="7">Nenhum usuário cadastrado.</td></tr>`;
  document.querySelectorAll("[data-user-plan]").forEach((select) => {
    select.addEventListener("change", () => updateUserPlan(select.dataset.userPlan, select.value));
  });
  els.adminStatus.textContent = `Atualizado em ${new Date().toLocaleString("pt-BR")}.`;
}

function renderPlanOptions(selectedPlan) {
  return Object.entries(planOptions).map(([code, plan]) => `
    <option value="${code}" ${code === (selectedPlan || "free") ? "selected" : ""}>${plan.label} - ${plan.price}${plan.limit ? ` (${plan.limit} OS/mês)` : " (Ilimitado)"}</option>
  `).join("");
}

function formatPlan(planCode) {
  return planOptions[planCode]?.label || "Free";
}

async function updateUserPlan(userId, planCode) {
  const client = getSupabaseClient();
  if (!client) return;
  const { error } = await client.rpc("set_user_plan", {
    target_user_id: userId,
    target_plan_code: planCode
  });
  if (error) {
    alert("Não foi possível atualizar o plano: " + error.message);
    loadAdminOverview();
    return;
  }
  loadAdminOverview();
}

function formatAdminDate(value) {
  if (!value) return "Nunca";
  return new Date(value).toLocaleString("pt-BR");
}

async function loadOrCreateProfile(user) {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from("os_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      if (data.active === false) {
        setLoginStatus("Seu perfil está inativo. Fale com o administrador.", "error");
        await client.auth.signOut();
        return null;
      }
      return data;
    }

    const newProfile = {
      id: user.id,
      email: user.email || "",
      full_name: user.user_metadata?.full_name || "",
      role: "operador",
      active: true,
      plan_code: "free",
      monthly_order_limit: 30
    };

    const { data: insertedProfile, error: insertError } = await client
      .from("os_profiles")
      .insert(newProfile)
      .select()
      .single();

    if (insertError) throw insertError;
    return insertedProfile;
  } catch (error) {
    console.error("Erro ao validar perfil:", error);
    setLoginStatus("Usuário autenticado, mas não foi possível validar o perfil.", "error");
    return null;
  }
}

async function loadStateFromSupabase(user) {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { data, error } = await client
      .from(supabaseConfig.tableName)
      .select("data")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;

    if (data?.data) {
      state = {
        ...structuredClone(initialState),
        ...data.data,
        sessionEmail: user.email || "",
        profile: currentProfile
      };
      await loadItemsFromSupabase(user);
      saveLocalState();
      hydrateSettingsForm();
      return true;
    }

    await loadItemsFromSupabase(user);
    await syncStateToSupabase();
    return true;
  } catch (error) {
    console.error("Erro ao carregar dados do Supabase:", error);
    alert("Não foi possível carregar os dados do Supabase. O sistema continuará usando os dados locais deste navegador.");
    return false;
  }
}

async function loadItemsFromSupabase(user) {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { data, error } = await client
      .from("os_items")
      .select("id, item_code, ean, ncm_sh, name, description")
      .eq("user_id", user.id)
      .order("name");

    if (error) throw error;
    if (data?.length) {
      state.items = data.map((item) => ({
        id: item.id,
        code: item.item_code,
        ean: item.ean,
        ncmSh: item.ncm_sh || "",
        name: item.name,
        description: item.description || ""
      }));
    } else if (state.items?.length) {
      const legacyItems = state.items.map((item) => ({
        id: item.id || crypto.randomUUID(),
        code: item.code || `LEGACY-${item.id}`,
        ean: item.ean || `LEGACY-${item.id}`,
        name: item.name,
        description: item.description || ""
      }));
      for (const item of legacyItems) await syncItemToSupabase(item);
      state.items = legacyItems;
    } else {
      state.items = [];
    }
    return true;
  } catch (error) {
    console.error("Erro ao carregar itens do Supabase:", error);
    return false;
  }
}

async function syncItemToSupabase(item) {
  const client = getSupabaseClient();
  if (!client || !currentUser) return false;

  const { error } = await client.from("os_items").insert({
    id: item.id,
    user_id: currentUser.id,
    item_code: item.code,
    ean: item.ean,
    ncm_sh: item.ncmSh || "",
    name: item.name,
    description: item.description || ""
  });
  if (error) {
    console.error("Erro ao salvar item no Supabase:", error);
    return false;
  }
  return true;
}

async function deleteItemFromSupabase(itemId) {
  const client = getSupabaseClient();
  if (!client || !currentUser) return false;

  const { error } = await client
    .from("os_items")
    .delete()
    .eq("id", itemId)
    .eq("user_id", currentUser.id);
  if (error) {
    console.error("Erro ao excluir item do Supabase:", error);
    return false;
  }
  return true;
}

async function syncStateToSupabase() {
  const client = getSupabaseClient();
  if (!client || !currentUser) return false;

  try {
    const { error } = await client
      .from(supabaseConfig.tableName)
      .upsert({
        user_id: currentUser.id,
        user_email: state.sessionEmail,
        data: getPersistableState(),
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Erro ao salvar dados no Supabase:", error);
    return false;
  }
}

function getPersistableState() {
  return {
    users: state.users,
    profile: state.profile,
    company: state.company,
    clients: state.clients,
    items: state.items,
    orders: state.orders,
    finance: state.finance
  };
}

function showApp() {
  els.loginView.classList.add("hidden");
  els.appView.classList.remove("hidden");
  els.userEmailMenu.textContent = currentProfile?.full_name || state.sessionEmail;
  showPage("dashboard");
  renderAll();
}

function setLoginStatus(message, type) {
  if (!els.loginStatus) return;
  els.loginStatus.textContent = message;
  els.loginStatus.classList.toggle("success", type === "success");
  els.loginStatus.classList.toggle("error", type === "error");
}

function showPage(page) {
  if (page === "admin" && !isAdministrator()) {
    alert("Acesso restrito ao administrador.");
    return;
  }

  document.querySelectorAll(".page").forEach((section) => {
    section.classList.remove("active-page");
  });
  document.querySelector(`#${page}Page`).classList.add("active-page");

  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.page === page);
  });

  els.pageTitle.textContent = pageNames[page];
  els.sidebar.classList.remove("open");
  if (page === "orders") renderOrderPreview();
}

function renderAll() {
  els.companyNameMenu.textContent = state.company.name || "Gerador de OS";
  renderLoginBrand();
  renderCompanyLogoMenu();
  renderClientOptions();
  renderDashboard();
  renderOrdersTable();
  renderClientsList();
  renderItemsList();
  renderItemOptions();
  renderFinanceList();
  renderOrderPreview();
}

function renderLoginBrand() {
  const hasLogo = Boolean(state.company.logo);
  els.loginCompanyLogo.classList.toggle("hidden", !hasLogo);
  els.loginBrand.querySelector(".brand-mark").classList.toggle("hidden", hasLogo);
  els.loginCompanyName.textContent = state.company.name || "GTSYSTEM";
  if (hasLogo) {
    els.loginCompanyLogo.src = state.company.logo;
    els.loginCompanyLogo.alt = `Logo de ${state.company.name || "empresa"}`;
  } else {
    els.loginCompanyLogo.removeAttribute("src");
  }
}

function renderCompanyLogoMenu() {
  const hasLogo = Boolean(state.company.logo);
  els.companyLogoMenuImage.classList.toggle("hidden", !hasLogo);
  els.companyLogoMenu.querySelector(".brand-mark").classList.toggle("hidden", hasLogo);
  if (hasLogo) {
    els.companyLogoMenuImage.src = state.company.logo;
    els.companyLogoMenuImage.alt = `Logo de ${state.company.name || "empresa"}`;
  } else {
    els.companyLogoMenuImage.removeAttribute("src");
  }
}

function setTodayDefaults() {
  const today = new Date().toISOString().slice(0, 10);
  document.querySelector("#financeDueDate").value = today;
}

function hydrateSettingsForm() {
  setValue("companyName", state.company.name);
  setValue("companyTagline", state.company.tagline);
  setValue("companyPhone", state.company.phone);
  setValue("companySite", state.company.site);
  setValue("companyDocument", state.company.document);
  setValue("companyEmail", state.company.email);
  setValue("companyAddress", state.company.address);
  companyLogoSource = state.company.logo || "";
  resetCompanyLogoEditor();
}

function resetCompanyLogoEditor() {
  companyLogoImage = null;
  els.companyLogoZoom.value = "100";
  els.companyLogoX.value = "0";
  els.companyLogoY.value = "0";
  if (companyLogoSource) {
    const image = new Image();
    image.onload = () => {
      companyLogoImage = image;
      drawCompanyLogo();
      setCompanyLogoStatus("Logo carregada. Ajuste o tamanho e a posição antes de salvar.", "success");
    };
    image.onerror = () => setCompanyLogoStatus("Não foi possível carregar a logo salva.", "error");
    image.src = companyLogoSource;
  } else {
    drawCompanyLogo();
    setCompanyLogoStatus("Escolha uma imagem para personalizar a logo.", "");
  }
}

function loadCompanyLogo(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    setCompanyLogoStatus("Escolha um arquivo de imagem válido.", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      companyLogoSource = reader.result;
      companyLogoImage = image;
      centerCompanyLogo();
      setCompanyLogoStatus("Imagem pronta. Ajuste o tamanho e a posição antes de salvar.", "success");
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function centerCompanyLogo() {
  els.companyLogoZoom.value = "100";
  els.companyLogoX.value = "0";
  els.companyLogoY.value = "0";
  drawCompanyLogo();
}

function drawCompanyLogo() {
  const canvas = els.companyLogoCanvas;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!companyLogoImage) return;

  const baseScale = Math.min(canvas.width / companyLogoImage.width, canvas.height / companyLogoImage.height);
  const scale = baseScale * (Number(els.companyLogoZoom.value) / 100);
  const width = companyLogoImage.width * scale;
  const height = companyLogoImage.height * scale;
  const offsetX = (canvas.width - width) / 2 + Number(els.companyLogoX.value) * canvas.width / 200;
  const offsetY = (canvas.height - height) / 2 + Number(els.companyLogoY.value) * canvas.height / 200;
  context.drawImage(companyLogoImage, offsetX, offsetY, width, height);
}

function setCompanyLogoStatus(message, type) {
  els.companyLogoStatus.textContent = message;
  els.companyLogoStatus.classList.toggle("success", type === "success");
  els.companyLogoStatus.classList.toggle("error", type === "error");
}

function getCompanyLogoData() {
  if (!companyLogoImage) return companyLogoSource;
  return els.companyLogoCanvas.toDataURL("image/png");
}

function setValue(id, value) {
  document.querySelector(`#${id}`).value = value || "";
}

function renderClientOptions() {
  const options = state.clients
    .map((client) => `<option value="${escapeHtml(client.id)}">${escapeHtml(client.name)}</option>`)
    .join("");
  const clientPlaceholder = `<option value="" selected>${options ? "Selecione o cliente" : "Cadastre um cliente primeiro"}</option>`;
  const financeFallback = `<option value="">Cadastre um cliente primeiro</option>`;
  els.orderClient.innerHTML = clientPlaceholder + options;
  els.financeClient.innerHTML = options || financeFallback;
}

function nextOrderNumber() {
  const next = state.orders.length + 1;
  return `OS-${String(next).padStart(5, "0")}`;
}

function getOrderFromForm() {
  const client = state.clients.find((item) => item.id === els.orderClient.value) || {};
  return {
    id: draftOrderId || crypto.randomUUID(),
    number: document.querySelector("#orderNumberLabel").textContent,
    clientId: client.id || "",
    clientName: client.name || "",
    clientDocument: client.document || "",
    clientPhone: client.phone || "",
    clientEmail: client.email || "",
    status: valueOf("orderStatus"),
    priority: valueOf("orderPriority"),
    vehiclePlate: valueOf("vehiclePlate"),
    vehicleType: valueOf("vehicleType"),
    vehicleModel: valueOf("vehicleModel"),
    vehicleKm: valueOf("vehicleKm"),
    startDate: valueOf("startDate"),
    dueDate: valueOf("dueDate"),
    finishDate: valueOf("finishDate"),
    value: Number(valueOf("orderValue") || 0),
    servicesDone: valueOf("servicesDone"),
    items: [...orderItems],
    partsUsed: orderItems.join(", "),
    description: valueOf("serviceDescription"),
    notes: valueOf("orderNotes"),
    createdAt: new Date().toISOString()
  };
}

function addOrderItem() {
  const item = els.orderItemInput.value.trim();
  if (!item) return;

  orderItems.push(item);
  els.orderItemInput.value = "";
  renderOrderItems();
  renderOrderPreview();
  els.orderItemInput.focus();
}

function removeOrderItem(index) {
  orderItems.splice(index, 1);
  renderOrderItems();
  renderOrderPreview();
}

function renderOrderItems() {
  els.orderItemsList.innerHTML = orderItems.length
    ? orderItems.map((item, index) => `
      <div class="order-item">
        <span>${escapeHtml(item)}</span>
        <button class="remove-order-item" type="button" data-item-index="${index}" aria-label="Remover ${escapeHtml(item)}" title="Remover item">×</button>
      </div>
    `).join("")
    : "";

  els.orderItemsList.querySelectorAll("[data-item-index]").forEach((button) => {
    button.addEventListener("click", () => removeOrderItem(Number(button.dataset.itemIndex)));
  });
}

function valueOf(id) {
  return document.querySelector(`#${id}`).value.trim();
}

function saveOrder(event) {
  event.preventDefault();
  if (!state.clients.length) return alert("Cadastre um cliente antes de salvar a OS.");

  const order = getOrderFromForm();
  const existingIndex = state.orders.findIndex((item) => item.id === order.id);
  if (existingIndex < 0 && !canCreateOrder()) return;
  if (existingIndex >= 0) {
    state.orders[existingIndex] = order;
  } else {
    state.orders.unshift(order);
  }

  draftOrderId = null;
  saveState();
  resetOrderForm();
  renderAll();
  showPage("reports");
}

function resetOrderForm() {
  els.orderForm.reset();
  orderItems = [];
  renderOrderItems();
  document.querySelector("#orderNumberLabel").textContent = nextOrderNumber();
}

function renderOrderPreview() {
  document.querySelector("#orderNumberLabel").textContent = draftOrderId
    ? document.querySelector("#orderNumberLabel").textContent
    : nextOrderNumber();
  const order = getOrderFromForm();
  els.osPreview.innerHTML = buildOrderHtml(order);
}

function buildOrderHtml(order) {
  const issuedAt = new Date().toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  });
  const companyLogo = state.company.logo
    ? `<img class="os-company-logo" src="${escapeHtml(state.company.logo)}" alt="Logo de ${escapeHtml(state.company.name)}">`
    : "";

  return `
    <header class="os-header">
      <div class="os-company">
        ${companyLogo}
        <div>
        <h2>${escapeHtml(state.company.name)}</h2>
        <p>${escapeHtml(state.company.tagline)}</p>
        <p>Contato: ${escapeHtml(state.company.phone)} • ${escapeHtml(state.company.site)}</p>
        </div>
      </div>
      <div class="os-number">
        <strong>${escapeHtml(order.number)}</strong>
        <p>Emitido em ${issuedAt}</p>
      </div>
    </header>

    <div class="os-status-row">
      <span class="status-pill">${escapeHtml(order.status || "Aberta")}</span>
      <span class="status-pill">Prioridade: ${escapeHtml(order.priority || "Média")}</span>
    </div>

    ${section("Cliente", `
      <div class="os-fields">
        ${field("Nome / Razão social", order.clientName)}
        ${field("Documento", order.clientDocument)}
        ${field("Telefone", order.clientPhone)}
        ${field("E-mail", order.clientEmail)}
      </div>
    `)}

    ${section("Veículo", `
      <div class="os-fields three">
        ${field("Placa", order.vehiclePlate)}
        ${field("Tipo", order.vehicleType)}
        ${field("Modelo", order.vehicleModel)}
        ${field("KM / Identificação", order.vehicleKm)}
      </div>
    `)}

    ${section("Descrição do Serviço", `
      <div class="os-field">${paragraph(order.description)}</div>
      <div class="os-fields">
        ${field("Serviços realizados", order.servicesDone)}
      </div>
    `)}

    ${section("Itens", `
      <div class="os-item-list">${order.items?.length ? order.items.map((item) => `<div>${escapeHtml(item)}</div>`).join("") : escapeHtml(order.partsUsed || "-")}</div>
    `)}

    ${section("Datas e Valor", `
      <div class="os-fields">
        ${field("Data de entrada", formatDate(order.startDate))}
        ${field("Data prevista", formatDate(order.dueDate))}
        ${field("Data de conclusão", formatDate(order.finishDate))}
        ${field("Valor", money.format(order.value || 0))}
      </div>
    `)}

    ${section("Observações", `<div class="os-field">${paragraph(order.notes)}</div>`)}

    ${section("Fotos do Veículo / Peças", `
      <div class="photo-grid">
        <div class="photo-box"></div>
        <div class="photo-box"></div>
        <div class="photo-box"></div>
      </div>
    `)}

    <footer class="os-footer">
      <div>
        <strong>${escapeHtml(state.company.name)}</strong>
        <p>${escapeHtml(state.company.phone)} • ${escapeHtml(state.company.site)}</p>
        <div class="signature">Assinatura do responsável</div>
      </div>
      <strong>${escapeHtml(order.number)}</strong>
    </footer>
  `;
}

function section(title, content) {
  return `<section class="os-section"><h3 class="os-section-title">${title}</h3>${content}</section>`;
}

function field(label, value) {
  return `<div class="os-field"><span>${label}</span><strong>${escapeHtml(value || "-")}</strong></div>`;
}

function paragraph(value) {
  return `<p>${escapeHtml(value || "-")}</p>`;
}

function formatDate(date) {
  if (!date) return "-";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function saveClient(event) {
  event.preventDefault();
  const client = getClientFromForm();

  if (clientBeingEditedId) {
    const clientIndex = state.clients.findIndex((item) => item.id === clientBeingEditedId);
    if (clientIndex >= 0) state.clients[clientIndex] = client;
  } else {
    state.clients.unshift(client);
  }

  resetClientForm();
  saveState();
  renderAll();
}

function saveItem(event) {
  event.preventDefault();
  const code = els.itemCode.value.trim();
  const ean = els.itemEan.value.trim();
  const ncmSh = els.itemNcmSh.value.trim();
  const name = els.itemName.value.trim();
  const description = els.itemDescription.value.trim();

  const newValues = [code, ean, name].filter(Boolean).map((value) => value.toLowerCase());
  const alreadyExists = (state.items || []).some((item) => [item.code, item.ean, item.name]
    .filter(Boolean)
    .some((value) => newValues.includes(value.toLowerCase())));
  if (alreadyExists) {
    alert("Já existe um item com este código, EAN ou nome.");
    return;
  }

  state.items = state.items || [];
  const item = { id: crypto.randomUUID(), code, ean, ncmSh, name, description };
  state.items.unshift(item);
  els.itemForm.reset();
  saveState();
  syncItemToSupabase(item);
  renderAll();
}

function deleteItem(itemId) {
  state.items = (state.items || []).filter((item) => item.id !== itemId);
  saveState();
  deleteItemFromSupabase(itemId);
  renderAll();
}

function getClientFromForm() {
  return {
    id: clientBeingEditedId || crypto.randomUUID(),
    name: valueOf("clientName"),
    document: valueOf("clientDocument"),
    phone: valueOf("clientPhone"),
    email: valueOf("clientEmail"),
    address: valueOf("clientAddress")
  };
}

function openQuickClientModal() {
  els.quickClientForm.reset();
  els.quickClientModal.classList.remove("hidden");
  document.querySelector("#quickClientName").focus();
}

function closeQuickClientModal() {
  els.quickClientModal.classList.add("hidden");
}

function saveClientFromOrder(event) {
  event.preventDefault();
  const client = {
    id: crypto.randomUUID(),
    name: valueOf("quickClientName"),
    document: valueOf("quickClientDocument"),
    phone: valueOf("quickClientPhone"),
    email: valueOf("quickClientEmail"),
    address: valueOf("quickClientAddress")
  };

  state.clients.unshift(client);
  saveState();
  renderAll();
  els.orderClient.value = client.id;
  renderOrderPreview();
  closeQuickClientModal();
}

function editClient(clientId) {
  const client = state.clients.find((item) => item.id === clientId);
  if (!client) return;

  clientBeingEditedId = client.id;
  setValue("clientName", client.name);
  setValue("clientDocument", client.document);
  setValue("clientPhone", client.phone);
  setValue("clientEmail", client.email);
  setValue("clientAddress", client.address);
  els.clientSubmitButton.textContent = "Atualizar cliente";
  els.cancelClientEditButton.classList.remove("hidden");
  document.querySelector("#clientName").focus();
}

function deleteClient(clientId) {
  const client = state.clients.find((item) => item.id === clientId);
  if (!client) return;

  const hasOrders = state.orders.some((order) => order.clientId === clientId);
  const warning = hasOrders
    ? `A empresa "${client.name}" possui OS vinculadas. Excluir mesmo assim?`
    : `Excluir a empresa "${client.name}"?`;
  if (!window.confirm(warning)) return;

  state.clients = state.clients.filter((item) => item.id !== clientId);
  if (clientBeingEditedId === clientId) resetClientForm();
  saveState();
  renderAll();
}

function resetClientForm() {
  clientBeingEditedId = null;
  els.clientForm.reset();
  els.clientSubmitButton.textContent = "Salvar cliente";
  els.cancelClientEditButton.classList.add("hidden");
  setCnpjStatus("", "");
}

async function searchCnpj() {
  const documentValue = valueOf("clientDocument");
  const cnpj = documentValue.replace(/\D/g, "");

  if (cnpj.length !== 14) {
    setCnpjStatus("Informe um CNPJ com 14 dígitos para buscar.", "error");
    return;
  }

  setCnpjStatus("Buscando dados do CNPJ...", "");
  els.searchCnpjButton.disabled = true;
  els.searchCnpjButton.textContent = "Buscando";

  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "CNPJ não encontrado.");
    }

    fillClientFromCnpj(data);
    setCnpjStatus("Dados encontrados e preenchidos automaticamente.", "success");
  } catch (error) {
    setCnpjStatus(error.message || "Não foi possível consultar o CNPJ agora.", "error");
  } finally {
    els.searchCnpjButton.disabled = false;
    els.searchCnpjButton.textContent = "Buscar CNPJ";
  }
}

function fillClientFromCnpj(data) {
  setValue("clientName", data.razao_social || data.nome_fantasia || valueOf("clientName"));
  setValue("clientDocument", formatCnpj(data.cnpj || valueOf("clientDocument")));
  setValue("clientPhone", firstFilled(data.ddd_telefone_1, data.ddd_telefone_2, valueOf("clientPhone")));
  setValue("clientEmail", data.email || valueOf("clientEmail"));
  setValue("clientAddress", buildAddress(data) || valueOf("clientAddress"));
}

function setCnpjStatus(message, type) {
  els.cnpjSearchStatus.textContent = message;
  els.cnpjSearchStatus.classList.toggle("success", type === "success");
  els.cnpjSearchStatus.classList.toggle("error", type === "error");
}

function buildAddress(data) {
  const street = [data.descricao_tipo_de_logradouro, data.logradouro]
    .filter(Boolean)
    .join(" ");
  const city = [data.municipio, data.uf].filter(Boolean).join(" - ");
  return [
    street,
    data.numero,
    data.complemento,
    data.bairro,
    city,
    data.cep ? `CEP ${data.cep}` : ""
  ].filter(Boolean).join(", ");
}

function firstFilled(...values) {
  return values.find((value) => String(value || "").trim()) || "";
}

function formatCnpj(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length !== 14) return value || "";
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function saveSettings(event) {
  event.preventDefault();
  state.company = {
    name: valueOf("companyName"),
    tagline: valueOf("companyTagline"),
    phone: valueOf("companyPhone"),
    site: valueOf("companySite"),
    document: valueOf("companyDocument"),
    email: valueOf("companyEmail"),
    address: valueOf("companyAddress"),
    logo: getCompanyLogoData()
  };
  saveState();
  renderAll();
  alert("Configuração salva.");
}

function saveFinance(event) {
  event.preventDefault();
  const client = state.clients.find((item) => item.id === els.financeClient.value) || {};
  state.finance.unshift({
    id: crypto.randomUUID(),
    clientName: client.name || "Sem cliente",
    reference: valueOf("financeReference"),
    value: Number(valueOf("financeValue") || 0),
    dueDate: valueOf("financeDueDate"),
    type: valueOf("financeType"),
    status: valueOf("financeStatus")
  });

  els.financeForm.reset();
  setTodayDefaults();
  saveState();
  renderAll();
}

function renderDashboard() {
  const openOrders = state.orders.filter((order) => order.status !== "Concluída" && order.status !== "Cancelada");
  const total = state.orders.reduce((sum, order) => sum + Number(order.value || 0), 0);
  const pendingFinance = state.finance.filter((item) => item.status !== "Pago").length;

  document.querySelector("#openOrdersMetric").textContent = openOrders.length;
  document.querySelector("#clientsMetric").textContent = state.clients.length;
  document.querySelector("#revenueMetric").textContent = money.format(total);
  document.querySelector("#financeMetric").textContent = pendingFinance;

  const recent = state.orders.slice(0, 5);
  document.querySelector("#recentOrders").innerHTML = recent.length
    ? recent.map((order) => listCard(order.number, `${order.clientName} • ${order.status} • ${money.format(order.value || 0)}`)).join("")
    : empty("Nenhuma OS cadastrada ainda.");
}

function renderOrdersTable() {
  const query = els.reportSearch.value.trim().toLowerCase();
  const rows = state.orders.filter((order) => {
    const text = `${order.number} ${order.clientName} ${order.vehiclePlate}`.toLowerCase();
    return text.includes(query);
  });

  document.querySelector("#ordersTable").innerHTML = rows.length
    ? rows.map((order) => `
      <tr>
        <td>${escapeHtml(order.number)}</td>
        <td>${escapeHtml(order.clientName)}</td>
        <td>${escapeHtml(order.vehiclePlate || "-")}</td>
        <td>${escapeHtml(order.status)}</td>
        <td>${money.format(order.value || 0)}</td>
        <td>${formatDate(order.startDate)}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="6">Nenhuma OS encontrada.</td></tr>`;
}

function renderClientsList() {
  document.querySelector("#clientsList").innerHTML = state.clients.length
    ? state.clients.map((client) => `
      <article class="list-card client-list-card">
        <div>
          <strong>${escapeHtml(client.name)}</strong>
          <span>${escapeHtml(`${client.document || "Sem documento"} • ${client.phone || "Sem telefone"}`)}</span>
        </div>
        <div class="list-card-actions">
          <button class="secondary-button" data-client-edit="${escapeHtml(client.id)}" type="button">Editar</button>
          <button class="danger-button" data-client-delete="${escapeHtml(client.id)}" type="button">Excluir</button>
        </div>
      </article>
    `).join("")
    : empty("Nenhum cliente cadastrado.");

  document.querySelectorAll("[data-client-edit]").forEach((button) => {
    button.addEventListener("click", () => editClient(button.dataset.clientEdit));
  });
  document.querySelectorAll("[data-client-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteClient(button.dataset.clientDelete));
  });
}

function renderItemOptions() {
  els.companyItemsList.innerHTML = (state.items || [])
    .map((item) => `<option value="${escapeHtml(item.name)}"></option>`)
    .join("");
}

function renderItemsList() {
  els.itemsList.innerHTML = state.items?.length
    ? state.items.map((item) => `
      <article class="list-card client-list-card">
        <div>
          <strong>${escapeHtml(item.name || "Item sem nome")}</strong>
          <span>${escapeHtml(`${item.code || "Sem código"} • EAN: ${item.ean || "Sem EAN"} • NCM/SH: ${item.ncmSh || "Sem NCM/SH"}`)}</span>
          <span>${escapeHtml(item.description || "Sem descrição")}</span>
        </div>
        <button class="danger-button" data-item-delete="${escapeHtml(item.id)}" type="button">Excluir</button>
      </article>
    `).join("")
    : empty("Nenhum item cadastrado.");

  els.itemsList.querySelectorAll("[data-item-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteItem(button.dataset.itemDelete));
  });
}

function renderFinanceList() {
  document.querySelector("#financeList").innerHTML = state.finance.length
    ? state.finance.map((item) => listCard(
      `${item.type} • ${item.status}`,
      `${item.clientName} • ${item.reference || "Sem referência"} • ${money.format(item.value || 0)} • vence ${formatDate(item.dueDate)}`
    )).join("")
    : empty("Nenhum lançamento financeiro.");
}

function listCard(title, subtitle) {
  return `<article class="list-card"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(subtitle)}</span></article>`;
}

function empty(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
