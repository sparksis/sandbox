(function(global) {
  var wrappedRequest = {}
  sandboxValidator(wrappedRequest, nashornUtils)

  var wrapCallback = function (callback) {
    return function (callbackRequest, callbackResponse, nextCallback) {
      _.each(callbackRequest._getAccessibleProperties(), function (property) {
        if (typeof callbackRequest[property] == 'function') {
          wrappedRequest[property] = function () {
            return callbackRequest[property](Array.prototype.slice.call(arguments))
          }
        } else {
          wrappedRequest[property] = callbackRequest[property]
          //clear validation errors for each request
          wrappedRequest._validationErrors = undefined
        }
      })
      return callback(wrappedRequest, callbackResponse, nextCallback)
    }
  }

  //map to maintain each unique route's chainCallback function, which wraps the define() callback and maintains an order callback list.
  var chainCallbacks = {}

  //function to wrap the define() callback that we return to nashorn, this function will maintain the list of define() function and construct next()
  var chainCallback = function (callback, key, order) {
    var existingChainCallback = chainCallbacks[key];

    //if this is the first time we've seen this route, create its chainCallback, add to map.
    if(existingChainCallback == undefined){
      //create new chainCallback, add first to chain
      var chainCallback = function(callbackRequest, callbackResponse, chainPosition){
        chainPosition = chainPosition || 0;
        var nextCallback = function() {
          chainCallback(callbackRequest, callbackResponse, chainPosition+1)
        }

        //execute the callback given by the chainPosition, only called first function calling next()
        var callbackToExecute;
        if(chainCallback.callbacks[chainPosition]){
          callbackToExecute = chainCallback.callbacks[chainPosition];
        }else if(!chainCallback.callbacks[chainPosition] && chainCallback.defaultCallback){
          callbackToExecute = chainCallback.defaultCallback;
        }

        //execute selected callback, pass req, res and next
        callbackToExecute(callbackRequest, callbackResponse, nextCallback);
      }
      //add the first callback to the array for the function to iterate.
      chainCallback.callbacks = [callback];
      chainCallbacks[key] = chainCallback;
      return chainCallback;

    //if this is the 2nd+ time we've seen this route, add to the chain. Depending on the 'order' arg we might overwrite, insert or append.
    }else {
      //add new callback to chain depending on order, return existing wrappedCallback
      if(order == undefined){
        //if order is undefined then set as the default callback, special case
          existingChainCallback.defaultCallback = callback;
      }else if(order == -1){
        //-1 so add to the end
        existingChainCallback.callbacks.push(callback);
      }else{
        //if given an order add it in that position
        existingChainCallback.callbacks.splice(order, 0, callback);
      }
      return existingChainCallback;
    }
  }

  //<path> <method> <properties {}> <callback>
  //<path> <properties {}> <callback>
  //<path> <method> <callback>
  //<path> <callback>
  var httpFunction = function(order) {
     return function(){
       var callback;
       var path;
       var method;
       var properties;

       if(arguments.length == 4){
         path = arguments[0];
         method = arguments[1];
         properties = arguments[2];
         callback = arguments[3];

       } else if(arguments.length == 3){
         if(typeof arguments[1] == 'object'){
           path = arguments[0];
           method = 'GET'
           properties = arguments[1];
           callback = arguments[2];
         }else if(typeof arguments[1] == 'string'){
           path = arguments[0];
           method = arguments[1];
           properties = {};
           callback = arguments[2];
         }else{
           throw new Error("Invalid route definition for " + method.toUpperCase() + " " + path + ", 2nd parameter should be a String or an Object")
         }

       } else{
         path = arguments[0];
         method = 'GET';
         properties = {};
         callback = arguments[1];
       }

       if(callback == undefined){
         throw new Error("Invalid route definition for " + method.toUpperCase() + " " + path + ", given function is undefined")
       }

       var finalCallback = chainCallback(wrapCallback(callback), method + "," + path, order);
       __mock.define('http', 'define', path, method, properties, callback, finalCallback, new Error())
    }
  }

  //<path> <action> <callback>
  //<path> <action> <operationName> <callback>
  var soapFunction = function(){
     var method = "POST";
     var path = arguments[0];
     var action = arguments[1];
     if(arguments.length == 3 && typeof arguments[1] == 'string'){
       var finalCallback = chainCallback(wrapCallback(arguments[2]), method + "," + path + "," + action, 0);
       __mock.define('http', 'soap', path, method, {'SOAPAction': action}, arguments[2], finalCallback, new Error())

     } else if(arguments.length == 4 && typeof  action == 'string'){
       var finalCallback = chainCallback(wrapCallback(arguments[3]), method + "," + path + "," + action+ "," + arguments[2], 0);
       __mock.define('http', 'soap', path, method, {'SOAPAction': action, 'SOAPOperationName':arguments[2]}, arguments[3], finalCallback, new Error())

     }else{
       throw new Error("Invalid route definition for " + method.toUpperCase() + " " + path + ", must have 3 parameters (path, action, function)")
     }

  }

  //[<server{}>,]<queue>,<callback>
  var jmsFunction = function(){
    if(arguments.length == 3 && typeof arguments[0] == 'object'){
      var finalCallback = chainCallback(wrapCallback(arguments[2]), JSON.stringify(arguments[0]) + "," + arguments[1], 0)
      __mock.define('jms', 'jms', arguments[1], 'LISTEN', arguments[0], arguments[2], finalCallback, new Error())

    }else if(arguments.length == 2 && typeof arguments[0] == 'string' && typeof arguments[1] == 'function'){
      var finalCallback = chainCallback(wrapCallback(arguments[1]), arguments[0], 0)
      __mock.define('jms', 'jms', arguments[0], 'LISTEN', {}, arguments[1], finalCallback, new Error())

    }else{
        throw new Error("Invalid JMS route definition, must have 2 or 3 parameters ([connection,] queue, function)")
    }
  }

  var mock = {
    define: httpFunction(0),
    default: httpFunction(), //set the order to undefined, so default calls get added to end of the chain
    soap: soapFunction,
    jms: jmsFunction
  }

  global.Sandbox = mock
  global.Sandmox = mock
  global.mock = mock

  function Console(stdout, stderr) {
    if (!(this instanceof Console)) {
      return new Console(stdout, stderr);
    }

    if (!stdout || typeof stdout.write !== 'function') {
      throw new TypeError('Console expects a writable stream instance');
    }

    if (!stderr) {
      stderr = stdout;
    }
    var prop = {
      writable: true,
      enumerable: false,
      configurable: true
    };
    prop.value = stdout;
    Object.defineProperty(this, '_stdout', prop);
    prop.value = stderr;
    Object.defineProperty(this, '_stderr', prop);
    prop.value = {};
    Object.defineProperty(this, '_times', prop);

    // bind the prototype functions to this Console instance
    Object.keys(Console.prototype).forEach(function(k) {
      this[k] = this[k].bind(this);
    }, this);
  }

  Console.prototype.log = function() {
    this._stdout.write(_format.apply(this, arguments) + '\n');
  };

  Console.prototype.info = Console.prototype.log;

  Console.prototype.warn = function() {
    this._stderr.write(_format.apply(this, arguments) + '\n');
  };

  Console.prototype.error = Console.prototype.warn;

  // export console
  global.console = new Console(_console, _console)
  global.print = global.console.log

  function _format(f) {
    var formatRegExp = /%[sdj%]/g;
    if (typeof f !== 'string') {
      var objects = [];
      for (var i = 0; i < arguments.length; i++) {
//        objects.push(inspect(arguments[i]));
          objects.push(JSON.stringify(arguments[i]));
      }
      return objects.join(' ');
    }

    var i = 1;
    var args = arguments;
    var len = args.length;
    var str = String(f).replace(formatRegExp, function(x) {
      if (x === '%%') return '%';
      if (i >= len) return x;
      switch (x) {
        case '%s': return String(args[i++]);
        case '%d': return Number(args[i++]);
        case '%j': return JSON.stringify(args[i++]);
        default:
          return x;
      }
    });
    for (var x = args[i]; i < len; x = args[++i]) {
      if (x === null || typeof x !== 'object') {
        str += ' ' + x;
      } else {
        // TODO: add support for inspecting objects
//        str += ' ' + inspect(x);
        str += JSON.stringify(x)
      }
    }
    return str;
  };

})(this)

