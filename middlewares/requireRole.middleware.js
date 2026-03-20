function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const userRoles = req.user?.roles || [];
    const hasRole = allowedRoles.some(role => userRoles.includes(role));

    console.log("USER COMPLETO:", req.user);
    console.log("ROLES:", userRoles);
    console.log("ALLOWED:", allowedRoles);

    if (!hasRole) {
      return res.status(403).json({ message: "Acceso denegado, rol insuficiente" });
    }
    next();
  };
};

module.exports = requireRole;