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
    address: ""
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
  orders: [],
  finance: []
};

let state = loadState();
let draftOrderId = null;
let authMode = "login";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const els = {
  loginView: document.querySelector("#loginView"),
  appView: document.querySelector("#appView"),
  loginForm: document.querySelector("#loginForm"),
  loginEmail: document.querySelector("#loginEmail"),
    loginName: document.querySelector("#loginName"),
    loginNameField: document.querySelector("#loginNameField"),
    loginPassword: document.querySelector("#loginPassword"),
    loginPasswordField: document.querySelector("#loginPasswordField"),
    loginPasswordConfirm: document.querySelector("#loginPasswordConfirm"),
    loginPasswordConfirmField: document.querySelector("#loginPasswordConfirmField"),
    loginSubmitButton: document.querySelector("#loginSubmitButton"),
    authDescription: document.querySelector("#authDescription"),
    forgotPasswordButton: document.querySelector("#forgotPasswordButton"),
    magicLinkButton: document.querySelector("#magicLinkButton"),
    togglePasswordButton: document.querySelector("#togglePasswordButton"),
    loginStatus: document.querySelector("#loginStatus"),
  logoutButton: document.querySelector("#logoutButton"),
  menuToggle: document.querySelector("#menuToggle"),
  sidebar: document.querySelector(".sidebar"),
  pageTitle: document.querySelector("#pageTitle"),
  userEmailMenu: document.querySelector("#userEmailMenu"),
  companyNameMenu: document.querySelector("#companyNameMenu"),
  orderForm: document.querySelector("#orderForm"),
  osPreview: document.querySelector("#osPreview"),
  orderClient: document.querySelector("#orderClient"),
  financeClient: document.querySelector("#financeClient"),
  clientForm: document.querySelector("#clientForm"),
  searchCnpjButton: document.querySelector("#searchCnpjButton"),
  cnpjSearchStatus: document.querySelector("#cnpjSearchStatus"),
  settingsForm: document.querySelector("#settingsForm"),
  financeForm: document.querySelector("#financeForm"),
  reportSearch: document.querySelector("#reportSearch")
};

const pageNames = {
  dashboard: "Painel",
  orders: "Gerar OS",
  reports: "Relatório de OS",
  finance: "Financeiro",
  clients: "Clientes",
  settings: "Configuração"
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
    const email = els.loginEmail.value.trim().toLowerCase();
    if (!email) return;

      await submitAuthForm();
  });

    document.querySelectorAll("[data-auth-mode]").forEach((button) => {
      button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
    });

    els.forgotPasswordButton.addEventListener("click", () => setAuthMode("recovery"));
    els.magicLinkButton.addEventListener("click", () => requestSupabaseLogin(els.loginEmail.value.trim().toLowerCase()));
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

  document.querySelector("#printOrderButton").addEventListener("click", () => {
    renderOrderPreview();
    window.print();
  });

  els.clientForm.addEventListener("submit", saveClient);
  els.searchCnpjButton.addEventListener("click", searchCnpj);
  els.settingsForm.addEventListener("submit", saveSettings);
  els.financeForm.addEventListener("submit", saveFinance);
  els.reportSearch.addEventListener("input", renderOrdersTable);

  const client = getSupabaseClient();
  if (client) {
    client.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          setAuthMode("recovery-update");
          return;
        }
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

async function requestSupabaseLogin(email) {
  const client = getSupabaseClient();
  if (!client) {
    setLoginStatus(getSupabaseConfigError(), "error");
    return false;
  }

  setLoginStatus("Enviando link de acesso...", "");

  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: getAuthRedirectUrl()
    }
  });

  if (error) {
    setLoginStatus(getSupabaseLoginErrorMessage(error), "error");
    return false;
  }

  setLoginStatus("Link enviado. Abra seu e-mail e confirme o acesso.", "success");
  return true;
}

