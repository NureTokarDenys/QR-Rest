function createError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code   = code;
  return err;
}

// ── Generic HTTP helpers ──────────────────────────────────────────────────────
function notFound(message = 'Resource not found')  { return createError(404, 'NOT_FOUND',   message); }
function badRequest(message)                        { return createError(400, 'BAD_REQUEST', message); }
function forbidden(message = 'Forbidden')           { return createError(403, 'FORBIDDEN',   message); }
function conflict(message)                          { return createError(409, 'CONFLICT',    message); }

// ── Order-specific helpers ────────────────────────────────────────────────────
function orderFinalized(msg = 'This order is already completed or cancelled') {
  return createError(400, 'ORDER_FINALIZED', msg);
}
function orderPaidCannotCancel(msg = 'This order has been paid — close the table instead of cancelling') {
  return createError(400, 'ORDER_PAID_CANNOT_CANCEL', msg);
}
function orderNotPayable(msg = 'This order cannot be paid in its current status') {
  return createError(400, 'ORDER_NOT_PAYABLE', msg);
}
function orderAccessDenied(msg = 'You do not have access to this order') {
  return createError(403, 'ORDER_ACCESS_DENIED', msg);
}
function sessionMismatch(msg = 'Your session does not match this order') {
  return createError(403, 'SESSION_MISMATCH', msg);
}
function itemNotEditable(msg = 'This item can only be modified before kitchen preparation starts') {
  return createError(400, 'ITEM_NOT_EDITABLE', msg);
}
function orderItemsBeingPrepared(msg = 'Cannot cancel — some items are already being prepared') {
  return createError(400, 'ORDER_ITEMS_BEING_PREPARED', msg);
}
function invalidDishStatus(valid) {
  return createError(400, 'INVALID_DISH_STATUS', `Status must be one of: ${valid.join(', ')}`);
}

module.exports = {
  createError,
  notFound, badRequest, forbidden, conflict,
  orderFinalized, orderPaidCannotCancel, orderNotPayable,
  orderAccessDenied, sessionMismatch,
  itemNotEditable, orderItemsBeingPrepared, invalidDishStatus,
};
