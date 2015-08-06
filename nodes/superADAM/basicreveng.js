module.exports = function(RED) {
    function BasicRevEngNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;
        node.status({fill:"green",shape:"dot",text:"ready .."});
        var request = require('request');
        this.on('input', function(msg) {
            input_data = '';
            try{
                json = JSON.parse(msg.payload);
                input_data = msg.payload;
            }catch(e) {
                msg.payload = 'input data is not in JSON format';
                node.send(msg);
                node.status({fill:"red",shape:"dot",text:"error .."});
                return;
            }
            this.status({fill:"blue",shape:"ring",text:"computing .."});
            request.post(
                'http://basicreveng.algorun.org/do/run',
                { form: { input: input_data } },
                function (error, response, body) {
                    if (!error && response.statusCode == 200) {
                        msg.payload = body;
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
    RED.nodes.registerType('BasicRevEng',BasicRevEngNode);
}