const { db } = require("../config/firebase");

const logAudit = async ({
  req,
  action,
  entity,
  entityId,
  payload = {},
}) => {
  await db.collection("auditoria").add({
    actorId: req.user.email,
    role: req.user.role,
    action,
    entity,
    entityId,
    payload,
    createdAt: new Date(),
  });
};

module.exports = { logAudit };
