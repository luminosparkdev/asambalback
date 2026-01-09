const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: "Rol no definido" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "No tenés permisos" });
    }

    next();
  };
};

module.exports = requireRole;
