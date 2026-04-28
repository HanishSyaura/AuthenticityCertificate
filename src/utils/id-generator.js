const crypto = require('crypto');

function generateCertificateId() {
  const randomBytes = crypto.randomBytes(5).toString('hex').toUpperCase();
  return `BN-${randomBytes}`;
}

module.exports = {
  generateCertificateId
};
