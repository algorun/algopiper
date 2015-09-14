module.exports = function(RED) {
    "use strict";
    var fs = require("fs-extra");
    var os = require("os");
    var request = require('request');
    var sleep = require('sleep');
    var settings = require('./algomanager_settings.js');
    
    function sendDebug(msg) {
        RED.comms.publish("OUTPUT", msg);
    }
    
    function ModuleNode(config) {
        var algomanager = settings.algomanager;
        var log_file_path = settings.log_file_path;
        RED.nodes.createNode(this, config);
        var node = this;
        var docker_image = config.docker_image;
        var docker_server = "";
        var log = config.log;
        var filename = 'workflow-log/' + node.id + '.json';;
        var module_msg;
        
        node.status({fill:"green", shape:"dot", text:"ready"});        
        
        this.on('input', function(msg) {
            module_msg = msg;
            var input_data = '';
            try{
                var json = JSON.parse(msg.payload);
                input_data = msg.payload.trim();
            }catch(e) {
                msg.payload = e.message;
                node.send(msg);
                node.status({fill:"red",shape:"dot",text:"error parsing input!"});
                return;
            }
            node.status({fill:"yellow",shape:"ring",text:"initializing.."});
            // get endpoint from algomanager
            request.post(algomanager + '/api/v1/deploy', 
                         { form: { image: docker_image, node_id: node.id } },
                        function(error, response, body){        
                            if (!error && response.statusCode == 200) {
                                var deploy_result = JSON.parse(body);
                                if(deploy_result['status'] === 'success'){
                                    var module_server = deploy_result['endpoint'];
                                    // run computation
                                    algo_run(module_server, input_data);
                                } else {
                                    console.error(deploy_result['error_message']);
                                    node.status({fill:"red",shape:"dot",text:'docker deploy error!'});    
                                }
                            } else {
                                console.error(error);
                                node.status({fill:"red",shape:"dot",text:'algomanager server error!'});
                            }
                        });
        });
        function algo_run(module_server, input_data){
            node.status({fill:"blue",shape:"ring",text:"computing.."});
            request.post(
                module_server + '/v1/run',
                { form: { input: input_data } },
                function (error, response, body) {
                    if (!error && response.statusCode == 200) {
                        module_msg.payload = body;
                        
                        if(log !== "No"){
                            // write data to a file
                            fs.writeFile(filename, body, "binary", function (err) {
                                if (err) {
                                    if ((err.code === "ENOENT")) {
                                        fs.ensureFile(filename, function (err) {
                                            if (err) { node.error(RED._("file.errors.createfail",{error:err.toString()}),module_msg); }
                                            else {
                                                fs.writeFile(filename, body, "binary", function (err) {
                                                    if (err) { node.error(RED._("file.errors.writefail",{error:err.toString()}),module_msg); }
                                                });
                                            }
                                        });
                                    }
                                    else { node.error(RED._("file.errors.writefail",{error:err.toString()}),module_msg); }
                                }
                                else if (RED.settings.verbose) { node.log(RED._("file.status.wrotefile",{file:filename})); }
                            });
                            
                            require('dns').lookup(require('os').hostname(), function (err, add, fam) {
                                var file_path = log_file_path + '/' + filename;
                                sendDebug({id:node.id,name:"Custom LOG",topic:"computation result",msg:file_path,_path:module_msg._path});
                            });
                        }
                        node.send(module_msg);
                        node.status({fill:"green",shape:"dot",text:"ready .."});
                        } else {
                            module_msg.payload = error;
                            node.send(module_msg);
                            node.status({fill:"red",shape:"dot",text:JSON.stringify(error)});
                        }
                    });
        }
    }
    RED.nodes.registerType('Custom', ModuleNode);
}