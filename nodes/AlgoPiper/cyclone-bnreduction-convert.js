function getBooleanFunction(input_variables, transition_table){
    var boolean_function = '';
    var first = true;
    transition_table.forEach(function(item, i){
        if(item[1] == 1){
            if(first){
                first = false;
            } else{
                boolean_function += " | ";
            }
            item[0].forEach(function(entry, index){
                if(index != 0){
                    boolean_function += " & ";
                }
                if(entry == 1){
                    // add the positive of that variable
                    boolean_function += input_variables[index];
                } else {
                    // add the negative of that variable
                    boolean_function += '!' + input_variables[index];
                }
            });
        }
    });
    return boolean_function;
}

function convertToBNReuctionInput(cyclone_input){
    var x = [];
    var bnreduction_input = {};
    var task = {};
    var method = {};
    method["type"] = "steady state computation";
    method["id"] = "BNReduction";
    method["description"] = "Computes steady states using reduction and Groebner basis. Model is automatically converted from Cyclone transition tables using AlgoPiper nodes";
    method["arguments"] = [{"id": "k1","value": 1},{"id": "k2","value": 0}];
    var input = [{}];
    input[0]["type"] = "model";
    input[0]["description"] = "Sample Model";
    input[0]["parameters"] = [{"id": "k1","states": [0,1]},{"id": "k2","states": [0,1]}];
    var updateRules = [];
    var cyclone_update_rules = cyclone_input["task"]["input"][0]["updateRules"];
    cyclone_update_rules.forEach(function(rule, i){
        var bnreduction_rule = {};
        bnreduction_rule["target"] = rule["target"];
        var input_variable = rule["functions"][0]["inputVariables"];
        var transition_table = rule["functions"][0]["transitionTable"];
        bnreduction_rule["functions"] = [];
        var f = {};
        f["inputVariables"] = rule["functions"][0]["inputVariables"];
        f["booleanFunction"] = getBooleanFunction(input_variable, transition_table);
        bnreduction_rule["functions"].push(f);
        
        updateRules.push(bnreduction_rule);
    });
    var variables = [];
    var cyclone_variables = cyclone_input["task"]["input"][0]["variables"];
    cyclone_variables.forEach(function(v, i){
        delete v["speed"];
        variables.push(v);
        x.push(v["id"]);
    });
    input[0]["updateRules"] = updateRules;
    input[0]["variables"] = variables;
    task["method"] = method;
    task["input"] = input;
    bnreduction_input["task"] = task;
    bnreduction_input = JSON.stringify(bnreduction_input);
    
    // replacing input variables names with x's as bnreduction is restricuted to that name
    x.forEach(function(name, i){
        var reg = new RegExp(name, 'g')
        bnreduction_input = bnreduction_input.replace(reg, "x"+(i+1));
    });
    bnreduction_input = JSON.parse(bnreduction_input);
    return bnreduction_input;
}