function parseEvent(event) {
  if (!event || typeof event !== 'object') return {}
  if (typeof event.body === 'string' && event.body) {
    try {
      const parsed = JSON.parse(event.body)
      if (parsed && typeof parsed === 'object') {
        return {
          ...parsed,
          headers: event.headers || parsed.headers,
          context: event.context || parsed.context,
        }
      }
    } catch (error) {
      return { __parseError: error instanceof Error ? error.message : 'invalid json body' }
    }
  }
  return event
}

function ok(requestId, data) {
  return { code: 0, message: 'ok', data, requestId, serverTime: Date.now() }
}

function fail(requestId, code, message) {
  return { code, message, data: null, requestId, serverTime: Date.now() }
}

module.exports = {
  parseEvent,
  ok,
  fail,
}
