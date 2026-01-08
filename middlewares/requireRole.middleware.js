const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: "Rol no definido" });
    }

    if (req.user.role !== role) {
      return res.status(403).json({
        message: "No tenés permisos para esta acción",
      });
    }

    next();
  };
};

module.exports = requireRole;
