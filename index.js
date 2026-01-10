const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/auth.routes");
const usersRoutes = require("./routes/users.routes");
const clubsRoutes = require("./routes/clubs.routes");
const coachesRoutes = require("./routes/coaches.routes");
const asambalRoutes = require("./routes/asambal.routes");


const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/clubs", clubsRoutes);
app.use("/api/coaches", coachesRoutes);
app.use("/api/asambal", asambalRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
