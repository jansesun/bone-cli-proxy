/*jslint node: true*/

var module;
(function () {
  'use strict';
  var http = require('http'),

    scriptBase = __dirname + '/..',

    noop = function () {},

    log = noop,

    macFiddler;

  function extend(r, s, override) {
    var i;

    override = override === true ? true : false;

    for (i in s) {
      if (s.hasOwnProperty(i) && (override || r[i] === undefined)) {
        r[i] = s[i];
      }
    }
  }

  macFiddler = {
    availableMods : [ 'logs', 'hosts', 'localReplace', 'allowIp', 'proxyRequest', 'pac',
                      'delayResponse' ],

    mods : {},

    conf : {},

    noop : noop,

    extend : extend,

    log : function (msg) {
      log(msg);
    },

    loadModule : function (name) {
      var mod;

      mod = this.mods[name];

      if (!mod && this.availableMods.indexOf(name) > -1) {
        mod = require(scriptBase + '/lib/modules/' + name + '.js')[name];

        if (mod) {
          this.mods[name] = mod;
        }
      }

      return mod;
    },

    use : function (modName, conf) {
      var mod = this.loadModule(modName);
      if (mod) {
        mod.conf = conf || {};
      }
    },

    set : function (conf) {
      extend(this.conf, conf, true);
    },

    initMods : function () {
      var usedMods = this.mods, modName, mod, conf = this.conf;

      if (!usedMods.localReplace) {
        this.use('localReplace', {
          enable : conf.enableReplace,
          replaceBase : conf.replaceBase,
          replaceRules : conf.replaceRules,
          autoBuild : conf.autoBuild
        });
      }

      if (!usedMods.pac) {
        this.use('pac', {
          pac : conf.pac,
          ip : conf.ip,
          port : conf.port,
          pacEncoding : conf.pacEncoding,
          proxyRules : conf.proxyRules,
          pacFilter : conf.pacFilter,
          replaceRules: conf.replaceRules
        });
      }

      if (!usedMods.allowIp) {
        this.use('allowIp', {
          ips : conf.allowIps
        });
      }

      if (!usedMods.logs && conf.enableLog) {
        this.use('logs', {
          maxSize : conf.maxLogSize,
          visitLog: conf.visitLog,
          responseLog: conf.responseLog,
          enableResponseLog : conf.enableResponseLog
        });
      }

      if (!usedMods.hosts && conf.hostsFile) {
        this.use('hosts', {
          hostsFile : conf.hostsFile,
        });
      }

      if (!usedMods.proxyRequest && conf.enableProxyRequest) {
        this.use('proxyRequest');
      }

      if (!usedMods.delayResponse) {
        this.use('delayResponse', {
          delay : conf.delay,
          filter : conf.delayFilter
        });
      }

      for (modName in usedMods) {
        if (usedMods.hasOwnProperty(modName)) {
          mod = usedMods[modName];
          extend(mod.conf, mod.defaultConf);
          mod.init(this);
        }
      }
    },

    defaultConf : require('../default.conf.js'),

    init : function (conf) {
      var that = this, usedMods;

      extend(this.conf, this.defaultConf);
      extend(this.conf, conf, true);

      this.initMods();

      usedMods = this.mods;

      if (usedMods.logs) {
        log = usedMods.logs.log.bind(usedMods.logs);
      }

      http.globalAgent.maxSockets = Infinity;

      http.createServer(function (request, response) {
        if (usedMods.allowIp && !usedMods.allowIp(request)) {
          console.log("Error: IP " + request.connection.remoteAddress + " is not allowed");
          response.end();
          return;
        }

        usedMods.localReplace(request, response, that).then(function (msg) {
          log(msg);
        }, function (err) {
          if (err.message) {
            log(err.message);
          }
          if (usedMods.proxyRequest) {
            usedMods.proxyRequest(request, response, that);
          }
        });

      }).listen(this.conf.port);

      console.log('Started http proxy server on http://0.0.0.0:'+this.conf.port);
    }
  };

  module.exports = macFiddler;
}());
