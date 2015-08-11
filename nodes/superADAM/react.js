module.exports = function(RED) {
    "use strict";
    var fs = require("fs-extra");
    var os = require("os");
    
    function ReactNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;
        node.status({fill:"green",shape:"dot",text:"ready .."});
        var request = require('request');
        this.on('input', function(msg) {
            var filename = 'workflow-log/react_output.json';
            var input_data = '';
            try{
                var json = JSON.parse(msg.payload);
                input_data = msg.payload;
            }catch(e) {
                msg.payload = e.message;
                node.send(msg);
                node.status({fill:"red",shape:"dot",text:"error .."});
                return;
            }
            this.status({fill:"blue",shape:"ring",text:"computing .."});
            request.post(
                'http://react.algorun.org/do/run',
                { form: { input: input_data } },
                function (error, response, body) {
                    if (!error && response.statusCode == 200) {
                        msg.payload = body;
                        
                        if(config.log === "Yes"){
                            // write data to a file
                            fs.writeFile(filename, body, "binary", function (err) {
                                if (err) {
                                    if ((err.code === "ENOENT")) {
                                        fs.ensureFile(filename, function (err) {
                                            if (err) { node.error(RED._("file.errors.createfail",{error:err.toString()}),msg); }
                                            else {
                                                fs.writeFile(filename, body, "binary", function (err) {
                                                    if (err) { node.error(RED._("file.errors.writefail",{error:err.toString()}),msg); }
                                                });
                                            }
                                        });
                                    }
                                    else { node.error(RED._("file.errors.writefail",{error:err.toString()}),msg); }
                                }
                                else if (RED.settings.verbose) { node.log(RED._("file.status.wrotefile",{file:filename})); }
                            });
                            
                            require('dns').lookup(require('os').hostname(), function (err, add, fam) {
                                var file_path = 'http://' + add + ':1880/' + filename;
                                sendDebug({id:node.id,name:"REACT LOG",topic:"computation result",msg:file_path,_path:msg._path});
                            });
                        }
                        node.send(msg);
                        node.status({fill:"blue",shape:"dot",text:"done .."});
                    } else {
                        msg.payload = error;
                        node.send(msg);
                        node.status({fill:"red",shape:"dot",text:"error .."});
                    }
                }
            );
        });
    }
    RED.nodes.registerType('REACT',ReactNode);
    
    function sendDebug(msg) {
        RED.comms.publish("OUTPUT",msg);
    }
}