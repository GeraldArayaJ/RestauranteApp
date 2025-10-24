// login.js
const form = document.getElementById('loginForm');
const msg = document.getElementById('message');
const submitBtn = document.getElementById('submitBtn');

// Si la página se sirve desde un puerto distinto (ej. 8080), queremos
// apuntar siempre al backend local en el puerto 4000 durante desarrollo.
const API_BASE = (function () {
    const host = window.location.hostname;
    // Usar el MISMO dominio que el frontend para compatibilidad con cookies
    if (host === 'localhost' || host === '127.0.0.1') return `http://${host}:4000`;
    // en producción usar el mismo origen
    return window.location.origin;
})();

function showMessage(text, isError) { msg.textContent = text; msg.className = isError ? 'msg error' : 'msg'; }

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showMessage('');
    submitBtn.disabled = true;

    const correo = document.getElementById('correo').value.trim();
    const password = document.getElementById('password').value;

    if (!correo || !password) { showMessage('Completa correo y contraseña', true); submitBtn.disabled = false; return; }

    try {
        const res = await fetch(API_BASE + '/api/users/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ correo, password }),
            credentials: 'include' // recibir cookie
        });

        const data = await res.json();
        if (!res.ok) { showMessage('Correo o contraseña incorrecto', true); submitBtn.disabled = false; return; }

        // Validar rol permitido
        const role = data.user?.rol || '';
        if (role !== 'admin' && role !== 'salonero' && role !== 'recepcionista') {
            showMessage('Correo o contraseña incorrecto', true);
            submitBtn.disabled = false;
            return;
        }

        // Guardar usuario en localStorage para checkAuth()
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Debug: Verificar que las cookies se configuraron
        console.log('🎯 Login exitoso - Usuario guardado:', data.user);
        console.log('🏠 Dominio actual:', window.location.hostname);
        console.log('🌐 API URL:', API_BASE);
        console.log('🍪 Cookies disponibles:', document.cookie || 'Sin cookies');
        
        // Debug adicional: verificar cookie específica
        setTimeout(() => {
            const cookies = document.cookie.split(';').map(c => c.trim());
            const tokenCookie = cookies.find(c => c.startsWith('token='));
            console.log('✅ Cookie token encontrada:', tokenCookie ? 'SÍ' : 'NO');
            console.log('🔍 Navegador:', navigator.userAgent.includes('Chrome') ? 'Chrome' : 
                                       navigator.userAgent.includes('Edge') ? 'Edge' : 'Otro');
            
            if (tokenCookie) {
                console.log('🎉 ¡Cookies funcionando correctamente!');
            } else {
                console.error('❌ Las cookies no se están configurando');
            }
        }, 1000);
        
        showMessage('Login exitoso — redirigiendo...');
        setTimeout(() => {
            if (role === 'admin') {
                window.location.href = '/frontend/index.html';
            } else if (role === 'salonero') {
                window.location.href = '/frontend/mesas.html';
            } else if (role === 'recepcionista') {
                window.location.href = '/frontend/ordenes.html';
            }
        }, 700);

    } catch (err) {
        console.error(err);
        showMessage('No se pudo conectar con el servidor', true);
        submitBtn.disabled = false;
    }
});
