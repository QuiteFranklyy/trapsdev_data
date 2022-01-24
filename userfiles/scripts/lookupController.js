/**
 * Description: 
 * Create Author/Date: 
 * Modified Author/Date Date: 
 * Version: 
 */
 var oldVal;

 // Get list of tables in lookups DB
 function get_lookup_keys() {
     Database.readRecords(
         "traps",
         "lookups",
         function (dbResponse) {
             if (dbResponse.value === 0) {
                 return;
             }
             var keys = Object.keys(dbResponse.value.data);
             ClientEvents.publish("lookup-dropdown-receive-list", keys, false);
             get_option_values(keys[0]);
         },
         {
             columns: "DISTINCT key",
             filter: "",
             order: ""
         }
     );
 }
 
 function get_option_values(option) {
     
     option = option.toLowerCase();
     var compoundQuery = [
         {
             "TableName" : "lookups", // Specify the primary table used to construct the join request
             "Columns" :
             [
                 "key",
                 "value",
             ]
          }];
     Database.readComposite("traps","lookups", compoundQuery,  [
         {
                 "Column": "key",
                 "Value": option
         }
     ], function(dbResponse) {
           
         ClientEvents.publish("lookup-table-clear", "", false);
         var collection = new SensaCollection([option,"value"], option);
         Object.keys(dbResponse.value.data).forEach( function (key) {
             var value = dbResponse.value.data[key][0];
             var obj = {};
             obj["value"] = value;
             obj[option] = key;
             collection.add(obj);
         });
         ClientEvents.publish("lookup-table-receive", collection, false);
     });
 }
         
 
 
 function get_dropdown_value () {
     var formData = Script.getForm("lookup-form");
     var option = formData["lookup-dropdown"];
     if (typeof option !== "string" && !(option instanceof String)) {
         option = "";
     }
     return option;
 }
 
 /**
  * Initialise script state (run once at startup)
  */
 Script.on('load', function() {
     
     // Load lookups database;
     get_lookup_keys();
     //create_dummy_data();
     
     ClientEvents.subscribe("lookup-dropdown-selected", function (eventData, channel) {
         get_option_values(eventData.value);
     });
     
     //Get value is lookup-dropdown and set title of Table
     var option = get_dropdown_value();
     if (option) {
         ClientEvents.publish("lookup-table-set-title", option);
         Database.readRecords("lookup", option.toLowerCase(), "*", "", "ORDER by key COLLATE NOCASE ASC");
     }
     
     ClientEvents.subscribe("lookup-table-selected", function(eventData, channel) {
          
         Object.keys(eventData.value.data).forEach(function (item, index, array) {
             if (array.length !== 1) {
                 throw new Error("Array should be of length 1 when table is selected " + String.fromCodePoint(0x1F641));
             }
             
             oldVal = eventData.value.data[item][1];
             ClientEvents.publish("lookup-value-receive",  eventData.value.data[item][1]);
         });
     });
     
     ClientEvents.subscribe("lookup-clear-pressed", function(eventData, channel) {
         ClientEvents.publish("lookup-value-receive", "");
     });
     
     ClientEvents.subscribe("lookup-save-pressed", function(eventData, channel) {
             
         var option = get_dropdown_value().toLowerCase();
         if (option === "") {
             console.error("Unable to get dropdown option " + String.fromCodePoint(0x1F641));
             return false;
         }
         var formData = Script.getForm("lookup-form");
         if (formData.constructor !== Object) {
             console.error("Unable to get for data from form " + String.fromCodePoint(0x1F641));
             return false;
         }
         var value = formData["lookup-value"];
         if (typeof value !== "string" && !(key instanceof String)) {
             console.error("Value is not a string " + String.fromCodePoint(0x1F641));
             return false;
         }
         if (value === "") {
             return;
         }
         
         var packet = {};
          
  
         packet = 
         [
             {
                 "TableName":"lookups",
                 "OnConflict":
                 [
                     {
                         "Column":"key",
                         "ParamName":"conf1",
                         "Value":option
                     },
                     {
                         "Column":"value",
                         "ParamName":"conf2",
                         "Value":value
                     }
                 ],
                 "data":
                 [
                     {
                         "Column":"key",
                         "ParamName":"option1",
                         "value":option
                     },
                     {
                         "Column":"value",
                         "ParamName":"val1",
                         "value":oldVal
                     }
                 ],
                 "Filters":
                 [
                     {
                         "Column":"key",
                         "ParamName":"option1",
                         "value":option
                     },
                     {
                         "Column":"value",
                         "ParamName":"val1",
                         "value":oldVal
                     }
                 ]
             }
         ];
         
         Database.saveComposite(
             "traps",
             "lookups",
             packet,
             function (dbResponse) {
                 oldVal = undefined;
 
                 //this can be simplified not to run a query each time a record has been added or edited but rather to edit the clicked record to save load on the database instnace per action
                 get_option_values(option);
             }
         );
     });
     
     ClientEvents.subscribe("lookup-delete-pressed", function(eventData, channel) {
          
          var option = get_dropdown_value();
         if (option === "") {
             console.error(String.fromCodePoint(0x1F641));
             return false;
         }
         var formData = Script.getForm("lookup-form");
         if (formData["lookup-table"] === undefined) {
             console.error(String.fromCodePoint(0x1F641));
             return false;
         }
         var data;
         var obj = formData["lookup-table"];
         if (obj.data !== undefined && Object.prototype.toString.call(obj.data) === "[object Object]") {
             data = obj.data;
         }
          
         var val = first(data);
         // Kris to check because this is his script now.
         if (val === undefined) {
             return;
         }
         
         var compoundQeury = [
         {
             "TableName" : "lookups", // Specify the primary table used to construct the join request
 
             "Filters" : // Filter options in case they are needed.
             [
                 {
                     "Column":"key",
                     "ParamName":"key",
                     "Value":option.toLowerCase() // Query issue was that the key is set to be an upper case in the dropdown but the actual value in the databse is lowercase.
                 },
                 {
                     "Column":"value",
                     "ParamName":"value",
                     "Value":val[1]
                 },
 
             ],
 
         }];
 
         Database.deleteRecordParam("traps", "lookups",compoundQeury, function(data){
             
             if(data.value === 1)
             {
                 
                 oldVal = undefined;
 
                 Client.clearDirtyFlag();
                 get_option_values(option);
 
             }
         });
 
         Object.keys(data).forEach(function (value, index, array) {
             ClientEvents.publish("lookup-value-receive", "");
         });
     });
 
 });
 function first(p) {
   for (var i in p) return p[i];
 }
 /**
  * Response to message from server channel
  */
 Script.on('server', function(eventData) {
 });