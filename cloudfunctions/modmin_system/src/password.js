const crypto = require('crypto')

function hashPassword(password, salt) {
  return crypto.createHash('sha256').update(password + salt).digest('hex')
}

function generateSalt() {
  return crypto.randomBytes(16).toString('hex')
}

module.exports = {
  hashPassword,
  generateSalt,
}
