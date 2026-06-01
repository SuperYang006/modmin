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

function resolveFriendlyErrorMessage(message) {
  if (/Table not exist|Db or Table not exist|COLLECTION_NOT_EXIST|ResourceNotFound/i.test(message)) {
    return '数据集合不存在，请先在 CloudBase 控制台创建对应集合'
  }
  return message
}

module.exports = {
  success,
  fail,
  resolveFriendlyErrorMessage,
}
