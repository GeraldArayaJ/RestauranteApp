import jwt from "jsonwebtoken";
const JWT_SECRET = "tu_secreto_aqui";

export const authMiddleware = (roles = []) => {
    return (req, res, next) => {
        // Debug: Log cookies y headers
        console.log('=== AUTH DEBUG ===');
        console.log('Cookies recibidas:', req.cookies);
        console.log('Headers authorization:', req.headers.authorization);
        console.log('Origin:', req.headers.origin);
        console.log('==================');
        
        // Priorizar token de cookie httpOnly
        let token = null;
        if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
            console.log('Token encontrado en cookies');
        } else if (req.headers.authorization) {
            token = req.headers.authorization.split(" ")[1];
            console.log('Token encontrado en header authorization');
        }
        
        if (!token) {
            console.log('No se encontró token en cookies ni headers');
            return res.status(401).json({ message: "Token faltante" });
        }

        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            if (roles.length && !roles.includes(decoded.rol)) {
                return res.status(403).json({ message: "Acceso denegado" });
            }
            req.user = decoded;
            next();
        } catch (err) {
            console.log('Token inválido:', err.message);
            res.status(401).json({ message: "Token inválido" });
        }
    };
};
