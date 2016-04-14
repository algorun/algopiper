/**
 * Copyright 2013 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function(RED) {
    "use strict";
    var util = require("util");
    var events = require("events");
    var debuglength = RED.settings.debugMaxLength||1000;
    var useColors = false;
    // util.inspect.styles.boolean = "red";

    function DebugNode(n) {
        RED.nodes.createNode(this,n);
        this.name = n.name;
        this.complete = (n.complete||"payload").toString();

        if (this.complete === "false") {
            this.complete = "payload";
        }

        this.console = n.console;
        this.active = (n.active === null || typeof n.active === "undefined") || n.active;
        var node = this;
        
        //context.global.foo = "hamada";

        this.on("input",function(msg) {
            if (this.active) {
                var computation_result = msg.payload;
                sendDebug({id:this.id,name:"output",topic:"computation result",msg:computation_result,_path:msg._path});
            }
        });
    }

    RED.nodes.registerType("output",DebugNode);

    function sendDebug(msg) {
        RED.comms.publish("output",msg);
    }

    DebugNode.logHandler = new events.EventEmitter();
    DebugNode.logHandler.on("log",function(msg) {
        if (msg.level === RED.log.WARN || msg.level === RED.log.ERROR) {
            sendDebug(msg);
        }
    });
    RED.log.addHandler(DebugNode.logHandler);

    RED.httpAdmin.post("/output/:id/:state", RED.auth.needsPermission("output.write"), function(req,res) {
        var node = RED.nodes.getNode(req.params.id);
        var state = req.params.state;
        if (node !== null && typeof node !== "undefined" ) {
            if (state === "enable") {
                node.active = true;
                res.send(200);
            } else if (state === "disable") {
                node.active = false;
                res.send(201);
            } else {
                res.send(404);
            }
        } else {
            res.send(404);
        }
    });
};
