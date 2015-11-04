'use strict';

function Socket(conn, extractor) {
  if (!(this instanceof Socket)) {
    return new Socket(conn, extractor);
  }

	this.conn = conn;
	this.replyHandlers = [];
	this.eventHandlers = [];
	this.extractor = extractor
	var self = this;
	conn.onmessage = function (event) {
	    try {
	    var json = JSON.parse(event.data);
	    }
	    catch(SyntaxError) {
		console.alert("Syntax error in received data");
		return;
	    }

	    if (json.data == undefined) {
		console.log("No data field in received data");
		return;
	    }

	    if (typeof json['id'] == 'string') {
		var id = json['id'];

		var callback = self.replyHandlers[id]
		callback(json.data)

		var index = self.replyHandlers.indexOf(id);
		if (index > -1) {
		    self.replyHandlers.splice(index, 1);
		}

	    } else {

		var callback = self.eventHandlers[self.extractor(json.data)];
		if (callback != undefined) {
		    callback(JSON.parse(json.data.data));
		}
	    }
	};

	this.On = function (e, callback) {
	    this.eventHandlers[e] = callback;
	}

	this.Emit = function (data, callback) {
	    var id = asmCrypto.SHA1.hex(""+(Date.now() ^ Math.random()*1000))
	    var json = {id: id, data: data};
	    this.replyHandlers[id] = callback;
	    this.conn.send(JSON.stringify(json));
	}
}
