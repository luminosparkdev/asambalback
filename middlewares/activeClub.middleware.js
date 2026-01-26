const resolveActiveClub = (req, res, next) => {
  const clubId = req.headers["x-club-id"];

  if (!clubId) return res.status(400).json({ message: "Club activo no especificado" });

  const club = req.user.clubs?.find(c => c.clubId === clubId);

  if (!club) return res.status(403).json({ message: "No perteneces a este club" });

  req.activeClub = club; // <-- guardamos club activo
  next();
};

module.exports = resolveActiveClub;
