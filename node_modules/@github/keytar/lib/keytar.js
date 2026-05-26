function loadNativeAddonFromPath(path) {
  try {
    return require(path + '/keytar.node')
  } catch {
    // Ignore errors loading addon in order to attempt more locations
  }
  return undefined
}

function loadNativeAddon() {
  var prebuildDir = 'prebuilds/' + process.platform + '-' + process.arch;
  var paths = ['../build/Release', '../' + prebuildDir, './' + prebuildDir];
  for (var path of paths) {
    var keytar = loadNativeAddonFromPath(path);
    if (keytar) return keytar;
  }
  throw new Error("Failed to load keytar native addon, checked " + JSON.stringify(paths) + " on " + prebuildDir);
}

var keytar = loadNativeAddon();

function checkRequired(val, name) {
  if (!val || val.length <= 0) {
    throw new Error(name + ' is required.');
  }
}

module.exports = {
  getPassword: function (service, account) {
    checkRequired(service, 'Service')
    checkRequired(account, 'Account')

    return keytar.getPassword(service, account)
  },

  setPassword: function (service, account, password) {
    checkRequired(service, 'Service')
    checkRequired(account, 'Account')
    checkRequired(password, 'Password')

    return keytar.setPassword(service, account, password)
  },

  deletePassword: function (service, account) {
    checkRequired(service, 'Service')
    checkRequired(account, 'Account')

    return keytar.deletePassword(service, account)
  },

  findPassword: function (service) {
    checkRequired(service, 'Service')

    return keytar.findPassword(service)
  },

  findCredentials: function (service) {
    checkRequired(service, 'Service')

    return keytar.findCredentials(service)
  }
}
