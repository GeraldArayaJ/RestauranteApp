// auth-init.js - Script de inicialización de autenticación
// Este script debe incluirse en todas las páginas que requieren autenticación

import { checkAuth, verifyAuth } from './common.js';

// Función para inicializar autenticación
export async function initializeAuth() {
    try {
        // Verificar localStorage primero (para compatibilidad con Edge)
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        
        if (!user) {
            // No hay usuario en localStorage, redirigir inmediatamente
            alert("Debe iniciar sesión como administrador");
            window.location.href = location.origin + "/frontend/login.html";
            return false;
        }
        
        // Verificar con el servidor que la cookie es válida
        try {
            await verifyAuth();
            return true;
        } catch (error) {
            console.error('Cookie inválida o expirada:', error);
            // Si la cookie no es válida, limpiar localStorage y redirigir
            localStorage.removeItem('user');
            alert("Su sesión ha expirado. Debe iniciar sesión nuevamente.");
            window.location.href = location.origin + "/frontend/login.html";
            return false;
        }
    } catch (error) {
        console.error('Error de autenticación:', error);
        alert("Error de autenticación. Debe iniciar sesión.");
        window.location.href = location.origin + "/frontend/login.html";
        return false;
    }
}

// Auto-ejecutar si no estamos en la página de login
if (window.location.pathname !== '/frontend/login.html') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeAuth();
    });
}