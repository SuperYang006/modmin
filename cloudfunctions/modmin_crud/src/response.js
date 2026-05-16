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

function resolveFriendlyErrorMessage(message) {
  if (/Table not exist|Db or Table not exist|COLLECTION_NOT_EXIST/i.test(message)) {
    return '数据集合不存在，请先在 CloudBase 控制台创建对应集合'
  }
  if (/Cannot create field .+ in element \{.+: ""\}/i.test(message) || /multiple write errors/i.test(message)) {
    return '保存失败：字段类型与数据库已有记录冲突，请检查资源字段（图片/文件）的数据是否合法'
  }
  return message
}

module.exports = {
  success,
  fail,
  resolveFriendlyErrorMessage,
}
