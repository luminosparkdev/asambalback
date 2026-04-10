const { db, admin } = require("../config/firebase");

const crearCuota = async (req, res) => {
  const { preview } = req.body;

  try {
    const { mes, anio, categorias, monto, fechaVencimiento } = req.body;
    const clubId = req.user?.clubId || req.body.clubId;

    // 🛑 VALIDACIONES FUERTES
    if (!clubId) {
      return res.status(400).json({
        code: "CLUB_ID_REQUERIDO",
        message: "No se pudo determinar el clubId",
      });
    }

    if (!mes || !anio || !categorias?.length || !monto) {
      return res.status(400).json({
        code: "DATOS_INVALIDOS",
        message: "Faltan datos obligatorios",
      });
    }

    const periodo = `${mes}-${anio}`;

    console.log("DEBUG crearCuota:", {
      mes,
      anio,
      categorias,
      monto,
      clubId,
      preview,
    });

    // 🔎 1. TRAER JUGADORES
    const snapshotJugadores = await db
      .collection("jugadores")
      .where("status", "==", "ACTIVO")
      .get();

    const jugadores = snapshotJugadores.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // 🧠 2. FILTRAR POR CATEGORIA PRINCIPAL
    const jugadoresFiltrados = jugadores.filter((jugador) => {
  if (!Array.isArray(jugador.clubs)) return false;

  return jugador.clubs.some((c) => {
    return (
      c.clubId === clubId &&
      categorias.includes(c.categoriaPrincipal)
    );
  });
});

    if (jugadoresFiltrados.length === 0) {
      return res.json({
        code: "SIN_JUGADORES",
        message: "No hay jugadores para las categorías seleccionadas",
      });
    }

    // 🔎 3. DETECTAR DUPLICADOS (OPTIMIZADO)
    const cuotasSnap = await db
      .collectionGroup("cuotas")
      .where("clubId", "==", clubId)
      .where("periodo", "==", periodo)
      .get();

    const jugadoresConCuota = new Set(
      cuotasSnap.docs.map((doc) => doc.data().jugadorId)
    );

    const jugadoresFinales = jugadoresFiltrados.filter(
      (j) => !jugadoresConCuota.has(j.id)
    );

    // 🔮 PREVIEW
    if (preview) {
      return res.json({
        code: "PREVIEW",
        total: jugadoresFiltrados.length,
        nuevos: jugadoresFinales.length,
        duplicados: jugadoresFiltrados.length - jugadoresFinales.length,
      });
    }

    // 🚫 SI NO HAY NUEVAS
    if (jugadoresFinales.length === 0) {
      return res.json({
        code: "SIN_NUEVAS_CUOTAS",
        message: "Todos los jugadores ya tienen cuota para este período",
      });
    }

    // 🧾 4. CREAR CUOTA MADRE
    const cuotaRef = db
      .collection("clubes")
      .doc(clubId)
      .collection("cuotas")
      .doc();

    const cuotaId = cuotaRef.id;

    const cuotaData = {
      mes,
      anio,
      periodo,
      categorias,
      monto,
      fechaVencimiento: fechaVencimiento || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // 🧾 5. BATCH
    const batch = db.batch();

    batch.set(cuotaRef, cuotaData);

    jugadoresFinales.forEach((jugador) => {
      const ref = db
        .collection("jugadores")
        .doc(jugador.id)
        .collection("cuotas")
        .doc(cuotaId);

      batch.set(ref, {
        cuotaId,
        clubId,
        jugadorId: jugador.id,
        mes,
        anio,
        periodo,
        monto,
        fechaVencimiento: fechaVencimiento || null,
        estado: "ADEUDADO",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();

    return res.json({
      code: "CUOTA_CREADA",
      message: `Se generaron ${jugadoresFinales.length} cuotas (se omitieron ${
        jugadoresFiltrados.length - jugadoresFinales.length
      } duplicadas)`,
    });
  } catch (error) {
    console.error("Error creando cuota:", error);

    return res.status(500).json({
      code: "ERROR_SERVIDOR",
      message: "Error al crear la cuota",
    });
  }
};

module.exports = { crearCuota };