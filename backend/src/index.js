import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import http from "http"; // <- Necesario para Socket.io
import { Server } from "socket.io";

import userRoutes from "./routes/users.js";
import platoRoutes from "./routes/platos.js";
import ordenRoutes from "./routes/ordenes.js";
import mesasRoutes from "./routes/mesas.js";
import pagoOrdenRoutes from "./routes/pagoorden.js";

const app = express();
app.use(cors({
    origin: [
        'http://localhost:5500', // Principal - Live Server
        'http://127.0.0.1:5500', 
        'http://localhost:8080',
        'http://127.0.0.1:8080',
        'http://localhost:3000',
        'http://127.0.0.1:3000'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200 // Para compatibilidad con navegadores antiguos
}));
app.use(express.json());
app.use(cookieParser());

// Crear servidor HTTP
const server = http.createServer(app);

// Inicializar Socket.io
const io = new Server(server, {
    cors: {
        origin: [
            'http://localhost:5500', // Principal - Live Server
            'http://127.0.0.1:5500',
            'http://localhost:8080',
            'http://127.0.0.1:8080',
            'http://localhost:3000',
            'http://127.0.0.1:3000'
        ],
        credentials: true,
        methods: ['GET', 'POST']
    }
});

// Escuchar conexiones de clientes
io.on("connection", (socket) => {
    console.log("Cliente conectado:", socket.id);

    socket.on("disconnect", () => {
        console.log("Cliente desconectado:", socket.id);
    });
});

// Hacer io accesible en request (opcional)
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Rutas
// Log requests to /api/users for debugging
app.use('/api/users', (req, res, next) => {
    console.log(`[users route] ${req.method} ${req.originalUrl}`);
    next();
});
app.use("/api/users", userRoutes);
app.use("/api/platos", platoRoutes);
app.use("/api/ordenes", ordenRoutes);
app.use("/api/mesas", mesasRoutes);
app.use("/api/pagos-orden", pagoOrdenRoutes);

app.get("/", (req, res) => {
    res.send("Servidor backend funcionando ✅");
});

// Ruta de diagnóstico
app.get('/ping', (req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
});

const PORT = 4000;

// Manejadores adicionales para diagnóstico
server.on('error', (err) => {
    console.error('Error en el servidor HTTP:', err);
});

server.listen(PORT, '0.0.0.0', () => {
    const addr = server.address();
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log(`También disponible en http://127.0.0.1:${PORT}`);
    console.log('Server address info:', addr);
});