this.global = this;

module = (typeof module == 'undefined') ? {} :  module;

(function() {

  // keep a ref to load local to the closure
  var __g_load = load;

  // then disable it for everyone else.
  load = undefined;
  loadWithNewGlobal = undefined;
  quit = undefined;
  exit = undefined;

  function Module(id, parent) {
    this.id = id;
    this.parent = parent;
    this.children = [];
    this.filename = id;
    this.loaded = false;
    var self = this;

    Object.defineProperty( this, 'exports', {
      get: function() {
        return this._exports;
      }.bind(this),
      set: function(val) {
        Require.cache[this.filename] = val;
        this._exports = val;
      }.bind(this)
    } );
    this.exports = {};

    if (self.parent && self.parent.children) {
      self.parent.children.push(self);
    }

    self.require = function(id) {
      return Require(id, self);
    };
  }

  Module._load = function(module) {
    if (module.loaded) return;
        var body   = readFile(module.filename),
            funcBody = '(function (exports, require, module, __filename, __dirname) { ' + body + '\n});'

        var func = __g_load({ script: funcBody, name: module.filename })

        func.apply(module, [module.exports, module.require, module, module.filename, module.filename]);

        module.loaded = true;
  };

  function Require(id, parent) {
    var file = Require.resolve(id, parent);

    if (!file) {
      throw new Error("Cannot find module: " + id)
    }

    if (Require.cache[file]) {
      return Require.cache[file];
    } else if(file.endsWith(".json")){
      return JSON.parse(readFile(file));
    } else {
      return loadModule(file, parent);
    }
  }

  Require.resolve = function(id, parent) {
    var rootPath = findRoot(parent);
    var result = resolveAsFile(id, rootPath)
    if (result) {
      return result;
    }
    return false;
  };

  Require.root = "/";

  function findRoot(parent) {
    if (!parent || !parent.id) {
        return Require.root;
    }
    var pathParts = parent.id.split('/');
    pathParts.pop();
    return pathParts.join('/');
  }

  Require.debug = false;
  Require.cache = {};
  Require.extensions = {};
  require = Require;

  module.exports = Module;

  function loadModule(file, parent) {
    var module = new Module(file, parent);
    Module._load(module);
    return module.exports;
  }

  function resolveAsFile(id, root) {

    var filePath
      , pathParts
      , canonicalFilePath

    filePath = root + '/' + id;
    pathParts = [];

    _.each(filePath.split('/'), function(part) {
        if (part.startsWith('..')) {
            if (!pathParts.length) {
                // break out, can't go back past root path
                return false;
            }
            pathParts.pop();
        } else if (!part.startsWith('.') && part.length){
            pathParts.push(part)
        }
    })

    canonicalFilePath = pathParts.join('/')
    canonicalFilePath = normalizeName(canonicalFilePath)

    if(nashornUtils.hasFile(canonicalFilePath)) {
        return canonicalFilePath;
    } else {
        return false;
    }
  }

  function normalizeName(fileName) {
    if (fileName.endsWith('.js') || fileName.endsWith('.json')) {
      return fileName;
    }else{
      return fileName + '.js';
    }
  }

  function readFile(filename) {
    var fileContents = nashornUtils.readFile(filename)

    if (fileContents == null) {
        throw new Error("Cannot get file: " + filename);
    }
    return fileContents;
  }

  // Helper function until ECMAScript 6 is complete
  if (typeof String.prototype.endsWith !== 'function') {
    String.prototype.endsWith = function(suffix) {
      if (!suffix) return false;
      return this.indexOf(suffix, this.length - suffix.length) !== -1;
    };
  }

  if (typeof String.prototype.startsWith != 'function') {
    String.prototype.startsWith = function (str){
      return this.slice(0, str.length) == str;
    };
  }

}());
