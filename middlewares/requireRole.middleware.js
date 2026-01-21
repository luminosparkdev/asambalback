function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const userRoles = req.user?.roles || [];
    const hasRole = allowedRoles.some(role => userRoles.includes(role));

    if (!hasRole) {
      return res.status(403).json({ message: "Acceso denegado, rol insuficiente" });
    }
    next();
    console.log("ROLES EN TOKEN:", req.user.roles);
  };
};

module.exports = requireRole;