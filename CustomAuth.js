// Don't require or import parse-server in this module.
// See this issue: https://github.com/parse-community/parse-server/issues/6467
function validateAuthData(authData, options) {
  return Promise.resolve({})
}

function validateAppId(appIds, authData, options) {
  return Promise.resolve({});
}

module.exports = {
  validateAppId,
  validateAuthData,
};