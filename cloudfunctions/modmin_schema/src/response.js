function getRequestMeta(event) {
  return {
    requestId: event?.meta?.requestId,
    serverTime: Date.now(),
  }
}

function success(event, data) {
  return {
    code: 0,
    message: 'ok',
    data,
    ...getRequestMeta(event),
  }
}

function fail(event, code, message, data = null) {
  return {
    code,
    message,
    data,
    ...getRequestMeta(event),
  }
}

module.exports = {
  success,
  fail,
}
