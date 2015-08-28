module.exports = function(RED) {
    "use strict";
    var fs = require("fs-extra");
    var os = require("os");
    var request = require('request');
    var node;
    var algo_manager;
    var docker_image;
    var docker_server = "";
    var filename;
    var log_file_path;
    var module_msg;
    var log;
    
    function sendDebug(msg) {
        RED.comms.publish("OUTPUT", msg);
    }
    
    function deploy_container(input_data){
        // check algomanager status
        request(algo_manager + '/api/v1/status', function (error, response, body) {
            if (!error && response.statusCode == 200) {
                node.status({fill:"yellow", shape:"dot", text:"deploying .."});
                
                // now algomanager is running. deploy docker image
                request.post(algo_manager + '/api/v1/deploy',
                       { form: { image: docker_image, node_id: node.id } },
                       function (error, response, body) {
                            if (!error && response.statusCode == 200) {
                                var deploy_result = JSON.parse(body);
                                if(deploy_result["status"] === "success") {
                                    node.status({fill:"green",shape:"dot",text:"ready .."});
                                    docker_server = deploy_result["endpoint"];
                                    if(input_data && input_data !== ''){
                                        algo_run(input_data);
                                    }
                                } else {
                                    node.status({fill:"red",shape:"dot",text:body});
                                    node.status({fill:"red",shape:"dot",text:JSON.stringify(deploy_result["error_message"])});
                                }
                            } else {
                                console.error(error);
                                node.status({fill:"red",shape:"dot",text:'algomanager server error'});
                            }
                });
            } else {
                node.status({fill:"red", shape:"dot", text:"cannot connect to algomanager"});
            }
        });
        
    }
    function algo_run(input_data){
        node.status({fill:"blue",shape:"ring",text:"computing .."});
        request.post(
            docker_server + '/v1/run',
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
                            sendDebug({id:node.id,name:"SDDS LOG",topic:"computation result",msg:file_path,_path:module_msg._path});
                        });
                    }
                    node.send(module_msg);
                    node.status({fill:"blue",shape:"dot",text:"done .."});
                    } else {
                        module_msg.payload = error;
                        node.send(module_msg);
                        node.status({fill:"red",shape:"dot",text:error});
                    }
                });
    }
    
    function ModuleNode(config) {
        RED.nodes.createNode(this, config);
        node = this;
        algo_manager = config.algomanager;
        docker_image = config.docker_image;
        log_file_path = config.log_file_path;
        log = config.log;
        
        filename = 'workflow-log/' + node.id + '.json';
        
        node.status({fill:"yellow", shape:"dot", text:"connecting .."});
        deploy_container();
        
        
        this.on('input', function(msg) {
            module_msg = msg;
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
            request(docker_server + '/v1/status',
                       function(error, response, body){
                            if(!error && response.statusCode == 200) {
                                // backend node is running is running
                                algo_run(input_data);
                            } else {
                                // backend node needs to be deployed again
                                deploy_container(input_data);
                            }
            });
        });
    }
    RED.nodes.registerType('SDDS', ModuleNode);
}