const { db, admin } = require("../config/firebase");

const crearCuota = async (req, res) => {
  const { preview } = req.body;

  try {
    const {
      mes,
      anio,
      categorias,
      categoriasDetalle,
      monto,
      fechaVencimiento,
    } = req.body;

    const clubId = req.user?.clubId || req.body.clubId;

    // 🛑 VALIDACIONES
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

    if (!categoriasDetalle || !categoriasDetalle.length) {
      return res.status(400).json({
        code: "CATEGORIAS_DETALLE_REQUERIDO",
        message: "Faltan detalles de categorías",
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

    // 🔎 1. TRAER JUGADORES ACTIVOS
    const snapshotJugadores = await db
      .collection("jugadores")
      .where("status", "==", "ACTIVO")
      .get();

    const jugadores = snapshotJugadores.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // 🧠 2. FILTRAR POR CLUB + CATEGORIA
    const jugadoresFiltrados = jugadores.filter((jugador) => {
      if (!Array.isArray(jugador.clubs)) return false;

      return jugador.clubs.some(
        (c) =>
          c.clubId === clubId &&
          categorias.includes(c.categoriaPrincipal)
      );
    });

    if (jugadoresFiltrados.length === 0) {
      return res.json({
        code: "SIN_JUGADORES",
        message: "No hay jugadores para las categorías seleccionadas",
      });
    }

    // 🔎 3. DETECTAR DUPLICADOS (AHORA SOBRE cuotasJugador)
    const cuotasSnap = await db
      .collectionGroup("cuotasJugador")
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
        duplicados:
          jugadoresFiltrados.length - jugadoresFinales.length,
      });
    }

    // 🚫 SIN NUEVAS CUOTAS
    if (jugadoresFinales.length === 0) {
      return res.json({
        code: "SIN_NUEVAS_CUOTAS",
        message:
          "Todos los jugadores ya tienen cuota para este período",
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
      categoriasDetalle,
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
        .collection("cuotasJugador") // 🔥 CAMBIO CLAVE
        .doc(cuotaId);

      batch.set(ref, {
        cuotaId,
        clubId,
        jugadorId: jugador.id,
        mes,
        anio,
        periodo,
        categorias,
        categoriasDetalle,
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

const getCuotas = async (req, res) => {
  try {
    const clubId = req.user?.clubId || req.query.clubId;

    if (!clubId) {
      return res.status(400).json({
        code: "CLUB_ID_REQUERIDO",
        message: "No se pudo determinar el clubId",
      });
    }

    const { periodo, mes, anio, categoria, limit = 12, lastDocId } = req.query;

    let query = db
      .collection("clubes")
      .doc(clubId)
      .collection("cuotas")
      .orderBy("createdAt", "desc")
      .limit(Number(limit));

    // 🔍 filtros seguros
    if (periodo) query = query.where("periodo", "==", periodo);
    if (mes !== undefined && mes !== "") query = query.where("mes", "==", Number(mes));
    if (anio !== undefined && anio !== "") query = query.where("anio", "==", Number(anio));
    if (categoria) query = query.where("categorias", "array-contains", categoria);

    // 🔥 paginación
    if (lastDocId) {
      const lastDoc = await db
        .collection("clubes")
        .doc(clubId)
        .collection("cuotas")
        .doc(lastDocId)
        .get();

      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      return res.json({
        data: [],
        lastDoc: null,
      });
    }

    const cuotasDocs = snapshot.docs;

    // 🚀 1 sola query para TODAS las cuotas hijas
    const cuotaIds = cuotasDocs.map((doc) => doc.id);

    const cuotasHijasSnap = await db
      .collectionGroup("cuotasJugador") // 🔥 YA NO HAY CONFLICTO
      .where("clubId", "==", clubId)
      .where("cuotaId", "in", cuotaIds)
      .get();

    // 🧠 agrupar en memoria
    const statsMap = {};

    cuotasHijasSnap.docs.forEach((doc) => {
      const data = doc.data();
      const id = data.cuotaId;

      if (!statsMap[id]) {
        statsMap[id] = {
          total: 0,
          pagados: 0,
        };
      }

      statsMap[id].total++;

      if (data.estado === "PAGADO") {
        statsMap[id].pagados++;
      }
    });

    // 🧾 armar respuesta final
    const cuotasFinal = cuotasDocs.map((doc) => {
      const data = doc.data();
      const stats = statsMap[doc.id] || { total: 0, pagados: 0 };

      return {
        id: doc.id,
        ...data,
        totalJugadores: stats.total,
        totalPagados: stats.pagados,
        totalAdeudados: stats.total - stats.pagados,
      };
    });

    return res.json({
      data: cuotasFinal,
      lastDoc: cuotasDocs[cuotasDocs.length - 1]?.id || null,
    });

  } catch (error) {
    console.error("Error obteniendo cuotas:", error);

    return res.status(500).json({
      code: "ERROR_SERVIDOR",
      message: "Error al obtener cuotas",
    });
  }
};

module.exports = { 
    crearCuota,
    getCuotas
 };