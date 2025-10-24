// auth-guard.js - Middleware de autenticación para páginas
import { checkAuth, verifyAuth } from './common.js';

// Lista de páginas que requieren autenticación
const protectedPages = [
    'index.html',
    'dashboard.html', 
    'platos.html',
    'mesas-admin.html',
    'users.html',
    'ordenes.html',
    'pagos.html',
    'admin-reportes.html',
    'mesas.html'
];

// Verificar si la página actual requiere autenticación
function requiresAuth() {
    const currentPage = window.location.pathname.split('/').pop();
    return protectedPages.includes(currentPage);
}

// Función principal de autenticación
export async function initializeAuth() {
    // Si no es una página protegida, no hacer nada
    if (!requiresAuth()) {
        return true;
    }

    console.log('🔒 Página protegida detectada, verificando autenticación...');
    
    try {
        // Verificar localStorage primero
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        
        if (!user) {
            console.log('❌ No hay usuario en localStorage');
            redirectToLogin('No hay sesión activa');
            return false;
        }

        console.log('✅ Usuario encontrado en localStorage:', user.nombre);

        // Verificar con el servidor que la sesión es válida
        try {
            const serverUser = await verifyAuth();
            console.log('✅ Sesión verificada con el servidor');
            return true;
        } catch (error) {
            console.log('❌ Sesión inválida en el servidor:', error.message);
            redirectToLogin('Su sesión ha expirado');
            return false;
        }

    } catch (error) {
        console.error('❌ Error en verificación de autenticación:', error);
        redirectToLogin('Error de autenticación');
        return false;
    }
}

// Función para redirigir al login con mensaje
function redirectToLogin(message) {
    // Limpiar datos locales
    localStorage.removeItem('user');
    
    // Mostrar mensaje si no estamos ya en la página de login
    if (!window.location.pathname.includes('login.html')) {
        alert(message + '. Redirigiendo al login...');
        
        // Pequeño delay para que el usuario vea el mensaje
        setTimeout(() => {
            window.location.href = location.origin + "/frontend/login.html";
        }, 1000);
    }
}

// Auto-inicializar cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    initializeAuth();
});

// También exportar para uso manual
export { requiresAuth, redirectToLogin };