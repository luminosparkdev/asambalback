function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const userRoles = req.user?.roles || [];
    const hasRole = allowedRoles.some(role => userRoles.includes(role));

    console.log("ROLES EN TOKEN:", userRoles);

    if (!hasRole) {
      return res.status(403).json({ message: "Acceso denegado, rol insuficiente" });
    }
    next();
  };
};

module.exports = requireRole;