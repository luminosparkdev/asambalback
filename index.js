require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const authRoutes = require("./routes/auth.routes");
const usersRoutes = require("./routes/users.routes");
const clubsRoutes = require("./routes/clubs.routes");
const coachesRoutes = require("./routes/coaches.routes");
const asambalRoutes = require("./routes/asambal.routes");
const jugadoresRoutes = require("./routes/players.routes");
const categoriesRoutes = require("./routes/categories.routes");

const app = express();

const corsOptions = {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
    methods: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    allowedHeaders: ["Content-Type", "Authorization", "X-club-id"],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());    
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/clubs", clubsRoutes);
app.use("/api/coaches", coachesRoutes);
app.use("/api/asambal", asambalRoutes);
app.use("/api/players", jugadoresRoutes);
app.use("/api/categories", categoriesRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
