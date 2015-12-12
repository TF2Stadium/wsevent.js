(function (window) {
  'use strict';

  var genUniqueId = (function () {
    var counter = 1;
    return function () {
      return counter++;
    };
  })();

  function noop() {}

  // Extend WebSocket to automatically reconnect
  function ReconnectingWebSocket(url, opts) {
    if (!(this instanceof ReconnectingWebSocket)) {
      throw new TypeError('Cannot call a constructor as a function');
    }

    opts = opts || {};

    var self = this;
    var timeout = opts.timeout || 100;
    var maxRetries = opts.maxRetries || 5;
    var curRetries = 0;

    // External event callbacks
    self.onmessage = noop;
    self.onopen = noop;
    self.onclose = noop;

    function unreliableOnOpen(e) {
      self.onopen(e);
      curRetries = 0;
    }

    function unreliableOnClose(e) {
      self.onclose();

      if (curRetries < maxRetries) {
        ++curRetries;
        setTimeout(connect, timeout);
      }
    }

    function unreliableOnMessage(e) {
      self.onmessage(e);
    }

    function connect() {
      // Constructing a WebSocket() with opts.protocols === undefined
      // does NOT behave the same as calling it with only one argument
      // (specifically, it throws security errors).
      if (opts.protocols) {
        self.ws = new WebSocket(url, opts.protocols);
      } else {
        self.ws = new WebSocket(url);
      }

      // onerror isn't necessary: it is always accompanied by onclose
      self.ws.onopen = unreliableOnOpen;
      self.ws.onclose = unreliableOnClose;
      self.ws.onmessage = unreliableOnMessage;
    }

    connect();
  }

  ReconnectingWebSocket.prototype.send = function send(data) {
    this.ws.send(data);
  };


  function Socket(url, opts) {
    if (!(this instanceof Socket)) {
      throw new TypeError('Cannot call a constructor as a function');
    }

    if (typeof url === 'string') {
      this.url = url;
    } else {
      throw new TypeError('Socket: first arg must be a string');
    }

    if (typeof opts !== 'object' || typeof opts.extractor !== 'function') {
      throw new TypeError('Socket: opts must supply an extractor');
    }

    opts = opts || {};
    var extractor = opts.extractor;

    var self = this;

    // External event callbacks
    this.onopen = noop;
    this.onclose = noop;
    this.onmessage = noop;

    this.conn = new ReconnectingWebSocket(url);
    this.conn.onopen = function () {
      self.onopen();
    };
    this.conn.onclose = function () {
      self.onclose();
    };

    this.replyHandlers = Object.create(null);
    this.eventHandlers = Object.create(null);

    this.conn.onmessage = function (e) {
      var json, callback;

      try {
        json = JSON.parse(e.data);
      }
      catch(SyntaxError) {
        console.log('Syntax error in received data');
        return;
      }

      if (json.data === undefined) {
        console.log('No data field in received data');
        return;
      }

      var id = parseInt(json.id, 10);
      if (id > -1) {
        // Handle response messages
        id = json.id;
        callback = self.replyHandlers[id];

        if (callback) {
          callback((json.data));
          delete self.replyHandlers[id];
        }
      } else {
        var name = extractor(json.data);

        // Note: messages from the server are an extra layer deep
        // (so .data.data instead of the single .data of responses)
        var data = (json.data.data);
        self.onmessage(name, data);

        callback = self.eventHandlers[name];
        if (callback !== undefined) {
          callback(data);
        }
      }
    };
  }

  Socket.prototype.On = function On(e, callback) {
    this.eventHandlers[e] = callback;
  };

  Socket.prototype.Emit = function Emit(data, callback) {
    var id = genUniqueId();
    var msg = {
      id: ""+id,
      data: data
    };

    this.replyHandlers[id] = callback;
    this.conn.send(JSON.stringify(msg));
  };

  window.Socket = Socket;
})(this);
