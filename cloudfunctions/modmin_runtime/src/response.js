function success(event, data) {
  return {
    code: 0,
    message: 'ok',
    data,
    requestId: event?.meta?.requestId,
    serverTime: Date.now(),
  }
}

function fail(event, code, message, data = null) {
  return {
    code,
    message,
    data,
    requestId: event?.meta?.requestId,
    serverTime: Date.now(),
  }
}

module.exports = {
  success,
  fail,
}
