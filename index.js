require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const authRoutes = require("./routes/auth.routes");
const usersRoutes = require("./routes/users.routes");
const clubsRoutes = require("./routes/clubs.routes");
const coachesRoutes = require("./routes/coaches.routes");
const asambalRoutes = require("./routes/asambal.routes");
const heroclubsRoutes = require("./routes/heroclubs.routes");
const jugadoresRoutes = require("./routes/players.routes");
const categoriesRoutes = require("./routes/categories.routes");
const mercadopagoRoutes = require("./routes/mercadopago.routes");
const certificadosRoutes = require("./routes/certificados.routes");
const webhookRoutes = require("./routes/webhook.routes");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://asambal.com",
  "https://www.asambal.com"
];

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("CORS no permitido"));
        }
    },
    credentials: true,
    methods: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    allowedHeaders: ["Content-Type", "Authorization", "X-club-id", "x-professor-clubs"],
};

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 300, // máximo 300 requests por IP
  message: "Demasiadas solicitudes, intenta más tarde."
});

app.use(morgan("dev"));
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());  
app.use(limiter);  
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/clubs", clubsRoutes);
app.use("/api/coaches", coachesRoutes);
app.use("/api/asambal", asambalRoutes);
app.use("/api/heroclubs", heroclubsRoutes);
app.use("/api/players", jugadoresRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/pagos", mercadopagoRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/certificados", certificadosRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);

  res.status(500).json({
    message: "Error interno del servidor"
  });
});

app.get("/", (req, res) => {
  res.send("API Asambal funcionando 🚀");
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "asambal-api",
    timestamp: new Date()
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
