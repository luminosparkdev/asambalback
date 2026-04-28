const { db, admin } = require("../config/firebase");

const crearCuota = async (req, res) => {
  const { preview } = req.body;

  try {
    const { mes, anio, categorias, monto, fechaVencimiento } = req.body;
    const clubId = req.user?.clubId || req.body.clubId;

    if (!clubId) {
      return res.status(400).json({
        code: "CLUB_ID_REQUERIDO",
      });
    }

    if (!mes || !anio || !categorias?.length || !monto) {
      return res.status(400).json({
        code: "DATOS_INVALIDOS",
      });
    }

    const periodo = `${mes}-${anio}`;

    // 🔎 1. jugadores
    const snapshotJugadores = await db
      .collection("jugadores")
      .where("status", "==", "ACTIVO")
      .get();

    const jugadores = snapshotJugadores.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // 🔎 2. filtrar por club + categoria
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
      });
    }

    // 🔎 3. duplicados
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

    // 🔮 preview
    if (preview) {
      return res.json({
        code: "PREVIEW",
        total: jugadoresFiltrados.length,
        nuevos: jugadoresFinales.length,
        duplicados: jugadoresFiltrados.length - jugadoresFinales.length,
      });
    }

    if (jugadoresFinales.length === 0) {
      return res.json({
        code: "SIN_NUEVAS_CUOTAS",
      });
    }

    // 🧾 4. cuota madre
    const cuotaRef = db
      .collection("clubes")
      .doc(clubId)
      .collection("cuotas")
      .doc();

    const cuotaId = cuotaRef.id;
    const { categoriasDetalle } = req.body;

    const cuotaData = {
      mes,
      anio,
      periodo,
      categorias,
      categoriasDetalle,
      monto,
      fechaVencimiento: fechaVencimiento
        ? admin.firestore.Timestamp.fromDate(new Date(fechaVencimiento))
        : null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const batch = db.batch();
    batch.set(cuotaRef, cuotaData);

    // 🔥 5. cuotas hijas con snapshot
    jugadoresFinales.forEach((jugador) => {
      const clubData = jugador.clubs.find(c => c.clubId === clubId);

      const categoria = categoriasDetalle.find(
        (cat) => cat.id === clubData?.categoriaPrincipal
      );

      const ref = db
        .collection("jugadores")
        .doc(jugador.id)
        .collection("cuotasJugador")
        .doc(cuotaId);

      batch.set(ref, {
        cuotaId,
        clubId,
        jugadorId: jugador.id,

        // 🔥 SNAPSHOT (clave para performance)
        nombre: jugador.nombre || "",
        apellido: jugador.apellido || "",
        telefono: jugador.telefono || "",
        categoriaId: clubData?.categoriaPrincipal || null,
        categoriaNombre: categoria
          ? `${categoria.nombre} ${categoria.genero}`
          : "",

        mes,
        anio,
        periodo,
        monto,

        fechaVencimientoActual: fechaVencimiento
          ? admin.firestore.Timestamp.fromDate(new Date(fechaVencimiento))
          : null,

        estado: "ADEUDADO",

        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();

    return res.json({
      code: "CUOTA_CREADA",
      message: `Se generaron ${jugadoresFinales.length} cuotas`,
    });

  } catch (error) {
    console.error("Error creando cuota:", error);

    return res.status(500).json({
      code: "ERROR_SERVIDOR",
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

    // 🔍 filtros independientes
    if (periodo) {
      query = query.where("periodo", "==", periodo);
    }

    if (mes !== undefined && mes !== "") {
      query = query.where("mes", "==", Number(mes));
    }

    if (anio !== undefined && anio !== "") {
      query = query.where("anio", "==", Number(anio));
    }

    if (categoria) {
      query = query.where("categorias", "array-contains", categoria);
    }

    // 🔥 paginación correcta
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
    const cuotaIds = cuotasDocs.map((doc) => doc.id);

    const chunk = cuotaIds.slice(0, 10);

    let statsMap = {};

    // 🔥 evitar error con "in" vacío
    if (cuotaIds.length > 0) {
      const cuotasHijasSnap = await db
        .collectionGroup("cuotasJugador")
        .where("clubId", "==", clubId)
        .where("cuotaId", "in", chunk)
        .get();

      cuotasHijasSnap.docs.forEach((doc) => {
        const data = doc.data();
        const id = data.cuotaId;

        if (!statsMap[id]) {
          statsMap[id] = {
          total: 0,
          pagados: 0,
          pendientes: 0,
          adeudados: 0,
          vencidos: 0,
          };
        }

      statsMap[id].total++;

      switch (data.estado) {
  case "PAGADO":
    statsMap[id].pagados++;
    break;
  case "PENDIENTE":
    statsMap[id].pendientes++;
    break;
  case "ADEUDADO":
    statsMap[id].adeudados++;
    break;
  case "VENCIDO":
    statsMap[id].vencidos++;
    break;
      }
    });
  }

    const cuotasFinal = cuotasDocs.map((doc) => {
      const data = doc.data();
      const stats = statsMap[doc.id] || { total: 0, pagados: 0, pendientes: 0, adeudados: 0, vencidos: 0, };

      return {
        id: doc.id,
        ...data,
        totalJugadores: stats.total,
        totalPagados: stats.pagados,
        totalPendientes: stats.pendientes,
        totalAdeudados: stats.adeudados + stats.vencidos,
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

const getCuotaDetalle = async (req, res) => {
  try {
    const { id } = req.params;
    const clubId = req.user?.clubId || req.query.clubId;

    if (!clubId) {
      return res.status(400).json({
        code: "CLUB_ID_REQUERIDO",
      });
    }

    // 🧾 cuota madre
    const cuotaRef = db
      .collection("clubes")
      .doc(clubId)
      .collection("cuotas")
      .doc(id);

    const cuotaSnap = await cuotaRef.get();

    if (!cuotaSnap.exists) {
      return res.status(404).json({
        code: "CUOTA_NO_ENCONTRADA",
      });
    }

    const cuota = { id: cuotaSnap.id, ...cuotaSnap.data() };

    // 🔥 cuotas hijas (YA TIENEN TODO)
    const cuotasHijasSnap = await db
      .collectionGroup("cuotasJugador")
      .where("clubId", "==", clubId)
      .where("cuotaId", "==", id)
      .get();

    const jugadores = cuotasHijasSnap.docs.map((doc) => {
      const data = doc.data();

      return {
        id: data.jugadorId,
        nombre: data.nombre || "",
        apellido: data.apellido || "",
        telefono: data.telefono || "-",
        categoriaNombre: data.categoriaNombre || "-",
        estado: data.estado,
        fechaVencimiento: data.fechaVencimientoActual || null,
      };
    });

    return res.json({
      cuota,
      jugadores,
    });

  } catch (error) {
    console.error("Error obteniendo detalle:", error);

    return res.status(500).json({
      code: "ERROR_SERVIDOR",
    });
  }
};

const aplicarProrroga = async (req, res) => {
  try {
    const { cuotaId, jugadorId } = req.params;
    const { nuevaFecha, clubId: clubIdBody } = req.body;
    const clubId = req.user?.clubId || clubIdBody;

    if (!clubId || !nuevaFecha) {
      return res.status(400).json({
        code: "DATOS_INVALIDOS",
        message: "Faltan datos",
      });
    }

    // 🔎 buscar cuota hija
    const snap = await db
      .collectionGroup("cuotasJugador")
      .where("clubId", "==", clubId)
      .where("cuotaId", "==", cuotaId)
      .where("jugadorId", "==", jugadorId)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({
        code: "CUOTA_NO_ENCONTRADA",
        message: "No se encontró la cuota del jugador",
      });
    }

    const doc = snap.docs[0];
    const data = doc.data();

    const nuevaFechaTS = admin.firestore.Timestamp.fromDate(
      new Date(nuevaFecha)
    );

    await doc.ref.update({
      estado: "ADEUDADO",

      // 🔥 historial de prórrogas
      prorrogas: admin.firestore.FieldValue.arrayUnion({
        nuevaFecha: nuevaFechaTS,
        aplicadaEn: new Date(),
      }),

      // 🔥 fecha vigente (clave para el cron)
      fechaVencimientoActual: nuevaFechaTS,

      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({
      code: "PRORROGA_APLICADA",
      message: "Prórroga aplicada correctamente",
    });

  } catch (error) {
    console.error("Error aplicando prórroga:", error);

    return res.status(500).json({
      code: "ERROR_SERVIDOR",
      message: "Error al aplicar prórroga",
    });
  }
};

const getCuotasJugador = async (req, res) => {
  try {
    const { jugadorId } = req.query;

    if (!jugadorId) {
      return res.status(400).json({
        message: "jugadorId es requerido",
      });
    }

    const snapshot = await db
      .collection("cuotasJugador")
      .where("jugadorId", "==", jugadorId)
      .orderBy("anio", "desc")
      .orderBy("mes", "desc")
      .get();

    const cuotas = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json(cuotas);
  } catch (error) {
    console.error("Error getMisCuotas:", error);
    return res.status(500).json({
      message: "Error obteniendo cuotas",
    });
  }
};

module.exports = { 
    crearCuota,
    getCuotas,
    getCuotaDetalle,
    aplicarProrroga,
    getCuotasJugador,
 };