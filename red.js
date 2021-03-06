#!/usr/bin/env nodejs
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
var http = require('http');
var https = require('https');
var util = require("util");
var express = require("express");
var crypto = require("crypto");
var nopt = require("nopt");
var path = require("path");
var fs = require("fs");
var RED = require("./red/red.js");
var log = require("./red/log");
var request = require('request');

var settingsFile;
var flowFile="sample-flow.json";
var guide = true;

if (process.env.PIPELINE_URL != undefined && process.env.PIPELINE_NAME != undefined) {
    var tab_string = '{"type":"tab","id":"65b5a326.9a4a5c","label":"' + process.env.PIPELINE_NAME + '"},'
    request(process.env.PIPELINE_URL, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var pipeline = body;
            var sample_pipeline = pipeline.slice(0, 1) + tab_string + pipeline.slice(1);
            fs.writeFile(flowFile, sample_pipeline, function(err) {
                if(err) {
                    return console.log(err);
                }
                console.log("Pipeline loaded!");
                guide = false;
		startServer();
            });
        }
    });
}else{
	startServer();
}
function startServer(){
var server;
var app = express();


app.get('/guide', function(req, res){
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");

    if(req.query.stop != undefined){
        guide = false;
    }

    res.status = 200;
    res.send({'guide': guide});
    return;
});


var knownOpts = {
    "manager": String,
    "settings":[path],
    "userDir":[path],
    "v": Boolean,
    "help": Boolean
};
var shortHands = {
    "m":["--manager"],
    "s":["--settings"],
    "u":["--userDir"],
    "?":["--help"]
};
nopt.invalidHandler = function(k,v,t) {
    // TODO: console.log(k,v,t);
}

var parsedArgs = nopt(knownOpts,shortHands,process.argv,2);

if (parsedArgs.help) {
    console.log("AlgoPiper v"+RED.version());
    console.log("Usage: node-red [-v] [-?] [--manager URL] [--settings settings.js] [--userDir DIR] [flows.json]");
    console.log("");
    console.log("Options:");
    console.log("  -m, --manager URL  use specified algomanager endpoint");
    console.log("  -s, --settings FILE  use specified settings file");
    console.log("  -u, --userDir  DIR   use specified user directory");
    console.log("  -v                   enable verbose output");
    console.log("  -?, --help           show usage");
    console.log("");
    console.log("Documentation can be found at http://algopiper.org");
    process.exit();
}
if (parsedArgs.argv.remain.length > 0) {
    // flowFile = parsedArgs.argv.remain[0];
}

if (parsedArgs.settings) {
    // User-specified settings file
    settingsFile = parsedArgs.settings;
} else if (parsedArgs.userDir && fs.existsSync(path.join(parsedArgs.userDir,"settings.js"))) {
    // User-specified userDir that contains a settings.js
    settingsFile = path.join(parsedArgs.userDir,"settings.js");
} else {
    if (fs.existsSync(path.join(process.env.NODE_RED_HOME,".config.json"))) {
        // NODE_RED_HOME contains user data - use its settings.js
        settingsFile = path.join(process.env.NODE_RED_HOME,"settings.js");
    } else {
        var userSettingsFile = path.join(process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE,".node-red","settings.js");
        if (fs.existsSync(userSettingsFile)) {
            // $HOME/.node-red/settings.js exists
            settingsFile = userSettingsFile;
        } else {
            // Use default settings.js
            settingsFile = __dirname+"/settings.js";
        }
    }
}

if(parsedArgs.manager == undefined && process.env.MANAGER == undefined){
    console.log("ERROR: You must pass algomanager url");
    console.log("Use: nodejs red.js -m URL <OR>");
    console.log("     docker run -p <port>:8765 -e MANAGER=<manager_endpoint> algorun/algopiper");
    process.exit();
}
var algomanager = parsedArgs.manager || process.env.MANAGER;
if(algomanager.indexOf("http://") == -1){
    algomanager = "http://" + algomanager;
}

app.get('/algomanager', function(req, res){
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");

    res.status = 200;
    res.send({'algomanager': algomanager});
    return;
});

try {
    var settings = require(settingsFile);
    settings.settingsFile = settingsFile;
} catch(err) {
    if (err.code == 'MODULE_NOT_FOUND') {
        console.log("Unable to load settings file: "+settingsFile);
    } else {
        console.log(err);
    }
    process.exit();
}

if (parsedArgs.v) {
    settings.verbose = true;
}

if (settings.https) {
    server = https.createServer(settings.https,function(req,res){app(req,res);});
} else {
    server = http.createServer(function(req,res){app(req,res);});
}
server.setMaxListeners(0);

function formatRoot(root) {
    if (root[0] != "/") {
        root = "/" + root;
    }
    if (root.slice(-1) != "/") {
        root = root + "/";
    }
    return root;
}

if (settings.httpRoot === false) {
    settings.httpAdminRoot = false;
    settings.httpNodeRoot = false;
} else {
    settings.httpRoot = settings.httpRoot||"/";
    settings.disableEditor = settings.disableEditor||false;
}

if (settings.httpAdminRoot !== false) {
    settings.httpAdminRoot = formatRoot(settings.httpAdminRoot || settings.httpRoot || "/");
    settings.httpAdminAuth = settings.httpAdminAuth || settings.httpAuth;
} else {
    settings.disableEditor = true;
}

if (settings.httpNodeRoot !== false) {
    settings.httpNodeRoot = formatRoot(settings.httpNodeRoot || settings.httpRoot || "/");
    settings.httpNodeAuth = settings.httpNodeAuth || settings.httpAuth;
}

settings.uiPort = settings.uiPort||1880;
settings.uiHost = settings.uiHost||"0.0.0.0";

//if (flowFile) {
//    settings.flowFile = "sample-flow.json"; //flowFile;
//}
if (parsedArgs.userDir) {
    settings.userDir = parsedArgs.userDir;
}

try {
    RED.init(server,settings);
} catch(err) {
    if (err.code == "not_built") {
        console.log("AlgoPiper has not been built. See README.md for details");
    } else {
        console.log("Failed to start server:");
        if (err.stack) {
            console.log(err.stack);
        } else {
            console.log(err);
        }
    }
    process.exit(1);
}

if (settings.httpAdminRoot !== false && settings.httpAdminAuth) {
    RED.log.warn(log._("server.httpadminauth-deprecated"));
    app.use(settings.httpAdminRoot,
        express.basicAuth(function(user, pass) {
            return user === settings.httpAdminAuth.user && crypto.createHash('md5').update(pass,'utf8').digest('hex') === settings.httpAdminAuth.pass;
        })
    );
}

if (settings.httpNodeRoot !== false && settings.httpNodeAuth) {
    app.use(settings.httpNodeRoot,
        express.basicAuth(function(user, pass) {
            return user === settings.httpNodeAuth.user && crypto.createHash('md5').update(pass,'utf8').digest('hex') === settings.httpNodeAuth.pass;
        })
    );
}
if (settings.httpAdminRoot !== false) {
    app.use(settings.httpAdminRoot,RED.httpAdmin);
}
if (settings.httpNodeRoot !== false) {
    app.use(settings.httpNodeRoot,RED.httpNode);
}

settings.httpStatic = __dirname;
if (settings.httpStatic) {
    settings.httpStaticAuth = settings.httpStaticAuth || settings.httpAuth;
    if (settings.httpStaticAuth) {
        app.use("/",
            express.basicAuth(function(user, pass) {
                return user === settings.httpStaticAuth.user && crypto.createHash('md5').update(pass,'utf8').digest('hex') === settings.httpStaticAuth.pass;
            })
        );
    }
    app.use("/",express.static(settings.httpStatic));
}

function getListenPath() {
    var listenPath = 'http'+(settings.https?'s':'')+'://'+
                    (settings.uiHost == '0.0.0.0'?'127.0.0.1':settings.uiHost)+
                    ':'+settings.uiPort;
    if (settings.httpAdminRoot !== false) {
        listenPath += settings.httpAdminRoot;
    } else if (settings.httpStatic) {
        listenPath += "/";
    }
    return listenPath;
}

RED.start().then(function() {
    if (settings.httpAdminRoot !== false || settings.httpNodeRoot !== false || settings.httpStatic) {
        server.on('error', function(err) {
            if (err.errno === "EADDRINUSE") {
                RED.log.error(log._("server.unable-to-listen", {listenpath:getListenPath()}));
                RED.log.error(log._("server.port-in-use"));
            } else {
                RED.log.error(log._("server.uncaught-exception"));
                if (err.stack) {
                    RED.log.error(err.stack);
                } else {
                    RED.log.error(err);
                }
            }
            process.exit(1);
        });
        server.listen(settings.uiPort,settings.uiHost,function() {
            if (settings.httpAdminRoot === false) {
                RED.log.info(log._("server.admin-ui-disabled"));
            }
            process.title = 'node-red';
            RED.log.info(log._("server.now-running", {listenpath:getListenPath()}));
        });
    } else {
        RED.log.info(log._("server.headless-mode"));
    }
}).otherwise(function(err) {
    RED.log.error(log._("server.failed-to-start"));
    if (err.stack) {
        RED.log.error(err.stack);
    } else {
        RED.log.error(err);
    }
});


process.on('uncaughtException',function(err) {
    util.log('[red] Uncaught Exception:');
    if (err.stack) {
        util.log(err.stack);
    } else {
        util.log(err);
    }
    process.exit(1);
});

process.on('SIGINT', function () {
    RED.stop();
    // TODO: need to allow nodes to close asynchronously before terminating the
    // process - ie, promises
    process.exit();
});}
