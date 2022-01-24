//# sourceURL=transaction-script.js
/**
 * Description: 
 * Create Author/Date: 
 * Modified Author/Date Date: 
 * Version: 
 */

/**
 * Initialise script state (run once at startup)
 */
 var columns = ['inc', 'id', 'jobid', 'cardType','trapper', 'traptype', 'state', 'action', 'settime', 'checktime','updatetime', 'triggeredtime', 'date'];
 var columnNicks = ['inc', 'nickname', 'job id', 'card type','trapper', 'trap type', 'state', 'action', 'set time', 'check time', 'update time', 'triggered time', 'date time'];
 var intervalMap = {"week": -7,
					"month": -30,
					"3months": -90,
					"year": -365};
 var transactionData = null;
 Script.on('load', function() {

     let downloadBtn = Script.getWidget("downloadBtn");
     downloadBtn.subscribe("pressed", (eventData) => {
        Script.downloadCSV("transaction_data.csv", transactionData);
     });


     Database.readRecords("traps", "transactions", function(data) {		 
         transactionData = SensaCollection.load(data.value);

         updateTable();	
     }, {
         filter: `date BETWEEN datetime('now', '-6 days') AND datetime('now', 'localtime') AND accountid='${User.accountid}'`
         //filter: "LIMIT 100"
     });
     
     ClientEvents.subscribe("rowSelected", function(data) {
         // get id
         var col = SensaCollection.load(data.value);
         
         var id = col.getFirst().inc;
         var obj = transactionData.get(id);
 
         obj.state = obj.state == 0? obj.state = "unassigned" :  1 ? "set": obj.state == 2 ? "triggered": "";
         obj.setDate = obj.settime !== "" ? new Date(parseInt(obj.settime)).toISOString().split('T')[0] : ""; // must go before time otherwise gets overwritten
         obj.settime = obj.settime !== "" ? formatTime(obj.settime).split("<br />")[0] : "";
         obj.checkDate = obj.checktime !== "" ? new Date(parseInt(obj.checktime)).toISOString().split('T')[0] : "";
         obj.checktime = obj.checktime !== "" ? formatTime(obj.checktime).split("<br />")[0] : "";
         obj.updateDate = obj.updatetime !== "" ? new Date(parseInt(obj.updatetime)).toISOString().split('T')[0] : "";
         obj.updatetime = obj.updatetime !== "" ? formatTime(obj.updatetime).split("<br />")[0] : "";
         obj.triggeredDate = obj.triggeredtime !== "" ? new Date(parseInt(obj.triggeredtime)).toISOString().split('T')[0] : "";
         obj.triggeredtime = obj.triggeredtime !== "" ? formatTime(obj.triggeredtime).split("<br />")[0] : "";
         obj.temp = obj.temp.split('&')[0];
         
         Script.clearForm("tran");
         Script.setForm("tran", obj);	
     });
	 
	 ClientEvents.subscribe("intervalSet", function(timeData) {
		Database.readRecords("traps", "transactions", function(data) {
			 transactionData = SensaCollection.load(data.value);

			 updateTable();	
		 }, {
			 filter: `date BETWEEN datetime('now', '${intervalMap[timeData.value]} days') AND datetime('now', 'localtime') AND accountid='${User.accountid}'`
			 //filter: "LIMIT 100"
		 }); 
	 });
     
     ClientEvents.subscribe("deleteRow", function(eventData) {
         var formData = Script.getFormByKey("tran");
         var pk = formData.inc;
         
         // Delete from database.
         Database.deleteRecord("traps", "transactions", "inc", pk, function(response) {
             if (response.value == 1) {
                 Client.notify("Transaction Deleted", {
                     body: "Transaction was successfully deleted on the server.",
                     icon: "/userfiles/Animal-Trap-Icon-Green.png"
                 });
             } else {
                 Client.notify("Transaction Failed", {
                     body: "Transaction failed to delete the server.",
                     icon: "/userfiles/Animal-Trap-Icon-Red.png"
                 });
             }
             transactionData.remove(pk);
             ClientEvents.publish("trans-delete-rows", [pk]);
             //updateTable();
             
         });
     });
     
     ClientEvents.subscribe("downloadBtn", function(eventData) {
         
     });
     
     ClientEvents.subscribe("saveBtnPressed", function(eventData) {
          
         var formData = Script.getFormByKey("tran");				
         var pk = formData.inc;
         
         // join time and dates.
         if (formData.settime !== "") {
             if(formData.setDate !== "")
             {
                 formData.settime = new Date(formData.setDate + "T" + formData.settime).getTime();
             }
             else
             {
                 Client.notify("Transaction Error", {
                     body: "Please set date for the selected time.",
                     icon: "/userfiles/Animal-Trap-Icon-Green.png"
                 });
             }
         }
          
         
         if (formData.updatetime !== "")
         {
             if(formData.updateDate !== "")
             {
                 formData.updatetime = new Date(formData.updateDate + "T" + formData.updatetime).getTime();
             }
             else	
             {
                 Client.notify("Transaction Error", {
                     body: "Please set update date for the selected time.",
                     icon: "/userfiles/Animal-Trap-Icon-Green.png"
                 });
             }
         }
         
         if (formData.checktime !== "") 
         {
             if(formData.checkDate !== "")
             {
                 formData.checktime = new Date(formData.checkDate + "T" + formData.checktime).getTime();
             }
             else
             {
                 Client.notify("Transaction Error", {
                     body: "Please set check date for the selected time.",
                     icon: "/userfiles/Animal-Trap-Icon-Green.png"
                 });
             }
         }
         
         if (formData.triggeredtime !== "")
         {
             if(formData.triggeredDate !== "")
             {
                 formData.triggeredtime = new Date(formData.triggeredDate + "T" + formData.triggeredtime).getTime();
             }
             else
             {
                 Client.notify("Transaction Error", {
                     body: "Please set triggered date for the selected time.",
                     icon: "/userfiles/Animal-Trap-Icon-Green.png"
                 });
             }
         }
         
         // convert set state
         switch(formData.state.toLowerCase()) {
             case "set":
                 formData.state = '1';
                 break;
             case "unassigned":
                 formData.state = '0';
                 break;
             case "triggered":
                 formData.state = '2';
                 break;
             default:
                 formData.state = "";
         }
         
         // Remove date objects form
         delete formData.setDate;
         delete formData.checkDate;
         delete formData.updateDate;
         delete formData.triggeredDate;
           
         // Write to database.
         //We check if the file is assigned otherwise it errors out when we check if it contains a value and is not an empty object
          if(formData.file !== undefined)
         {
             if(Object.keys(formData.file).length === 0) // Check if the file is not an empty object {} otherwise it breaks the json in the SensaCollection when running the sql query.
             {
                 formData.file = "";
             }
         }
         var dbRequest = {};
         dbRequest[pk] = formData;
         Database.saveRecord("traps", "transactions", dbRequest, function(response) {
             if (response.value == 1) {
                 Client.notify("Transaction Updated", {
                     body: "Transaction was successfully updated on the server.",
                     icon: "/userfiles/Animal-Trap-Icon-Green.png"
                 });
             } else {
                 Client.notify("Transaction Failed", {
                     body: "Transaction failed to update the server.",
                     icon: "/userfiles/Animal-Trap-Icon-Red.png"
                 });
             }
         });	
         
         var origData = transactionData.get(pk);
         origData = Object.assign(origData, formData);
         transactionData.set(origData);
         Script.clearForm("tran");
         
         var col = transactionData.filter(transactionData.columns, [pk]);
         updateTable(col);
     });
     
 });
 
