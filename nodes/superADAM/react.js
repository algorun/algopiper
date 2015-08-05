module.exports = function(RED) {
    function ReactNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;
        var request = require('request');
        this.on('input', function(msg) {
            input_data = '';
            try{
                json = JSON.parse(msg.payload);
                input_data = msg.payload;
            }catch(e) {
                input_data = config.data;
            }
            this.status({fill:"blue",shape:"ring",text:"computing .."});
            request.post(
                'http://x.algorun.org:33336/do/run',
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
    RED.nodes.registerType('REACT',ReactNode);
}