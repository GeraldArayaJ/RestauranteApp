import { API_URL } from './common.js';

const userInfoBar = document.getElementById('userInfoBar');
const mainNav = document.getElementById('mainNav');

// Obtener usuario
async function fetchUser() {
  try {
    const res = await fetch(`${API_URL}/users/me`, { credentials: 'include' });
    if (!res.ok) throw new Error('No autenticado');
    const user = await res.json();
    renderLayout(user);
  } catch {
    renderLayout(null);
  }
}

// Renderiza topbar y sidebar
function renderLayout(user) {
  // === TOPBAR ===
  if (userInfoBar) {
    userInfoBar.className = "topbar d-flex justify-content-between align-items-center px-4 py-2 shadow fixed-top";
    userInfoBar.innerHTML = user ? `
      <div class="d-flex align-items-center gap-3">
        <button class="sidebar-toggle" onclick="toggleSidebar()">
          <i class="bi bi-list"></i>
        </button>
        <div class="avatar bg-gradient d-flex justify-content-center align-items-center rounded-circle">
          <i class="bi bi-person-fill text-white fs-5"></i>
        </div>
        <div>
          <div class="fw-semibold text-light">${user.nombre}</div>
          <small class="text-light opacity-75 text-uppercase">${user.rol}</small>
        </div>
      </div>
      <button class="btn btn-outline-light btn-sm rounded-pill" onclick="window.location.href='login.html'">
        <i class="bi bi-box-arrow-right"></i> Salir
      </button>
    ` : `
      <button class="sidebar-toggle" onclick="toggleSidebar()">
        <i class="bi bi-list"></i>
      </button>
      <span class="text-light">No autenticado</span>
      <a href="login.html" class="btn btn-outline-light btn-sm rounded-pill">Iniciar sesión</a>
    `;
  }

  // === SIDEBAR ===
  if (mainNav) {
    mainNav.className = "d-flex";

    mainNav.innerHTML = `
      <nav class="sidebar bg-dark text-light shadow-lg position-fixed vh-100" id="sidebar">
        <a href="index.html" class="d-flex align-items-center mb-4 text-decoration-none text-light px-3 py-2">
          <i class="bi bi-shop fs-4 me-2"></i>
          <span class="fs-5 fw-bold">Restaurante</span>
        </a>

        <ul class="nav nav-pills flex-column mb-auto gap-1">
          ${getMenuItems(user).map(item => `
            <li>
              <a href="${item.href}" class="nav-link d-flex align-items-center text-light sidebar-link px-3 py-2 rounded-3" onclick="closeSidebar()">
                <i class="bi ${item.icon} me-2"></i>
                ${item.text}
              </a>
            </li>`).join('')}
        </ul>

        <div class="mt-auto pt-3 border-top border-secondary px-3">
          <a href="login.html" class="btn btn-outline-light w-100 rounded-pill">
            <i class="bi bi-box-arrow-in-right"></i> Login
          </a>
        </div>
      </nav>

      <div class="sidebar-overlay" id="sidebarOverlay" onclick="closeSidebar()"></div>

      <div class="content flex-grow-1 ms-sidebar pt-topbar px-4">
        <!-- Contenido principal va aquí -->
      </div>
    `;
  }
}

// Menú según rol
function getMenuItems(user) {
  if (!user) return [];

  if (user.rol === 'recepcionista') {
    return [
      { href: "ordenes.html", text: "Órdenes", icon: "bi-receipt" },
      { href: "pagos.html", text: "Pagos", icon: "bi-cash-coin" },
    ];
  }

  return [
    { href: "index.html", text: "Dashboard", icon: "bi-speedometer2" },
    { href: "platos.html", text: "Platos", icon: "bi-egg-fried" },
    { href: "mesas-admin.html", text: "Mesas", icon: "bi-grid-3x3-gap" },
    { href: "users.html", text: "Usuarios", icon: "bi-people-fill" },
    { href: "ordenes.html", text: "Órdenes", icon: "bi-receipt" },
    { href: "pagos.html", text: "Pagos", icon: "bi-cash-stack" },
    { href: "admin-reportes.html", text: "Reportes", icon: "bi-bar-chart-fill" },
  ];
}

// Funciones globales para el toggle del sidebar en móvil
window.toggleSidebar = function() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  
  if (sidebar && overlay) {
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
  }
};

window.closeSidebar = function() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  
  if (sidebar && overlay) {
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
  }
};

fetchUser();
