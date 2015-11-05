(function (window) {
  'use strict';

  var genUniqueId = (function () {
    var counter = 1;
    return function () {
      return counter++;
    };
  })();

  function Socket(conn, extractor) {
    if (!(this instanceof Socket)) {
      throw new TypeError('Cannot call a class as a function');
    }

    if (typeof conn === 'string') {
      this.conn = new WebSocket(conn);
    } else if (conn instanceof WebSocket) {
      this.conn = conn;
    } else {
      throw new TypeError('Socket: first arg must be a string or WebSocket');
    }

    this.replyHandlers = Object.create(null);
    this.eventHandlers = Object.create(null);

    this.extractor = extractor;

    var self = this;
    conn.onmessage = function (event) {
      var json, callback;

      try {
        json = JSON.parse(event.data);
      }
      catch(SyntaxError) {
        console.alert('Syntax error in received data');
        return;
      }

      if (json.data === undefined) {
        console.log('No data field in received data');
        return;
      }

      var id = json.id;
      if (id > -1) {
        // Handle response messages
        id = json.id;
        callback = self.replyHandlers[id];

        if (callback) {
          callback(JSON.parse(json.data));
          delete self.replyHandlers[id];
        }
      } else {
        callback = self.eventHandlers[self.extractor(json.data)];
        if (callback !== undefined) {
          // Note: messages from the server are an extra layer deep
          // (so .data.data instead of the single .data of responses)
          callback(JSON.parse(json.data.data));
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
      id: id,
      data: data
    };

    this.replyHandlers[id] = callback;
    this.conn.send(JSON.stringify(msg));
  };

  window.Socket = Socket;
})(this);
