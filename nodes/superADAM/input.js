/**
 * Copyright 2013, 2015 IBM Corp.
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
    var cron = require("cron");

    function InjectNode(n) {
        RED.nodes.createNode(this,n);

        this.on("input",function(msg) {
            msg.payload = n.data;
            this.send(msg);
            msg = null;
        });
    }

    RED.nodes.registerType("INPUT",InjectNode);


    RED.httpAdmin.post("/INPUT/:id", RED.auth.needsPermission("INPUT.write"), function(req,res) {
        var node = RED.nodes.getNode(req.params.id);
        if (node != null) {
            try {
                node.receive();
                res.send(200);
            } catch(err) {
                res.send(500);
                node.error(RED._("INPUT.failed",{error:err.toString()}));
            }
        } else {
            res.send(404);
        }
    });
}
