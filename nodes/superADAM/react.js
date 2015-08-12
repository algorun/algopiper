module.exports = function(RED) {
    "use strict";
    var fs = require("fs-extra");
    var os = require("os");
    
    function ReactNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;
        var request = require('request');
        var api_server = 'http://localhost:8764';
        var react_image = 'algorun/react';
        var react_server = '';
        
        node.status({fill:"yellow", shape:"dot", text:"initializing .."});
        // call api to run a container
        request.post(
            api_server + '/run',
            { form: { image: 'algorun/react' } },
            function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    react_server = JSON.parse(body);
                    if (react_server['status'] === 'success') {
                        node.status({fill:"green", shape:"dot", text:"ready .."});
                    } else {
                        node.status({fill:"red", shape:"dot", text:"docker error .."});
                    }
                } else {
                    node.status({fill:"red", shape:"dot", text:"docker error .."});
                }
            }
        );
        this.on('input', function(msg) {
            var filename = 'workflow-log/react_output.json';
            var input_data = '';
            try{
                var json = JSON.parse(msg.payload);
                input_data = msg.payload.trim();
            }catch(e) {
                msg.payload = e.message;
                node.send(msg);
                node.status({fill:"red",shape:"dot",text:"error .."});
                return;
            }
            this.status({fill:"blue",shape:"ring",text:"computing .."});
            request.post(
                react_server['endpoint'] + '/do/run',
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
                        if(config.outputs > 1) {
                            var msgs = [];
                            for(var i = 0; i< config.outputs; i++) {
                                msgs.push(msg);
                            }
                            node.send(msgs);
                            node.status({fill:"blue",shape:"dot",text:"done .."});
                        } else {
                            node.send(msg);
                            node.status({fill:"blue",shape:"dot",text:"done .."});
                        }
                    } else {
                        msg.payload = error;
                        node.send(msg);
                        node.status({fill:"red",shape:"dot",text:"error .."});
                    }
                }
            );
        });
        this.on('close', function() {
            // call api to stop a container
            request.post(
                api_server + '/stop',
                { form: { container_id: react_server['container_id'] } },
                function (error, response, body) {
                    if (!error && response.statusCode == 200) {
                        var stop_result = JSON.parse(body);
                        if (stop_result['status'] === 'success') {
                            console.log("REACT Container " + react_server['container_id'] + " stopped successfully ..");
                        } else {
                            console.error("REACT Container " + react_server['container_id'] + " failed to stop ..");
                            console.error(stop_result["error_message"]);
                        }
                    } else {
                        console.error("REACT Container " + react_server['container_id'] + " failed to stop ..");
                        console.error(error);
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