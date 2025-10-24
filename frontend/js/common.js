// ✅ URL base del backend (ajusta el puerto si es necesario)
// Usar el mismo dominio que el frontend para mantener compatibilidad con cookies
export const API_URL = (() => {
    const host = window.location.hostname;
    // Usar el mismo host que está sirviendo el frontend
    if (host === 'localhost' || host === '127.0.0.1') {
        return `http://${host}:4000/api`;
    }
    // En producción usar el mismo origen
    return `${window.location.protocol}//${host}:4000/api`;
})();

// ✅ Obtener token del usuario autenticado

// El token ahora se maneja por cookie httpOnly, no por localStorage
export function getToken() {
    // Ya no se usa, pero se mantiene para compatibilidad
    return null;
}

// ✅ Configuración base para peticiones con autenticación

export function authHeaders() {
    // Solo Content-Type, el token lo envía el navegador por cookie
    return {
        "Content-Type": "application/json"
    };
}

// ✅ Función genérica para hacer peticiones

export async function apiFetch(url, options = {}) {
    // Incluir headers base, el token lo envía el navegador por cookie
    options.headers = Object.assign({}, authHeaders(), options.headers || {});
    options.credentials = 'include'; // enviar cookies
    
    console.log(`🌐 API Request: ${options.method || 'GET'} ${API_URL}${url}`);
    console.log('🍪 Cookies:', document.cookie || 'No cookies');
    
    const res = await fetch(`${API_URL}${url}`, options);
    
    console.log(`📡 Response: ${res.status} ${res.statusText}`);
    
    if (!res.ok) {
        const errorText = await res.text();
        console.error(`❌ API Error: ${res.status} - ${errorText}`);
        
        // Si es 401, probablemente necesita login
        if (res.status === 401) {
            console.log('🔐 Error 401 - Redirigiendo al login...');
            localStorage.removeItem('user');
            
            // Solo redirigir si no estamos ya en login
            if (!window.location.pathname.includes('login.html')) {
                alert('Su sesión ha expirado. Debe iniciar sesión nuevamente.');
                window.location.href = location.origin + "/frontend/login.html";
            }
        }
        
        throw new Error(errorText);
    }
    
    return res.json();
}

// ✅ Redirección si no hay token

export function checkAuth() {
    // Verificar si hay usuario en localStorage
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user) {
        alert("Debe iniciar sesión como administrador");
        window.location.href = location.origin + "/frontend/login.html";
        return;
    }
    if (user.rol === 'desactivado') {
        alert('Tu usuario ha sido desactivado. Contacta al administrador.');
        window.location.href = location.origin + '/frontend/login.html';
        return;
    }
}

// ✅ Verificación async de autenticación con el backend
export async function verifyAuth() {
    try {
        const response = await fetch(`${API_URL}/users/me`, {
            credentials: 'include',
            headers: authHeaders()
        });
        
        if (!response.ok) {
            throw new Error('No autenticado');
        }
        
        const user = await response.json();
        // Actualizar localStorage con datos del servidor
        localStorage.setItem('user', JSON.stringify(user));
        return user;
    } catch (error) {
        // Limpiar localStorage si la verificación falla
        localStorage.removeItem('user');
        alert("Debe iniciar sesión como administrador");
        window.location.href = location.origin + "/frontend/login.html";
        return null;
    }
}

// ✅ Función de logout
export async function logout() {
    try {
        await fetch(`${API_URL}/users/logout`, {
            method: 'POST',
            credentials: 'include',
            headers: authHeaders()
        });
    } catch (error) {
        console.error('Error en logout:', error);
    } finally {
        // Limpiar localStorage siempre
        localStorage.removeItem('user');
        window.location.href = location.origin + "/frontend/login.html";
    }
}

// ✅ Función de debug para compatibilidad de navegadores
export function debugBrowserCompatibility() {
    const info = {
        userAgent: navigator.userAgent,
        isChrome: navigator.userAgent.includes('Chrome'),
        isEdge: navigator.userAgent.includes('Edge'),
        currentDomain: window.location.hostname,
        apiUrl: API_URL,
        cookies: document.cookie || 'No cookies',
        localStorage: localStorage.getItem('user') ? 'Usuario presente' : 'Sin usuario'
    };
    
    console.table(info);
    return info;
}