function tableSortingFunction(a,b) {
    a = a.children[0].innerHTML;
    b = b.children[0].innerHTML;
    a = a.split("<br>")[1].split("/").reverse().join('') + a.split("<br>")[0].split(":");
    b = b.split("<br>")[1].split("/").reverse().join('') + b.split("<br>")[0].split(":");
    return a < b ? 1 : a > b ? -1 : 0;
}

 
 function formatTime(utcTime) {
     var date = new Date(parseInt(utcTime)).toLocaleString('en-GB');
     var d = date.split(", ");
     var d0 = d[0].split("/");
     d0[2] = Math.abs(d0[2] - 2000);
     d0 = d0.join("/");
     return d[1] + "<br />" + d0;
 }
 
 function updateTable(col) {
		 // Clear all rows
		 ClientEvents.publish("deleteAllRows", "");
         // Update table
         var columns = ['inc', 'id', 'jobid', 'cardType','trapper', 'traptype', 'state', 'action', 'settime', 'checktime','updatetime', 'triggeredtime', 'date'];
         var col2;
  
         if (typeof col === "undefined") {
             col2 = transactionData.filter(columns);
         } else {
             col2 = col.filter(columns);
         }
         col2.setColumns(columnNicks);
         
         col2.forEach(function(row, pk) {
             
             var stateText = "";
             if (row.state) {
                 switch (row.state) {
                     case '0':
                         stateText = "unassigned";
                         break;
                     case '1':
                         stateText = "set";
                         break;
                     case '2': 
                         stateText = "triggered";
                         break;
                    //  default:
                    //      formData.state = "";
                 }
             }
              
             var updateObj = {
                 "inc": row['inc'],
                 "set time": row['set time'] !== "" ? formatTime(row['set time']) : "",
                 "check time": row['check time'] !== "" ? formatTime(row['check time']) : "",
                 "update time": row['update time'] !== "" ? formatTime(row['update time']) : "",
                 "triggered time": row['triggered time'] !== "" ? formatTime(row['triggered time']) : "",
                 "date time": row['date time'] !== "" ? formatTime(new Date(row['date time'] + "Z").getTime()) : "",
                 "state": stateText
             };
             
             
             col2.set(updateObj);
         });
         
         ClientEvents.publish("trans", col2);
		 ClientEvents.publish("sortByFunction", {sortFunction: tableSortingFunction, col: "date time"});		 
 }