async function submitAuthForm() {
  const email = els.loginEmail.value.trim().toLowerCase();
  if (!email) return;

  if (authMode === "recovery") {
    await requestSupabasePasswordReset(email);
    return;
  }

  if (authMode === "recovery-update") {
    if (els.loginPassword.value !== els.loginPasswordConfirm.value) {
      setLoginStatus("As senhas não conferem.", "error");
      return;
    }
    await updateSupabasePassword(els.loginPassword.value);
    return;
  }

  if (authMode === "signup") {
    if (els.loginPassword.value !== els.loginPasswordConfirm.value) {
      setLoginStatus("As senhas não conferem.", "error");
      return;
    }
    await requestSupabaseSignup(email, els.loginPassword.value, els.loginName.value.trim());
    return;
  }

  await requestSupabasePasswordLogin(email, els.loginPassword.value);
}

async function requestSupabasePasswordLogin(email, password) {
  const client = getSupabaseClient();
  if (!client) {
    setLoginStatus(getSupabaseConfigError(), "error");
    return false;
  }

  setLoginStatus("Validando acesso...", "");
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    setLoginStatus(getSupabaseAuthErrorMessage(error), "error");
    return false;
  }
  return true;
}

async function requestSupabaseSignup(email, password, fullName) {
  const client = getSupabaseClient();
  if (!client) {
    setLoginStatus(getSupabaseConfigError(), "error");
    return false;
  }

  setLoginStatus("Criando sua conta...", "");
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: getAuthRedirectUrl()
    }
  });

  if (error) {
    setLoginStatus(getSupabaseAuthErrorMessage(error), "error");
    return false;
  }

  if (data.session?.user) {
    await openAuthenticatedApp(data.session.user);
  } else {
    setLoginStatus("Cadastro criado. Confirme seu e-mail para liberar o acesso.", "success");
  }
  return true;
}

async function requestSupabasePasswordReset(email) {
  const client = getSupabaseClient();
  if (!client) {
    setLoginStatus(getSupabaseConfigError(), "error");
    return false;
  }

  setLoginStatus("Enviando instruções...", "");
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: getAuthRedirectUrl()
  });
  if (error) {
    setLoginStatus(getSupabaseAuthErrorMessage(error), "error");
    return false;
  }
  setLoginStatus("Confira seu e-mail para redefinir a senha.", "success");
  return true;
}

