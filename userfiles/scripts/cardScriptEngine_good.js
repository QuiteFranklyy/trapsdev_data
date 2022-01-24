//# sourceURL=engine-script.js
/**
 * Description: 
 * Create Author/Date: 
 * Modified Author/Date Date: 
 * Version: 
 */

 var popupTemplate;
 var mapPins = {};
 var previousPin = null;
 var MODE = Client.getDashboardType();
 var allData = null;
 var NOTIFY = false;
 // Loop over all pins
 var latAvg = 0;
 var lngAvg = 0;
 var numPins = 0;
 
 var sortDict = {
     "trap type": "traptype",
     "trapper": "trapper",
     "state": "state",
     "set time": "settime",
     "device type": "cardType"
 };
 
 function sortEvent(event) {
         var order = false;
         switch(event.value.toLowerCase()) {
             case "state":
             case "settime":
                 order = true;
                 break;
         }
         
         ClientEvents.publish("sortCards", [sortDict[event.value.toLowerCase()], order]);
 }
 
 /**
  * Initialise script state (run once at startup)
  */
 Script.on('load', function() {
     
     Client.setScreenVisible("Image Viewer", false);
 
     ClientEvents.setOptions({
         persist:false
     });
     
     Client.toggleSidebar(true, false);
 
     ClientEvents.subscribe("trapSet", trapSet);
     
     ClientEvents.subscribe("new virtual trap", function(event) {
 
         Devices.getDevicesNicknames(
             ["ATS"],
             ["vTrap"], 
             function(event){
                 var id = null;
                 var nicknames = event.value.map(function(e) {
                     return e[1].toUpperCase();
                 });
                 nicknames.sort();
                 virtualTraps.sort();
                 var ids = nicknames.filter(function (e) {
                     return virtualTraps.indexOf(e) === -1;
                 });
                 if (ids.length > 0) {
                     id = ids[0];
                 }
                 if (id == null) {
                     Log.warn("No virtual traps to create.");
                     alert("No virtual traps left to create. Contact your administrator to partiton more virtual traps.");
                     return;
                 }
                 var packet = {
                     state: "0"
                 };
                 
                 Script.publishToChannel({
                     category: User.accountid,
                     className: "VIRTUAL",
                     instance: id,
                     scope: "SET",
                     value: JSON.stringify(packet)
                 });
 
                 ClientEvents.publish("toggle card", id);
             },
             {
                 status: [1, 2],
                 accounts: ["" + User.accountid]
             }
         );
         return;
     });
     
     var compoundQuery = [
         {
             "TableName" : "lookups", // Specify the primary table used to construct the join request
             "Columns" :
             [
                 "key",
                 "value"
             ]
          }];
     Database.readComposite("traps","lookups", compoundQuery,  [
         {
                 "Column": "key",
                 "Value": "animal"
         }
     ], function(data) {
         // Map data.
         var valueIndex = data.value.headers.indexOf("value");
         var animals = Object.values(data.value.data).map((entry) => entry[valueIndex]);		
         ClientEvents.publish("setAnimals", animals);
     });
     
     Database.readComposite("traps","lookups", compoundQuery,  [
         {
                 "Column": "key",
                 "Value": "traptype"
         }
     ], function(data) {
         // Map data.
         var valueIndex = data.value.headers.indexOf("value");
         var traptypes = Object.values(data.value.data).map((entry) => entry[valueIndex]);		
         ClientEvents.publish("setTrapTypes", traptypes);
     });
     
     
     Database.readRecords("traps", "state", function(event) {
         event.value.headers = event.value.headers.map(function(x){ return x.toLowerCase(); })
 
         if (allData == null) {
             allData = SensaCollection.prototype.load(event.value);
         } else {
             allData = allData.merge(SensaCollection.prototype.load(event.value));
         }
         
         
         ClientEvents.publish("cardDb", event.value);		
             Database.readRecords("Directory","users", function(data) {
                 // Map data.
                 data.value = data.value.query(function(row) {
                     if (row.accountid == User.accountid) return true;
                 });
                 var trappers = data.value.getColumn("username");	
                 ClientEvents.publish("setTrappers", trappers);
                 var trappersFilter = ['All', ...trappers, 'Unassigned'];
                 ClientEvents.publish("setFilter", trappersFilter);
                 
                 var filter = ClientEvents.get("filterCards");
 
                 if (filter == null || filter.value == "") { 
                     ClientEvents.publish("setFilterSelect", Client.getUser());
                     ClientEvents.publish("filterCards", Client.getUser());
                 } else {
                     ClientEvents.publish("setFilterSelect", filter.value);
                     ClientEvents.publish("filterCards", filter.value);
                 }
                 
                 ClientEvents.publish("defaultTrapper", User.username);
             });
     });
     
     if (MODE === "PHONE") {
         ClientEvents.subscribe("addressPressed", function(event) {
             // Set pressed card.
             var row = allData.get(event.value);
             if ((row.lat && row.lat === "") || (row.LAT && row.LAT === "")) {
                 return
             }
             
             if ((row.lon && row.lon === "") || (row.LON && row.LON === "")) {
                 return;
             }
             
             Script.setState("currentPin", event.value);
             Client.jumpToScreen("Map");
         });
     }
     
     ClientEvents.subscribe("save catch", function(event) {
         function callbackPlotHole(id, dbReq) {
             return function(e) {
                 dbReq[id].lat = e.coords.latitude.toString();
                 dbReq[id].lon = e.coords.longitude.toString();
                 dbReq[id].accountid = User.accountid;
                 Database.saveRecord("traps", "transactions", dbReq, function(event) {
                     if (event.value === 0) {
                         alert("Failed to write the TRANSACTION to the database.");
                     }
                 });
             };
         }
         saveFile(event.value.file);
 
         var dbReq = {};
         var id = Script.generateGUID();
         event.value.action = "record catch";
         event.value.inc = id;
         dbReq[id] = event.value;
 
         if (navigator.geolocation) {
             var options = {
                 enableHighAccuracy: true,
                 timeout: 5000,
                 maximumAge: 0
             };
             navigator.geolocation.getCurrentPosition(
                 callbackPlotHole(id, dbReq),
                 function(err) {
                     alert(`An error occured retreived the phone location. Error: ${err.message}`);
                 },
                 options);
         }

         Database.saveRecord("traps", "transactions", dbReq, function (event) {
            if (event.value === 0) {
                alert("Failed to write the TRANSACTION to the database.");
            }
        });
        
     });
     
     if (MODE === "DESKTOP") {
         popupTemplate = Script.getScriptElement("popupTemplateDesktop");
     }
     
     ClientEvents.subscribe("sortText", sortEvent);
     
     ClientEvents.subscribe("cardSelected", function(event) {
         if (MODE === "DESKTOP") {
             var pin = mapPins[event.value.toLowerCase()];
 
             if (pin) {
                 pin.content.classList.add("pinSelected");
                 ClientEvents.publish("setMap", pin.loc);
             }
 
             if (previousPin !== null && previousPin != pin) {
                 previousPin.content.classList.remove("pinSelected");	
             }
 
             if (pin) {
                 previousPin = pin;
             } else {
                 pin = null;
             }
         }
     });
     
     ClientEvents.subscribe("cameraPressed", (data) => {
         if (virtualTraps.indexOf(data.value) !== -1) {
             var div = document.createElement("div");
             div.style.setProperty("display", "flex");
             div.style.setProperty("justify-content", "center");
             div.style.setProperty("height", "100%");
             div.style.setProperty("width", "100%");
             var img = document.createElement("img");
             img.style.setProperty("width", "100%");
             img.style.setProperty("height", "100%");
             img.style.setProperty("object-fit", "contain");
             div.appendChild(img);			
             img.src = "../userfiles/"+data.value+".JPG";
             img.onload = Client.invokeModal("html", data.value, div);
             return;
         }
         Script.setState("camera_name", data.value);
         Client.jumpToScreen("Image Viewer")
     });
     
     ClientEvents.subscribe("cardClosed", function(event) {
         if (MODE === "DESKTOP") {
             var pin = mapPins[event.value.toLowerCase()];
 
             if (typeof pin === "undefined") return;
 
             pin.content.classList.remove("pinSelected");
             previousPin = null;	
         }
     });
     
     ClientEvents.subscribe("clearTrap", function(event) {
         if (MODE === "DESKTOP") {
             ClientEvents.publish("remove pin", event.value.id);
         }
         if (event.value.cardType !== "VIRTUAL") {
             Script.publishToChannel({
                 action: "clear",
                 category: User.accountid,
                 className: event.value.model,
                 instance: event.value.id,
                 "scope": "STATE",
                 label: "number",
                 value: "0"
             });
         }
         
         if (!allData.columns.includes("STATE")) {
             allData.addColumn("STATE");
         }
         
         allData.set({
             id: event.value.id,
             STATE: 0
         });
                 
         if (event.value.cardType === "VIRTUAL") {
             Script.publishToChannel({
                 category: "$SYS",
                 className: "FILES",
                 instance: "REQUEST",
                 scope: "DELETE",
                 value: "",
                 usrmeta: {
                     fileName: "../userfiles/"+event.value.id+".JPG",
                     location: ""
                 }
             });
             
             Script.removeChannel({
                 category: User.accountid,
                 className: "VIRTUAL",
                 instance: event.value.id.toUpperCase(),
                 scope: "+"
             });
             
             var index = virtualTraps.indexOf(event.value.id);
             if (index >= 0) {
                 virtualTraps.splice(index, 1);
             }
             ClientEvents.publish("remove-card", event.value.id);
             allData.remove(event.value.id);
             
             var broadcast = {
                 action: "remove",
                 value: event.value.id
             };
 
             Script.publishToChannel({
                 category: "$APP",
                 className: User.accountid,
                 instance: "ATS",
                 scope: "BROADCAST",
                 value: JSON.stringify(broadcast)
             },{
                 broadcast: true
             });
         }
         
         // Create db transaction
         var dbReq = {};
         event.value.file = null;
         var id = Script.generateGUID();
         event.value["inc"] = id;
         event.value["action"] = "clear";
         dbReq[id] = event.value;
         dbReq[id].accountid = User.accountid;
         Database.saveRecord("traps", "transactions", dbReq, function(event) {
             if (event.value === 0) {
                 alert("Failed to write the TRANSACTION to the write to the database.");
             }
         });	
         
     });
 
     
     ClientEvents.subscribe("checkTrap", function(event) {
         // Create db transaction
         var dbReq = {};
         var id = Script.generateGUID();
         event.value.action = "check";
         event.value["inc"] = id;
         dbReq[id] = event.value;
         dbReq[id].accountid = User.accountid;
         
         Database.saveRecord("traps", "transactions", dbReq, function(event) {
             if (event.value === 0) {
                 alert("Failed to write the TRANSACTION to the write to the database.");
             }
         });
         
         
         // Update state
         var dbAttribs = {
             id: event.value.id,
             settime: event.value.settime,
             trapper: event.value.trapper,
             traptype: event.value.traptype,
             checktime: event.value.checktime,
             alert: event.value.alert,
             notes: event.value.notes,
             jobid: event.value.jobid,
             accountid: User.accountid
         };
     
         var dbStateReq = {};
         dbStateReq[event.value.id] = dbAttribs;
         
         Database.saveRecord("traps", "state", dbStateReq, function(event) {
             if (event.value === 0) {
                 alert("Failed to write the TRANSACTION to the write to the database.");
             }
         });	
         
         if (event.value.model === "VIRTUAL") {
             //debugger;
             //clearTrap(event);
             var broadcast = {
                 action: "remove",
                 value: event.value.id
             };
 
             Script.publishToChannel({
                 category: "$APP",
                 className: User.accountid,
                 instance: "ATS",
                 scope: "BROADCAST",
                 value: JSON.stringify(broadcast)
             },{
                 broadcast: true
             });
         }
         
         var broadcast = {
             action: "check",
             value: dbAttribs
         };
 
         Script.publishToChannel({
             category: "$APP",
             className: User.accountid,
             instance: "ATS",
             scope: "BROADCAST",
             value: JSON.stringify(broadcast)
         },{
             broadcast: true
         });
     });	
 });
 
 var virtualTraps = [];
 
 Script.on("server", function(eventData, channel) {
     if (channel.split('/')[0] == '$APP') {
         var data = JSON.parse(eventData.value);
         switch (data.action.toUpperCase()) {
             case "REMOVE":
                 ClientEvents.publish("remove-card", data.value)
                 break;
             case "SET":
             case "CHECK":
                 // Convert into Sensa Collection
                 var d = {
                     headers: Object.keys(data.value),
                     data: {},
                     pk: "id"
                 }
                 
                 d.data[data.value.id] = Object.values(data.value);
                 var col = SensaCollection.prototype.load(d);
                 ClientEvents.publish("cardInfo", col);
                 break;
             default:
                 console.log("Unknown Action");
                 break;
         }
         return;
     }
 
     var dataCollection;
      if (eventData.sysmeta.label == "sensacollection" && typeof eventData.value == "string") { 
     
          var model = channel.split('/')[1].toLowerCase();
          
          // Init data-structure
          if (allData == null) {
              var col = JSON.parse(eventData.value);
              var index = col.headers.indexOf("instance");
              if (index !== -1) {
                  col.headers[index] = "id";
                  col.headers.map(function(x) { x.toLowerCase(); });
                  col.pk = "id";
                  allData = SensaCollection.prototype.load(col); 
              }		 
          }
          
         var data = JSON.parse(eventData.value);
         
         data.headers = data.headers.map(function(value) {
             return value.toLowerCase();
         });
          
         data.headers[0] = "id";
         data.pk = "id";
          
         dataCollection = SensaCollection.prototype.load(data);
         
         // if lng and lat has been given, send data to map.
         if (MODE === "DESKTOP" && data.headers.indexOf("lon") !== -1 && data.headers.indexOf("lat") !== -1) {
                 // create pin
                 var rowKeys = Object.keys(data.data);
                 for (var i = 0; i < rowKeys.length; i++) {
                     var pinID = rowKeys[i];
                     var latIndex = data.headers.indexOf("lat");
                     var longIndex = data.headers.indexOf("lon");
                     var stateIndex = data.headers.indexOf("state");
                     var deviceState;
 
                     if (stateIndex !== -1) {
                         deviceState = data.data[pinID][stateIndex];
                     }
 
                     var popup = popupTemplate.cloneNode(true);
                     var pinPacket = {
                         id: pinID,
                         loc: {
                             lat: parseFloat(data.data[pinID][latIndex]),
                             lng: parseFloat(data.data[pinID][longIndex])
                         },
                         content: popup
                     };
 
                     if (isNaN(pinPacket.loc.lat) || isNaN(pinPacket.loc.lng)) {
                         continue;
                     }		
 
                     latAvg += parseFloat(data.data[pinID][latIndex]);
                     lngAvg += parseFloat(data.data[pinID][longIndex]);
                     numPins += 1;
                     mapPins[pinID.toLowerCase()] = pinPacket;
 
                     // Send popup to map
                     if (deviceState && +deviceState !== 0) {
                         ClientEvents.publish("map pins", pinPacket);
                     }
                     // Design packet
                     pinPacket.content.querySelector("[data-value='title']").innerHTML = pinID;
                     pinPacket.content.querySelector("[data-value='id']").innerHTML = pinID;
 
                     // Set pin icon
                     if (model === "virtual") {
                         pinPacket.content.querySelector("[data-value='icon']").classList.add("virtual");
                     }
                     
                     if (model.toLowerCase() === "trailcamera") {
                         pinPacket.content.querySelector("[data-value='icon']").classList.add("camera");
                     }
                     
                     // Set pin state.
                     if (deviceState && deviceState == 1) {
                         pinPacket.content.querySelector("[data-value='icon']").classList.add("greenIcon");
                     } else {
                         pinPacket.content.querySelector("[data-value='icon']").classList.add("redIcon");
                     }
                 }
 
                 // Get average lat and lng
                 var tempLatAvg = latAvg / numPins;
                 var tempLngAvg = lngAvg / numPins;
             
                 // Center map
                 var loc = {
                     lat: tempLatAvg,
                     lng: tempLngAvg
                 };
                 console.log(JSON.stringify(loc));
                 ClientEvents.publish("setMap", loc);			
             }
          } else {
             // Get channel id
             var fqn = eventData.sysmeta.channel.split("/");
             var id = fqn[2];
             var model = fqn[1].toLowerCase();
             var scope = fqn[3].toLowerCase();
 
             if (scope === "state" && eventData.value == 2) {
                 if (NOTIFY) {
                     Client.notify("Trapper Triggered", {
                         body: id + " was triggered.",
                         icon: "/userfiles/Animal-Trap-Icon-Red.png"
                     });
                 }
                 if (mapPins[id.toLowerCase()] !== undefined) {
                     mapPins[id.toLowerCase()].content.querySelector("[data-value='icon']").classList = [];
                     mapPins[id.toLowerCase()].content.querySelector("[data-value='icon']").classList.add('redIcon');
                     //mapPins[id.toLowerCase()].content.style.setProperty("display", "");
                     ClientEvents.publish("map pins", mapPins[id.toLowerCase()]);
                 }
             } else	if (scope === "state" && eventData.value == 1) {
                 if (mapPins[id.toLowerCase()] !== undefined) {
                     mapPins[id.toLowerCase()].content.querySelector("[data-value='icon']").classList = [];
                     mapPins[id.toLowerCase()].content.querySelector("[data-value='icon']").classList.add('greenIcon');
                     //if (model
                     //mapPins[id.toLowerCase()].content.style.setProperty("display", "");
                     ClientEvents.publish("map pins", mapPins[id.toLowerCase()]);
                 }
             } else if (scope === "state" && eventData.value == 0) {
                 if (mapPins[id.toLowerCase()] !== undefined) {
                     mapPins[id.toLowerCase()].content.querySelector("[data-value='icon']").classList = [];
                     mapPins[id.toLowerCase()].content.querySelector("[data-value='icon']").classList.add('redIcon');
                     //mapPins[id.toLowerCase()].content.style.setProperty("display", "none");
                     ClientEvents.publish("remove pin", id);
                 }
             }
 
             if (MODE === "DESKTOP" && scope === "lat") {
                 // Get pin and update location
                 var pin = mapPins[id.toLowerCase()];
 
                 if (pin !== undefined && allData.get(id).state != 0) {
                     pin.loc.lat = parseFloat(eventData.value);
                     ClientEvents.publish("map pins", pin);
                     mapPins[id] = pin;
                 }
             } else if (MODE === "DESKTOP" && scope === "lon") {
                 // Get pin and update location
                 var pin = mapPins[id.toLowerCase()];
 
                 if (pin !== undefined && allData.get(id).state != 0) {
                     pin.loc.lng = parseFloat(eventData.value);
                     ClientEvents.publish("map pins", pin);
                     mapPins[id] = pin;
             } else {
                     // If lat already available for pin. Create new pin.
                     if (allData.get(id).lat !== '' && allData.get(id).lat !== null) {
                         // Create new pin. 
                         var lat = allData.get(id).lat;
                         var lon = eventData.value;
                         
                         var popup = popupTemplate.cloneNode(true);
                         var pinPacket = {
                             id: id,
                             loc: {
                                 lat: parseFloat(lat),
                                 lng: parseFloat(lon)
                             },
                             content: popup
                         };
                         mapPins[id.toLowerCase()] = pinPacket;
                         
                         // Send popup to map
                         var deviceState = allData.get(id).state;
                         if (deviceState && +deviceState !== 0) {
                             ClientEvents.publish("map pins", pinPacket);
                         }
                         
                         // Design packet
                         pinPacket.content.querySelector("[data-value='title']").innerHTML = id;
                         pinPacket.content.querySelector("[data-value='id']").innerHTML = id;
 
                         // Set pin state.
                         if (model === "virtual") {
                             pinPacket.content.querySelector("[data-value='icon']").classList.add("virtual");
                         }
                         
                         if (model === "trail4g") {
                             pinPacket.content.querySelector("[data-value='icon']").classList.add("camera");
                         }
                         
                         if (deviceState && deviceState == 1) {
                             pinPacket.content.querySelector("[data-value='icon']").classList.add("greenIcon");
                         } else {
                             pinPacket.content.querySelector("[data-value='icon']").classList.add("redIcon");
                         }
 
                     }
                 }
             }
                      // Create Sensacollection and then send to card.
         dataCollection = new SensaCollection(["id", scope.toLowerCase()], "id");
         var packet = {};
         packet.id = id;
         packet[scope.toLowerCase()] = eventData.value;
         dataCollection.add(packet);
      }
     
     if (allData !== null) {
         allData = allData.merge(dataCollection);
     }
 
     switch (channel.split('/')[1].toUpperCase()) {
             case "TRAIL4G":
                 Log.info("Trail info loading");
                 dataCollection.addColumn("cardType", "CAMERA");
                 dataCollection.addColumn("model", "TRAIL4G");
                 //dataCollection.forEach()				
                 break;
             case "ATS":
                 Log.info("ATS2 info loading");
                 dataCollection.addColumn("cardType", "CAMERATRAP");
                 dataCollection.addColumn("model", "ATS");
                 break;
             case "VIRTUAL":
                 Log.info("Virtual info loading");
                 dataCollection.addColumn("cardType", "VIRTUAL");
                 dataCollection.addColumn("model", "VIRTUAL");
                 var name = dataCollection.forEach(function (result, key) {
                     if (virtualTraps.indexOf(key) === -1) {
                         virtualTraps.push(result.id);
                     }
                 });
                 break;
             case "YABBY":
                 // Send to traps card.
                 Log.info("Yabby info loading");
                 dataCollection.addColumn("cardType", "TRAP");
                 dataCollection.addColumn("model", "YABBY");
                 break;
             default:
                 Log.info("Invalid sensor type found. Aborting load.");
                 return;
         }
     
     ClientEvents.publish("cardInfo", dataCollection);
     
     // Sort cards
     var sort = ClientEvents.get("sortText");
     
     if (sort == null) {
        sort = {
            value: "state"
        };
     }
     
     
     sortEvent(sort);
 });
 
 function saveFile(file, filename) {
     function callback (data) {
         return function(e) {
             if(e.currentTarget.readyState !== e.currentTarget.DONE){
                 return;
             }
             Client.saveImage(
                 e.currentTarget.result,
                 function(e) {
                     if (e.value != e.usrmeta.fileName) {
                         Log.warn("Unable to save file " + e.usrmeta.fileName);
                         Client.status("Unable to uploaded image '" + e.usrmeta.fileName + "'."); 
                     } else {
                         Client.status("Uploaded image '" + e.usrmeta.fileName + "'."); 
                     }
                     Client.stopLoadingSpinner();
                     Script.publishToChannel({
                         category: User.accountid,
                         className: "VIRTUAL",
                         instance: e.usrmeta.fileName.split(".JPG")[0],
                         scope: "VIEWED",
                         value: "0"
                     });
                 },
                 {
                     fileName : data,
                     fileType: "IMAGE",
                 }
             );
         };
     }
     
     if (!file || file.toString() !== "[object File]") {
         return;
     }
     Client.status("Uploading image '" + filename + "'...", true);
     Client.startLoadingSpinner();
     var reader = new FileReader();
     reader.onload = callback(filename);
     reader.readAsDataURL(file);
 }
 
 function trapSet(event) {
     function callbackPlotHole(id, dbReq) {
         return function(e) {
             var value = {
             state: "1",
                 geo: {
                     lat : e.coords.latitude,
                     lon: e.coords.longitude
                 }
             };
             var publishOptions = {
                 category: User.accountid,
                 className: event.value.model,
                 instance: event.value.id,
                 scope: "set",
                 value: JSON.stringify(value)
             };
             Script.publishToChannel(publishOptions);
             dbReq[id].lat = e.coords.latitude.toString();
             dbReq[id].lon = e.coords.longitude.toString();
             dbReq[id].file = null;
             Database.saveRecord("traps", "transactions", dbReq, function(event) {
                 if (event.value === 0) {
                     alert("Failed to write the TRANSACTION to the database.");
                 }
             });
         };
     }
     
     if (MODE === "DESKTOP") {
         var pin = mapPins[event.value.id.toLowerCase()];
 
         // Pin may not exist.
         if (typeof pin !== "undefined") {			
             var iconElem = pin.content.querySelector("[data-value='icon']");
             iconElem.classList = [];
             if (event.value.traptype === "VIRTUAL") {
                 iconElem.classList.add("virtual");
             }
             if (event.value.traptype === "TRAIL4G") {
                 iconElem.classList.add("camera");
             }
             iconElem.classList.add("greenIcon");
             ClientEvents.publish("map pins", pin);
         }
     }
     
     var dbAttribs = {
         id: event.value.id,
         settime: event.value.settime,
         trapper: event.value.trapper,
         traptype: event.value.traptype,
         checktime: null,
         alert: event.value.alert,
         notes: event.value.notes,
         jobid: event.value.jobid,
         lure: event.value.lure
     };
     
     var dbReq = {};
     dbReq[event.value.id] = dbAttribs;
     
     Database.saveRecord("traps", "state", dbReq, function(event) {
         if (event.value === 0) {
             alert("Failed to write the STATE to the write to the database.");
         }
     });
                 
     
     // Create db transaction
     dbReq = {};
     var id = Script.generateGUID();
     event.value.action = "set";
     event.value["inc"] = id;
     event.value.accountid = User.accountid;
     
     dbReq[id] = Object.assign({}, event.value);
     delete dbReq[id].file;
     Database.saveRecord("traps", "transactions", dbReq, function(event) {
         if (event.value === 0) {
             alert("Failed to write the TRANSACTION to the write to the database.");
         }
     });	
 
     Script.publishToChannel({
         category: User.accountid,
         className: event.value.model,
         instance: event.value.id,
         "scope": "STATE",
         label: "number",
         value: "1"
     });
     
     if (!allData.columns.includes("STATE")) {
         allData.addColumn("STATE");
     }
     
     allData.set({
         id: event.value.id,
         STATE: 1
     });
 
     var broadcast = {
         action: "set",
         value: dbAttribs
     };
     
     Script.publishToChannel({
         category: "$APP",
         className: User.accountid,
         instance: "ATS",
         scope: "BROADCAST",
         value: JSON.stringify(broadcast)
     },{
         broadcast: true
     });
     
     
     if (event.value.cardType === "VIRTUAL") {
         // Create db transaction
         dbReq = {};
         var id = Script.generateGUID();
         event.value.action = "set";
         event.value.inc = id;
         event.value.accountid = User.accountid;
         
         saveFile(event.value.file, event.value.id.toUpperCase()+".JPG");
         delete event.value.file;
         
         dbReq[id] = event.value;
         if (MODE !== "DESKTOP") {
             if (navigator.geolocation) {
             var options = {
                 enableHighAccuracy: true,
                 timeout: 5000,
                 maximumAge: 0
             };
 
             navigator.geolocation.getCurrentPosition(
                 callbackPlotHole(id, dbReq),
                 callbackPlotHole(id, dbReq),
                 options);
             }
         } else {
             var value = {
                 "state": "1",
             };
             var publishOptions = {
                 category: User.accountid,
                 className: event.value.model,
                 instance: event.value.id,
                 scope: "set",
                 value: JSON.stringify(value)
             };
             
             Script.publishToChannel(publishOptions);
         }
     }
 }
 
 function clearTrap(event) {
     if (MODE === "DESKTOP") {
         ClientEvents.publish("remove pin", event.value.id);
     }
     
     Script.publishToChannel({
             action: "clear",
             category: User.accountid,
             className: event.value.model,
             instance: event.value.id,
             "scope": "STATE",
             label: "number",
             value: "0"
     });
     
     allData.set({
         id: event.value.id,
         STATE: 0
     });
                 
 
     if (event.value.cardType === "VIRTUAL") {
         var value = {
             state: 0,
             geo: {
                 lat: "clear",
                 lon: "clear",
             }
         };
 
         var publishOptions = {
             category: User.accountid,
             className: event.value.model,
             instance: event.value.id,
             scope: "set",
             value: JSON.stringify(value)
         };
         Script.publishToChannel(publishOptions);
         Script.publishToChannel({
             className: "FILES",
             instance: "REQUEST",
             value: "",
             usrmeta: {
                 fileName: "../userfiles/"+event.value.id+".JPG",
                 location: ""
             }
         });
         
         event.value.file = null;
     }
 
     // Create db transaction
     var dbReq = {};
     var id = Script.generateGUID();
     event.value["inc"] = id;
     event.value["action"] = "clear";
     event.value.accountid = User.accountid;
     event.value.cleartime = new Date().getTime();
     dbReq[id] = event.value;
     Database.saveRecord("traps", "transactions", dbReq, function(event) {
         if (event.value === 0) {
             alert("Failed to write the TRANSACTION to the write to the database.");
         }
     });	
 }