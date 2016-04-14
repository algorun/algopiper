module.exports = function(RED) {
    "use strict";
    var fs = require("fs-extra");
    var os = require("os");
    var request = require('request');
    var settings = require('../../settings.js');
    var algomanager;
    // Configure AlgoManager
    request('http://localhost:8765/algomanager', function (error, response, body) {
        if (!error && response.statusCode == 200) {
            algomanager = JSON.parse(body).algomanager;
        }
    });
    function sendDebug(msg) {
        RED.comms.publish("output", msg);
    }
    
    function ModuleNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var docker_image = config.docker_image;
        var docker_server = "";
        var log_file = 'pipeline-log/' + node.id + '.json';
        var module_msg;
        
        node.status({fill:"green", shape:"dot", text:"ready"});        
        
        this.on('input', function(msg) {
            module_msg = msg;
            var input_data = msg.payload;
            
            node.status({fill:"yellow",shape:"ring",text:"initializing.."});
            
            
            // get endpoint from algomanager
            request.post(algomanager + '/api/v1/deploy', {form: {'docker_image': docker_image, node_id: node.id}}, 
                         function(error, response, body){        
                            if (!error && response.statusCode == 200) {
                                var deploy_result = JSON.parse(body);
                                if(deploy_result['status'] === 'success'){
                                    var module_server = deploy_result['endpoint'];
                                    
                                    // run computation
                                    setTimeout(algo_run, 500, module_server, input_data);
                                    // algo_run(module_server, input_data);
                                } else {
                                    console.error(deploy_result['error_message']);
                                    node.status({fill:"red",shape:"dot",text:'docker container deployment error!'});    
                                }
                            } else {
                                console.error(error);
                                console.error(response);
                                console.error(body);
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
                        
                        // write data to a file
                        fs.writeFile(log_file, body, "binary", function (err) {
                            if (err) {
                                if ((err.code === "ENOENT")) {
                                    fs.ensureFile(log_file, function (err) {
                                        if (err) { node.error(RED._("file.errors.createfail",{error:err.toString()}),module_msg); }
                                        else {
                                            fs.writeFile(log_file, body, "binary", function (err) {
                                                if (err) { node.error(RED._("file.errors.writefail",{error:err.toString()}),module_msg); }
                                            });
                                        }
                                    });
                                }
                                else { node.error(RED._("file.errors.writefail",{error:err.toString()}),module_msg); }
                            }
                            else if (RED.settings.verbose) { node.log(RED._("file.status.wrotefile",{file:log_file})); }
                        });
                            
                        var file_path = "/" + log_file;
                        sendDebug({id:node.id,name:"algorun log",topic:"computation result", msg:file_path, _path:module_msg._path});
                        
                        node.send(module_msg);
                        node.status({fill:"green",shape:"dot",text:"ready .."});
                        
                        } else {
                            module_msg.payload = error;
                            node.send(module_msg);
                            node.status({fill:"red",shape:"dot",text:"please, run again!"});
                        }
                    });
        }
    }
    RED.nodes.registerType('AlgoRun', ModuleNode);
}