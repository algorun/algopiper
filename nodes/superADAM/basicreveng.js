module.exports = function(RED) {
    "use strict";
    var fs = require("fs-extra");
    var os = require("os");
    
    function BascicrevengNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;
        var request = require('request');
        var ready = false;
        var basicreveng_server = "";
        
        config.algomanager = "http://localhost:8764";
        config.basicrevengimage = "ahosny/basicreveng";
        node.status({fill:"yellow", shape:"dot", text:"connecting .."});
        // check algomanager status
        request(config.algomanager + '/api/v1/status', function (error, response, body) {
            if (!error && response.statusCode == 200) {
                node.status({fill:"yellow", shape:"dot", text:"initializing .."});
                
                // now algomanager is running. deploy basicreveng
                request.post(config.algomanager + '/api/v1/deploy',
                       { form: { image: config.basicrevengimage, node_id: node.id } },
                       function (error, response, body) {
                            if (!error && response.statusCode == 200) {
                                var deploy_result = JSON.parse(body);
                                if(deploy_result["status"] === "success") {
                                    node.status({fill:"green",shape:"dot",text:"ready .."});
                                    ready = true;
                                    basicreveng_server = deploy_result["endpoint"];
                                } else {
                                    node.status({fill:"red",shape:"dot",text:body});
                                    ready = false;
                                    node.status({fill:"red",shape:"dot",text:deploy_result["error_message"]});
                                }
                            } else {
                                node.status({fill:"red",shape:"dot",text:error});
                            }
                });
            } else {
                node.status({fill:"red", shape:"dot", text:"cannot connect to algomanager"});
            }
        });
        
        
        this.on('input', function(msg) {
            if(!ready) {
                msg.payload = 'node ' + this.id + ' is not ready';
                node.send(msg);
                node.status({fill:"red", shape:"dot", text:"hit deploy again!"});
                return;
            }
            var filename = 'workflow-log/' + this.id + '.json';
            var input_data = '';
            try{
                var json = JSON.parse(msg.payload);
                input_data = msg.payload.trim();
            }catch(e) {
                msg.payload = e.message;
                node.send(msg);
                node.status({fill:"red",shape:"dot",text:"error parsing input.."});
                return;
            }
            this.status({fill:"blue",shape:"ring",text:"computing .."});
            request.post(
                basicreveng_server + '/do/run',
                { form: { input: input_data } },
                function (error, response, body) {
                    if (!error && response.statusCode == 200) {
                        msg.payload = body;
                        
                        if(config.log !== "No"){
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
                                sendDebug({id:node.id,name:"BasicRevEng LOG",topic:"computation result",msg:file_path,_path:msg._path});
                            });
                        }
                        node.send(msg);
                        node.status({fill:"blue",shape:"dot",text:"done .."});
                    } else {
                        msg.payload = error;
                        node.send(msg);
                        node.status({fill:"red",shape:"dot",text:error});
                    }
                }
            );
        });
    }
    RED.nodes.registerType('BasicRevEng', BascicrevengNode);
    
    function sendDebug(msg) {
        RED.comms.publish("OUTPUT",msg);
    }
}