async function updateSupabasePassword(password) {
  const client = getSupabaseClient();
  if (!client) {
    setLoginStatus(getSupabaseConfigError(), "error");
    return false;
  }

  setLoginStatus("Atualizando sua senha...", "");
  const { error } = await client.auth.updateUser({ password });
  if (error) {
    setLoginStatus(getSupabaseAuthErrorMessage(error), "error");
    return false;
  }
  setAuthMode("login");
  setLoginStatus("Senha atualizada. Você já pode entrar.", "success");
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
  const isRecovery = mode === "recovery";
  const isRecoveryUpdate = mode === "recovery-update";
  const isLogin = mode === "login";
  const isPasswordMode = isLogin || isSignup || isRecoveryUpdate;

  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    const active = button.dataset.authMode === mode || (isRecovery || isRecoveryUpdate) && button.dataset.authMode === "login";
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });

  els.authDescription.textContent = isSignup
    ? "Crie seu acesso em poucos segundos e comece a organizar suas ordens de serviço."
    : isRecoveryUpdate
      ? "Escolha uma nova senha para voltar ao sistema."
      : isRecovery
        ? "Informe seu e-mail para receber o link de recuperação."
        : "Entre com seu e-mail e senha para abrir seu perfil de trabalho.";
  els.loginNameField.classList.toggle("hidden", !isSignup);
  els.loginName.classList.toggle("hidden", !isSignup);
  els.loginName.required = isSignup;
  els.loginPasswordField.classList.toggle("hidden", !isPasswordMode);
  els.loginPassword.classList.toggle("hidden", !isPasswordMode);
  els.togglePasswordButton.classList.toggle("hidden", !isPasswordMode);
  els.loginPassword.required = isPasswordMode;
  els.loginPasswordConfirmField.classList.toggle("hidden", !(isSignup || isRecoveryUpdate));
  els.loginPasswordConfirm.classList.toggle("hidden", !(isSignup || isRecoveryUpdate));
  els.loginPasswordConfirm.required = isSignup || isRecoveryUpdate;
  els.loginPasswordField.textContent = isRecoveryUpdate ? "Nova senha" : "Senha";
  els.loginPassword.autocomplete = isLogin ? "current-password" : "new-password";
  els.loginSubmitButton.textContent = isSignup ? "Criar minha conta" : isRecoveryUpdate ? "Salvar nova senha" : isRecovery ? "Enviar link" : "Entrar";
  els.forgotPasswordButton.classList.toggle("hidden", !isLogin);
  els.magicLinkButton.classList.toggle("hidden", !isLogin);
  setLoginStatus(isSignup ? "Use uma senha com pelo menos 6 caracteres." : isRecoveryUpdate ? "Digite e confirme a nova senha." : isRecovery ? "O link será enviado para o e-mail informado." : "Use seu e-mail e senha cadastrados.", "");
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
  hydrateSettingsForm();
  showApp();
  return true;
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
      active: true
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
      saveLocalState();
      hydrateSettingsForm();
      return true;
    }

    await syncStateToSupabase();
    return true;
  } catch (error) {
    console.error("Erro ao carregar dados do Supabase:", error);
    alert("Não foi possível carregar os dados do Supabase. O sistema continuará usando os dados locais deste navegador.");
    return false;
  }
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
  renderClientOptions();
  renderDashboard();
  renderOrdersTable();
  renderClientsList();
  renderFinanceList();
  renderOrderPreview();
}

function setTodayDefaults() {
  const today = new Date().toISOString().slice(0, 10);
  document.querySelector("#startDate").value = today;
  document.querySelector("#dueDate").value = today;
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
}

function setValue(id, value) {
  document.querySelector(`#${id}`).value = value || "";
}

function renderClientOptions() {
  const options = state.clients
    .map((client) => `<option value="${escapeHtml(client.id)}">${escapeHtml(client.name)}</option>`)
    .join("");
  const fallback = `<option value="">Cadastre um cliente primeiro</option>`;
  els.orderClient.innerHTML = options || fallback;
  els.financeClient.innerHTML = options || fallback;
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
    partsUsed: valueOf("partsUsed"),
    description: valueOf("serviceDescription"),
    notes: valueOf("orderNotes"),
    createdAt: new Date().toISOString()
  };
}

function valueOf(id) {
  return document.querySelector(`#${id}`).value.trim();
}

function saveOrder(event) {
  event.preventDefault();
  if (!state.clients.length) return alert("Cadastre um cliente antes de salvar a OS.");

  const order = getOrderFromForm();
  const existingIndex = state.orders.findIndex((item) => item.id === order.id);
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
  setTodayDefaults();
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

  return `
    <header class="os-header">
      <div>
        <h2>${escapeHtml(state.company.name)}</h2>
        <p>${escapeHtml(state.company.tagline)}</p>
        <p>Contato: ${escapeHtml(state.company.phone)} • ${escapeHtml(state.company.site)}</p>
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
        ${field("Peças / Vidros", order.partsUsed)}
      </div>
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
  state.clients.unshift({
    id: crypto.randomUUID(),
    name: valueOf("clientName"),
    document: valueOf("clientDocument"),
    phone: valueOf("clientPhone"),
    email: valueOf("clientEmail"),
    address: valueOf("clientAddress")
  });

  els.clientForm.reset();
  saveState();
  renderAll();
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
    address: valueOf("companyAddress")
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
    ? state.clients.map((client) => listCard(client.name, `${client.document || "Sem documento"} • ${client.phone || "Sem telefone"}`)).join("")
    : empty("Nenhum cliente cadastrado.");
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
