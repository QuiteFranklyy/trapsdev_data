/**
 * @file Manages the Directory API used in the Scripting (scripting.html) widget.
 *
 * All Directory and Database responses will be return via the $DIR/ADMIN/MANAGE/RESPONSE in Script.on('Server', func)
 *
 * @requires Utils.js Widget Utils API.
 *
 * @author Daniel Gormly
 */


/**
 * Main Script library.
 * @type {Object} 
 */
 const Script = {};

 var clientEvent;
 var serverEvent;
 var loaded;
 var ini;
 var keypressFunc;
 var screenChangeEvent;
 
 
 /**
  * Script events.
  *
  * The Script widget is able to respond to events that happen throughout the system.
  *
  * These events include:
  *  - init: initialising function that runs only once when the screen is first viewed before loaded. Best used to do any system setups.
  *  - load: When the screen loads every time.
  *  - client: DEPRECIATED:Client events that the Scripting widget is subscribed to.
  *  - server: Server events that the Scripting widget is subscribed to.
  *  - keypress: Key press events that happen on the screen.
  *  - screenchange: Event fired when screen changes, if the function returns true false the change is blocked.
  *
  * @param {string} eventType Event to attach the given callback to.
  * @param {function} call Function callback to be run when the given event occurs.
  */
 Script.on = function (eventType, callback) {
     // Check that callback is actually a function.
     if (typeof callback !== "function") {
         throw new TypeError("Callback not a function for event: ", event);
     }
 
     switch (eventType.toUpperCase()) {
         case "INIT":
             ini = callback;
             break;
         case "LOAD":
             loaded = callback;
             break;
         case "CLIENT":
             Log.warn("Client events have been depreciated. Please use Script.subscribeToState(channel)");
 //            clientEvent = callback;
             break;
         case "SERVER":
             serverEvent = callback;
             break;
         case "KEYPRESS":
             keypressFunc = callback;
             break;
         case "SCREENCHANGE":
             screenChangeEvent = callback;
             break;
         default:
             Log.warn("Invalid eventType '" + eventType +
                 "'. eventType must be either: load, server, keypress, screenchange");
             throw new Error("Invalid eventType '" + eventType +
                 "'. eventType must be either: load, server, keypress, screenchange");
     }
 };
 
 Script.import = function (src, id, callback) {
     if (typeof src !== "string") {
         throw new TypeError("src must be of type 'string', found '" + typeof src + "'.");
     }
     if (typeof id !== "string") {
         throw new TypeError("id must be of type 'string', found '" + typeof id + "'.");
     }
     if (typeof callback !== "function" && typeof callback !== "undefined") {
         throw new TypeError("callback must be of type 'function', found '" + typeof callback + "'.");
     }
 
     var scriptElem = document.createElement("script");
     scriptElem.onload = callback;
     scriptElem.setAttribute("id", "")
     scriptElem.setAttribute("src", src);
 
     // Add to script dom
     var docHeader = document.getElementsByTagName("head")[0];
     docHeader.appendChild(scriptElem);
 }
 
 /**
  * Converts a sensacollection to a downloadable .CSV file
  * 
  * @param {string} fileName - Name of the file
  * @param {SensaCollection} collection - Collection to download in .csv format.
  */
 Script.downloadCSV = function (fileName, collection) {
 
     if (!(collection instanceof SensaCollection)) {
         throw new TypeError("Invalid sensacollection structure.");
     }
 
     if (typeof fileName !== "string") {
         throw new TypeError("Invalid fileName type, expected 'string' but found '" + typeof fileName + "'.");
     }
 
     _downloadCSV(collection.toCSV(), fileName);    
 }
 
 
 /**
  * Sents and empty string to all items associated with the form ID.
  * 
  * @param {any} id
  */
 Script.clearForm = function (formId) {
     if (parent === null || parent.widgets === null || parent.selScreenName === null) {
         throw new TypeError("This is restricted to widgets. Could not locate widgets.");
     }
 
     if (typeof formId !== "string") {
         throw new TypeError("formId must be a string.");
     }
 
 
     var currentScreen = parent.selScreenName;
 
     // Loop over each widget and get all widgets matching the form.
     var widgets = parent.widgets;
     // Loop over all widgets for widgets on the current screen containing the same form id.
     for (var widget in widgets) {
         var wObject = widgets[widget];
         if (wObject.screen.toLowerCase() === currentScreen.toLowerCase()) {
             if (typeof wObject.attribs === "object" && typeof wObject.attribs["form id"] === "string") {
                 if (wObject.attribs["form id"].toLowerCase() === formId.toLowerCase()) {
                     var widgetFunc = wObject.defView.options.settings.setForm;
 
                     // Check that it is func.
                     if (typeof widgetFunc !== "function") {
                         throw new Error("Set Form function not set or is not a function for widget '" + widgetName + "'.");
                     }
 
                     var data = {
                         value: ""
                     };
 
                     widgetFunc(data);
                 }
             }
         }
     }
 }
 
 
 /**
  * Gets the values of all widgets on the current screen registered to the given form id.
  * 
  * @param {string} id - Form to associate widget with.
  * 
  * @returns {object} - Javascript object where every key represents the widget name and value the widget returns in fw_form
  */
 Script.getForm = function (id) {
 
     if (parent === null || parent.widgets === null || parent.selScreenName === null) {
         throw new TypeError("This is restricted to widgets. Could not locate widgets.");
     }
 
     if (typeof id !== "string" || id === "") {
         throw new TypeError("id must be of type string and not empty.");
     }
 
     var retVals = {};
     var formWidgets = [];
     var currentScreen = parent.selScreenName;
 
     // Loop over all widgets for widgets on the current screen containing the same form id.
     for (var widget in parent.widgets) {
         var wObject = parent.widgets[widget];
         if (wObject.screen.toLowerCase() === currentScreen.toLowerCase()) {
             if (typeof wObject.attribs === "object" && typeof wObject.attribs["form id"] === "string") {
                 if (wObject.attribs["form id"].toLowerCase() === id.toLowerCase()) {
                     formWidgets.push(widget);
                 }
             }
         }
     }
 
     // Loop over array of widgets and fw_form() and gather current values.
     for (var widget in formWidgets) {
         // Check if widget actuallyl contains fw_form function
         var wObject = parent.widgets[formWidgets[widget]];
 
         if (typeof wObject.defView.fw_form === "function") {
             retVals[formWidgets[widget]] = wObject.defView.fw_form();
         }
     }
 
     return retVals;
 }
 
 /**
  * Gets the values of all widgets on the current screen registered to the given form id and key value.
  * @param {string} formId - Form to associate widget with.
  * 
  * @returns {object} - Javascript object where every key represents the widget name and value the widget returns in fw_form
  *                   - null if a form item has not been filled out.
  */
 Script.getFormByKey = function (formId) {
 
     if (parent === null || parent.widgets === null || parent.selScreenName === null) {
         throw new TypeError("This is restricted to widgets. Could not locate widgets.");
     }
 
     if (typeof formId !== "string" || formId === "") {
         throw new TypeError("formId must be of type string and not empty.");
     }
 
     var retVals = {};
     var formWidgets = [];
     var formKeys = {};
     var currentScreen = parent.selScreenName;
 
     // Loop over all widgets for widgets on the current screen containing the same form formId.
     for (var widget in parent.widgets) {
         var wObject = parent.widgets[widget];
         if (wObject.screen.toLowerCase() === currentScreen.toLowerCase()) {
             if (typeof wObject.attribs === "object" && typeof wObject.attribs["form id"] === "string") {
                 if (wObject.attribs["form id"].toLowerCase() === formId.toLowerCase()
                     && typeof wObject.attribs["form id"] !== "undefined") {
                         if (typeof wObject.attribs["form key"] === "undefined") {
                             Log.warn("No form key found for widget '" + widget + "'. Data will not be processed.");
                             continue
                         } else {
                             
                             var key = wObject.attribs["form key"]
                             // Check if key already exists
                             if (typeof formKeys[key] === "undefined") {
                                 formWidgets.push(widget);
                                 formKeys[key] = widget;
                             } else {
                                 Log.error("Widget '" + widget + "' contains the same form key as widget '" + formKeys[key] + "'.");
                                 throw Error("Widget '" + widget + "' contains the same form key as widget '" + formKeys[key] + "'.");
                             }
                         }
                 }
             }
         }
     }
 
     // Loop over array of widgets and fw_form() and gather current values.
     for (var widget in formWidgets) {
         // Check if widget actuallyl contains fw_form function
         var wObject = parent.widgets[formWidgets[widget]];
 
         if (typeof wObject.defView.fw_form === "function") {
             var val = wObject.defView.fw_form();
             if (val === "[~{0}~]") {
                 Log.warn(`Not all items in the form '${formId}' have been filled out.`, "ALL", true);
                 return null;
             } else {
                 retVals[wObject.attribs["form key"]] = val;
             }
         }
     }
 
     return retVals;
 }
 
 
 /**
  * Sets the values of all form widgets on the current screen.
  * 
  * @param {string} formId - Form id to set.
  * @param {object} formObj - Object with keys being form name and value being the form value.
  * 
  * @returns {string[]} String array containing all the keys that were successfully set.
  */
 Script.setForm = function (formId, formObj) {
 
     var widgets = fw.func("GETWIDGETS");
     var currentScreen = fw.func("CURRENTSCREEN");
     if (fw == undefined) {
         throw new TypeError("This is restricted to widgets. Could not locate widgets.");
     }
 
     if (typeof formId !== "string") {
         throw new TypeError("formId must be a string.");
     }
 
     if (typeof formObj !== "object") {
         throw new TypeError("formObj must be of type Object and not empty.");
     }
 
     var formWidgets = [];
 
     // Loop over each widget and get all widgets matching the form.
     // Loop over all widgets for widgets on the current screen containing the same form id.
     for (var widget in widgets) {
         var wObject = widgets[widget];
         if (wObject.screen.toLowerCase() === currentScreen.toLowerCase()) {
             if (typeof wObject.attribs === "object" && typeof wObject.attribs["form id"] === "string") {
                 if (wObject.attribs["form id"].toLowerCase() === formId.toLowerCase()) {
                     formWidgets.push(widget);
                 }
             }
         }
     }
 
     var valuesDelivered = [];
     // Loop over form widgets and set values
     for (var i = 0; i < formWidgets.length; i++) {
         var wObject = widgets[formWidgets[i]];
         if (typeof wObject.attribs === "object" && typeof wObject.attribs["form id"] === "string") {   
             var formKey = wObject.attribs["form key"];
             if (typeof formObj[formKey] !== "undefined") {       
                 var widgetFunc = wObject.defView.options.settings.setForm;
 
                 // Check that it is func.
                 if (typeof widgetFunc !== "function") {
                     throw new Error("Set Form function not set or is not a function for widget '" + widgetName + "'.");
                 }
 
                 var data = {
                     value: formObj[formKey]
                 };
 
                 widgetFunc(data);
                 valuesDelivered.push(formKey);
 
             }
         }
     }
 
     return valuesDelivered;
 }
 
 
 /**
  * Returns a widget containing all the client input events as functions. 
  * Please refer to each widgets documentation individually for what these functions are.
  * 
  * @param {string} widgetName - Name of widget on the screen. 
  * 
  * @returns {widget} - widget object containing all client event input functions available. widget.attribs contains all widget attributes and their values.
  */
 Script.getWidget = function(widgetName) {
 
     var widgets = fw.func("GETWIDGETS");
     var currentScreen = fw.func("CURRENTSCREEN");
     var wObject = widgets[widgetName];
 
     if (wObject == undefined) {
         throw new Error("Widget '" + widgetName + "' could not be found.");
     }
 
     if (wObject.screen.toLowerCase() !== currentScreen.toLowerCase()) {
         throw new Error("Widget '" + widgetName + "' must be on the same screen.");
     }
 
     // Check that input events actually exist.
     var inputEvents;
     try {
         inputEvents = wObject.defView.options.clientEvents.inputEvents;
     } catch (err) {
         throw new Error("Input events do not exist for widget '" + widgetName + "'.");
     }
 
     // Generate wrapper functions with the same name.
     var customWidget = {};
     var eventKeys = Object.keys(inputEvents);
 
     for (var i = 0; i < eventKeys.length; i++) {
         var key = eventKeys[i];
         var func = inputEvents[key];
         var funcName = func.name;
         customWidget[funcName] = _functionGenerator(func, widgetName);
     }
 
     customWidget.attribs = Object.assign({}, widgets[widgetName].attribs);
     customWidget._name = widgetName;
 
     // Attach subscribe function to specific widget for direct subscriptions.
     customWidget.subscribe = function(outputEvent, callback) {
         if (typeof outputEvent !== "string") {
             throw new TypeError("outputEvent must be a string. Found '" + typeof outputEvent + "'.");
         }
 
         outputEvent = outputEvent.toLowerCase();
 
         if (typeof callback !== "function") {
             throw new TypeError("callback must be a function. Found '" + typeof callback + "'.");
         }
 
         // Attach to widget.
         _widgetEventSubscribe(widgetName, outputEvent, callback);
     }
     
     customWidget.subscribeToServer = function(channel, eventName, attribs) {
         if (typeof channel !== "object") {
             throw new TypeError(`Channel must be an object that contains channel.category, channel.className, channel.instance, and channel.scope. Found ${typeof channel} instead.`);
         }
 
         if (typeof eventName !== "string") {
             throw new TypeError(`EventName must be of type 'function.' Found ${typeof eventName} instead.`);
         }
 
         _widgetEventSubscribeServer(widgetName, channel, eventName, attribs);
     }
 
     return customWidget;
 }
 
 /**
  * Disables a widget
  * 
  * @param {string} widgetName - Name of widget on the screen. 
  * 
  */
 Script.disableWidget = function(widgetName) {
     var widgets = fw.func("GETWIDGETS");
     var currentScreen = fw.func("CURRENTSCREEN");
     var wObject = widgets[widgetName];
 
     if (wObject == undefined) {
         throw new Error("Widget '" + widgetName + "' could not be found.");
     }
 
     if (wObject.screen.toLowerCase() !== currentScreen.toLowerCase()) {
         throw new Error("Widget '" + widgetName + "' must be on the same screen.");
     }
     
     wObject.disabled = true;
     // wObject.defView.document.location.reload(false);
     fw.func("SETDISABLEWIDGET", widgetName, true);
 }
 
 /**
  * Enables a widget
  * 
  * @param {string} widgetName - Name of widget on the screen. 
  * 
  */
 Script.enableWidget = function(widgetName) {
     var widgets = fw.func("GETWIDGETS");
     var currentScreen = fw.func("CURRENTSCREEN");
     var wObject = widgets[widgetName];
 
     if (wObject == undefined) {
         throw new Error("Widget '" + widgetName + "' could not be found.");
     }
 
     if (wObject.screen.toLowerCase() !== currentScreen.toLowerCase()) {
         throw new Error("Widget '" + widgetName + "' must be on the same screen.");
     }
     
     wObject.disabled = false;
     // wObject.defView.document.location.reload(false);
     fw.func("SETDISABLEWIDGET", widgetName, false);
 }
 
 /**
  * Hides a widget
  * 
  * @param {string} widgetName - Name of widget on the screen
  */
 Script.hideWidget = function(widgetName) {
     var widgets = fw.func("GETWIDGETS");
     var currentScreen = fw.func("CURRENTSCREEN");
     var wObject = widgets[widgetName];
 
     if (wObject == undefined) {
         throw new Error("Widget '" + widgetName + "' could not be found.");
     }
 
     if (wObject.screen.toLowerCase() !== currentScreen.toLowerCase()) {
         throw new Error("Widget '" + widgetName + "' must be on the same screen.");
     }
     fw.func("HIDEWIDGET", widgetName);
 }
 
 /**
  * Shows a widget that may have been hidden
  * 
  * @param {string} widgetName - Name of widget on the screen
  */
 Script.showWidget = function(widgetName) {
     var widgets = fw.func("GETWIDGETS");
     var currentScreen = fw.func("CURRENTSCREEN");
     var wObject = widgets[widgetName];
 
     if (wObject == undefined) {
         throw new Error("Widget '" + widgetName + "' could not be found.");
     }
 
     if (wObject.screen.toLowerCase() !== currentScreen.toLowerCase()) {
         throw new Error("Widget '" + widgetName + "' must be on the same screen.");
     }
     fw.func("SHOWWIDGET", widgetName);
 }
 
 /**
  * Attach subscribe to server function to specific widget for direct subscriptions
  * @param {string} targetWidgetName - Name of the widget that is subscribing to the channel.
  * @param {object} channel - Channel object containing channel.category, channel.className, channel.instance, and channel.scope 
  * @param {string} eventName - Type of server input event (history, feed).
  * @param {object} [attribs={}] - Widget specific attributes relative to the server event.   
  */
 function _widgetEventSubscribeServer(targetWidgetName, channel, eventName, attribs) {
     // Add random event to target widget.
     let widgets = fw.func("GETWIDGETS");
     let eventsManager = fw.func("GETEVENTSMANAGER");
     let widget = widgets[targetWidgetName];
     let events = widget.events;
     let randomServerName = "" + Math.round(Math.random() * 1000000);
 
     if (typeof events.serverEvents !== "object") {
         events.serverEvents = {};
     }
 
     if (typeof events.serverEvents.inputEvents !== "object") {
         events.serverEvents.inputEvents = {};
     }
     
     // Generate random eventname.
     let channelFqn = `${channel.category}/${channel.className}/${channel.instance}/${channel.scope}`.toUpperCase();
     let eventObj = {
         channel: channelFqn,
         event: eventName,
         important: false,
         attribs: attribs ?? null
     }
 
     events.serverEvents.inputEvents[randomServerName] = eventObj;
     eventsManager.subscribe(channelFqn, targetWidgetName, true);
 }
 
 function _widgetEventSubscribe(targetWidgetName, outputEvent, cb) {
     let randomName = "" + Math.random();
     // Add random event to target widget.
     let widgets = fw.func("GETWIDGETS");
     let widget = widgets[targetWidgetName];
     let events = widget.events;
 
     if (typeof events.clientEvents !== "object") {
         events.clientEvents = {};
     }
 
     if (typeof events.clientEvents.outputEvents !== "object") {
         events.clientEvents.outputEvents = {};
     }
 
     if (typeof events.clientEvents === "object" && typeof events.clientEvents.outputEvents === "object") {
         var outputEvents = events.clientEvents.outputEvents;
         // Generate random eventname.
         var eventObj = {
             channel: randomName  + "/" + outputEvent,
             event: outputEvent,
             trigger: outputEvent,
             important: false
         }
         outputEvents[randomName] = eventObj;
         ClientEvents.subscribe(randomName, cb);
     }
 }
 
 function _functionGenerator(func, widgetName) {
     return function(input) {
         let widgets = fw.func("GETWIDGETS");
         let widget = widgets[widgetName];
         if (widget.disabled) {
             return;
         }
         input = {
             sysmeta: {
                 label: ""
             },
             value: input
         };
 
         if (input.value instanceof SensaCollection) {
             input.sysmeta.label = "sensacollection";
             input.value = input.value.clone();
         } else if (typeof input.value == "number" || typeof input.value == "string") {
             input.sysmeta.label = typeof input.value;
         } else if (Array.isArray(input.value)) {
             input.value = Object.assign([], input.value);
         } else if (typeof input.value === "object") {
             input.value = Object.assign({}, input.value);
         }
         try {
             func(input);
         } catch (err) {
             throw new Error("Failed to run widget '" + widgetName + "' function '" + func.name + "' directly. Error:" + err);
         }
     }
 }
 
 function _downloadCSV(csv, filename) {
     var csvFile;
     var downloadLink;
 
     // CSV file
     csvFile = new Blob([csv], { type: "text/csv" });
 
     // Download link
     downloadLink = document.createElement("a");
 
     // File name
     downloadLink.download = filename;
 
     // Create a link to the file
     downloadLink.href = window.URL.createObjectURL(csvFile);
     
     // Hide download link
     downloadLink.style.display = "none";
 
     // Add the link to DOM
     document.body.appendChild(downloadLink);
 
     // Click download link
     downloadLink.click();
 }
 
 
 
 Script.import = function (src, id, callback) {
     if (typeof src !== "string") {
         throw new TypeError("src must be of type 'string', found '" + typeof src + "'.");
     }
     if (typeof id !== "string") {
         throw new TypeError("id must be of type 'string', found '" + typeof id + "'.");
     }
     if (typeof callback !== "function" && typeof callback !== "undefined") {
         throw new TypeError("callback must be of type 'function', found '" + typeof callback + "'.");
     }
 
     var scriptElem = document.createElement("script");
     scriptElem.onload = callback;
     scriptElem.setAttribute("id", "")
     scriptElem.setAttribute("src", src);
 
     // Add to script dom
     var docHeader = document.getElementsByTagName("head")[0];
     docHeader.appendChild(scriptElem);
 }
 
 
 /**
  * Get the script string from another scripting widget.
  *
  * @param {string} name - Name of the script to retrieve.
  *
  * @return {string} - Code used in another script element.
  */
 Script.getScriptElement = function (name) {
     var widgets = fw.func("GETWIDGETS");
     if (typeof widgets[name] !== "undefined" && widgets[name].type === "Scripting") {
         var innerH = widgets[name].defView.returnScript();
         var elem = document.createElement("div");
         elem.innerHTML = innerH;
         elem = elem.firstChild;
         return elem;
     }
     return null;
 };
 
 /**
  * Iherits another template/class from a script that belongs to another screen allowing dependency injection of components.
  *
  * @param {string} name - Name of the script to retrieve.
  *
  * @return {string} - Code used in another script element.
  */
 
 Script.inheritScript = function (name) {
     var widgets = fw.func("GETWIDGETS");
     if (typeof widgets[name] !== "undefined" && widgets[name].type === "Scripting") {
         var innerH = widgets[name].attribs["code editor"];
         var elem = document.createElement("div");
         elem.innerHTML = innerH;
         elem = elem.firstChild;
         return elem;
     }
     return null;
 };
 
 /**
  * DEPRECIATED - Please use Script.setState(channel)
  * 
  * Send data to widget on the current screen.
  *
  * @requires Utils.js Widget Utils API.
  *
  * @param {string} name - Widget name to send data to
  * @param {string} event - Event type for the receiving widget (e.g. receive value)
  * @param {string} label - Packet type (number, string, array, SensaCollection, DBRequest)
  * @param {any} value - Value to pass to the widget.
  * @param {object} [usrmeta={}] - Meta data used by the application (not used usually)
  * @param {object} [sysmeta={}] - Meta data use by the system for routing (not used usually)
  * 
  * 
  * @example <caption>Example usage</caption>
  * @example
  *  Script.sendToWidget("dropdown","receive value","string","item1,item2,item3");
  */
 Script.sendToWidget = function (name, event, label, value, usrmeta, sysmeta) {
     throw new Error("Script.sendToWidget has been depreciated. Please use Script.setState(channel).");
     
     /*
 
     // If label is still null, exit the function as it is not valid.
     if (label === null) {
         throw new Error("Valid label required to send message to widget.");
     }
 
     // Check label is valid.
     if (Utils.LABELS.indexOf(label.toLowerCase()) === -1) {
         throw new Error("Invalid label '" + label + "'. Label must be either: " + Utils.LABELS.join());
     }
 
     // Check that collection has the correct structure
     if (label.toLowerCase() === "sensacollection" && !Utils.isValidSensaCollection(value)) {
         throw new Error("Invalid Sensacollection structure.");
     }
 
     var data = { value: value, sysmeta: sysmeta, usrmeta: usrmeta, label: label.toLowerCase() };
     var widgets = fw.func("GETWIDGETS");
     if (typeof widgets[name] !== "undefined" && typeof widgets[name].defView.options.clientEvents.inputEvents[event] !== "undefined") {
         widgets[name].defView.options.clientEvents.inputEvents[event](data);
     } else {
         throw new Error("SendToWidget can't be processed for event '" + event + "' as widget '" + name + "' doesn't exist, check widget spelling in script. Event not processed.");
     } 
     */
 };
 
 /**
  * Set the state of a given key for access later from any other script.
  *
  * @param {string} stateKey -  Key to save state under
  * @param {any} value to store.
  * @param {bool} [persist=false] - Persist to localStorage
  */
 Script.setState = function(stateKey, value, persist) {
     if (typeof stateKey !== "string") {
         throw new TypeError("StateKey value is not of type 'string'.");
     }
 
     if (typeof persist === "boolean" && persist == true) {
         switch (value !== null && typeof value) {
             case "function":
             case "undefined":
             case "symbol":
                 console.error("value: "+ value + "with type: " + typeof value + "cannot be saved to local storage");
                 throw new TypeError();
                 break;
         }
     } else {
         persist = undefined;
     }
 
     fw.func("SETSTATE", stateKey.toUpperCase(), value, persist);
 };
 
 /**
  * Remove an item from state store (mainly used for states stored in local storage);
  * @param {String} stateKey 
  */
 Script.removeState = function (stateKey) {
     if (typeof stateKey !== "string") {
         throw new TypeError("StateKey value is not of type 'string'.");
     }
     
     fw.func("REMOVESTATE", stateKey);
 }
 
 
 /**
  * Generates a 128bit globally unique identifier.
  */
 Script.generateGUID = function () {
     return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
         var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
         return v.toString(16);
     });
 }
 
 
 /**
  * Subscribes to the change in a variable
  *
  * @param {string} stateKey - key to subscribe to in the Global state store.
  * @param {function} fn - function to run on state change. The function is passed both the channel and value as parameters if needed.
  *
  * @return {function} returns the function subscribed with. This is the subscription id that is used to unsubscribe from state.
  */
 Script.subscribeToState = function(stateKey, fn) {
 
     if (typeof stateKey !== "string") {
         throw new TypeError("StateKey value is not of type 'string'.");
     }
 
     if (typeof fn !== "function") {
         throw new TypeError("fn value must be of type 'function'.");
     }
     var retVal = fw.func("SUBSCRIBESTATE", stateKey.toUpperCase(), fn);
     return retVal ? retVal.value : null;
 };
 
 
 /**
  * Unsubscribes to the change in a variable
  *
  * @param {string} stateKey - State store key to unsubscribe from.
  * @param {function} func - The function pointer to remove.
  */
 Script.unsubscribeFromState = function(stateKey, func) {
     // Check input.
     if (typeof stateKey !== "string") {
         throw new TypeError("StateKey must be of type 'string'.");
     }
 
     if (typeof func !== "function") {
         throw new TypeError("func must be of type 'function', found '" + typeof func + "'.");
     }
 
     fw.func("UNSUBSCRIBESTATE", stateKey.toUpperCase(), func);
 };
 
 
 /**
  * If State for the key has not been set then the function will return null
  *
  * @param {string} stateKey - State to return from the global state store.
  *
  * @return {any} Value stored in the global statestore, null if the item does not exist.
  */
 Script.getState = function (stateKey) {
     if (typeof stateKey !== "string") {
         throw new TypeError("stateKey must be of type 'string'.");
     }
 
     var state = fw.func("GETSTATE", stateKey.toUpperCase());
     var newVal;
     if (state !== undefined && state !== null && typeof state.value === "object") {
         // Clone object.
         newVal = Object.assign({}, state);
     } else if (state !== undefined) {
         newVal = state;
     } else {
         newVal = null;
     }
 
     return newVal;
 };
 
 
 
 /**
  * Print all the values in the client's statestore.
  */
 Script.printStateStore = function () {
     Log.info("-----------------------");
     Log.info("Application StateStore");
     Log.info("-----------------------");
     var ss = fw.func("GETSTATESTORE");
     var values = ss.values;
     var keys = Object.keys(values);
     for (var i in keys) {
         var k = keys[i];
         var value = values[k];
         Log.info(k + "   :   " + value);
     }
     Log.info("-----------------------");
 }
 
 /**
  * Used to remove a state from the state store. Also unsubscribes all observers
  * 
  * @param {String} stateKey - State store key to remove from the state store.
  * @return {any} - Reurns the value removed or null if doesn't exist.
  */
 Script.removeState = function (stateKey) {
     if (typeof stateKey !== "string") {
         throw new TypeError("stateKey must be of type 'string'.");
     }
 
     var state = fw.func("REMOVESTATE", stateKey.toUpperCase());
     return state;
 }
 
 /**
  * Removes all states, observers and states stored in local storage.
  */
 Script.clearStateStore = function () {
     var state = fw.func("CLEARSTATESTORE");
     return state;
 }
 
 
 /**
  * Subscribe to a given channel.
  *
  * @param {string} name - Unique name for the event. The event must be unique to the widget.
  * @param {object} channel - Object that contains all sections of the channel to subscribe to.
  * @param {string} channel.category - Channel category
  * @param {string} channel.className - Channel class
  * @param {string} channel.instance - Channel instance
  * @param {string} channel.scope - Channel scope
  * @param {function} [callback=fw_feed] - Callback function that will run if an event comes in on the channel. If no callback is defined, the event will go to the Script.on("server") event. 
  */
 Script.subscribeToChannel = function (name, channel, callback) {
     var defaults = {
         category: "+",
         className: "+",
         instance: "+",
         scope: "+",
     }
 
     if (typeof name !== "string") {
         throw new TypeError("name must be a string.");
     }
 
     if (typeof channel !== "object") {
         throw new TypeError("channel must be an object.")
     }
  
     defaults = Object.assign(defaults, channel);
 
     if (typeof defaults.category !== "string") {
         throw new TypeError("Category must be of type string. Found " + typeof defaults.category);
     }
 
     if (typeof defaults.className !== "string") {
         throw new TypeError("className must be of type string. Found " + typeof defaults.className);
     }
 
     if (typeof defaults.instance !== "string") {
         throw new TypeError("Instance must be of type string. Found " + typeof defaults.instance);
     }
 
     if (typeof defaults.scope !== "string") {
         throw new TypeError("Scope must be of type string. Found " + typeof defaults.scope);
     }
 
     var channelString = defaults.category + "/" + defaults.className + "/" + defaults.instance + "/" + defaults.scope;
 
 
     // Uppercase to remove any case issues.
     channelString = channelString.toUpperCase();
 
     var ctid = fw.func("SERVERSUBSCRIBE", channelString);
     
     if (typeof callback === "function") {
         ctidCallbacks[ctid] = callback;
     }
 
     var events = parent.widgets[fw.widgetName].events;
     if (events.serverEvents === undefined) {
         events.serverEvents = {};
     }
 
     if (events.serverEvents.inputEvents === undefined) {
         events.serverEvents.inputEvents = {};
     }
 
     events.serverEvents.inputEvents[name] = {
         channel: channelString.toUpperCase(),
         event: "feed"
     };
 };
 
 
 /**
  * Publish to a channel a given value.
  *
  * @requires Utils.js Widget Utils API.
  *
  * @param {object} channel - Object that contains all the settings to publish to the channel.
  * @param {string} channel.category - Channel category
  * @param {string} channel.className - Channel class
  * @param {string} channel.instance - Channel instance
  * @param {string} channel.scope - Channel scope
  * @param {string} channel.value - Value to update the given channel with.
  * @param {string} [channel.label="number"] - Label of the packet that is being published.
  * @param {object} [channel.usrmeta] - Any usrmeta that is required by the application
  * @param {object} [channel.sysmeta] - Sysmeta information used for specific platform actions (optional).
  * @param {object} [options] - Options for when posting.
  * @param {boolean}[options.broadcast=false] - Any message published using broadcast does not return to the sender script.
  */
 Script.publishToChannel = function (channel, options) {
 
     var defaults = {
         category: null,
         className: null,
         instance: null,
         scope: null,
         label: "number",
         value: null,
         usrmeta: null,
         sysmeta: null
     }
 
     defaults = Object.assign(defaults, channel);
 
     if (typeof defaults.category !== "string") {
         throw new TypeError("Category must be of type string. Found " + typeof defaults.category);
     }
 
     if (typeof defaults.className !== "string") {
         throw new TypeError("className must be of type string. Found " + typeof defaults.className);
     }
 
     if (typeof defaults.instance !== "string") {
         throw new TypeError("Instance must be of type string. Found " + typeof defaults.instance);
     }
 
     if (typeof defaults.scope !== "string") {
         throw new TypeError("Scope must be of type string. Found " + typeof defaults.scope);
     }
 
     if (typeof defaults.label !== "string") {
         throw new TypeError("label must be of type string. Found " + typeof defaults.label);
     }
 
     if (defaults.sysmeta === null) {
         defaults.sysmeta = { source: "widget/" + fw.widgetName };
     }
 
     // Check sysMeta object is being used and correct structure.
     if (defaults.sysmeta && typeof defaults.sysmeta !== "object") {
         throw new Error("sysmeta should be of type 'object'");
     }
 
     if (defaults.sysmeta && typeof defaults.sysmeta.source !== "string") {
         throw new Error("sysmeta should contain key 'source' of type 'string'.");
     }
 
     // Check source in sysMeta is correct format.
     if (defaults.sysmeta && defaults.sysmeta.source.split("/").length !== 2) {
         throw new Error("sysmeta.source must be of the format 'widget/widgetName'.");
     }
 
     if (typeof options !== "undefined" && typeof options === "object") {
         if (options.broadcast === true) {
             defaults.sysmeta.ctid = "" + Math.round(Math.random() * 65535);
             bids[defaults.sysmeta.ctid] = true;
         }
     }
 
     // Check that label is valid.
     if (!Utils.isValidLabel(defaults.label)) {
         throw new Error(defaults.label + " is an invalid label type. Label must be either: " + Utils.LABELS.join());
     }
 
     var channelString = defaults.category + "/" + defaults.className + "/" + defaults.instance + "/" + defaults.scope;
 
 
     // Publish packet to channel
     fw.func("PUBLISHSVR", channelString, defaults.value, defaults.label, defaults.usrmeta, defaults.sysmeta);
 };
 
 Script.getChannels = function(callback) {
     var ctid = fw.func("GETCHANNELS", fw_feed);
     if (typeof callback === "function") {
         ctidCallbacks[ctid] = callback;
     }
 }
 
 
 /**
  * 
  * @param {string} name - Name of the function.
  * @param {object} inputChannel - Object that contains all the settings to publish to the channel.
  * @param {string} inputChannel.category - Channel category
  * @param {string} inputChannel.className - Channel class
  * @param {string} inputChannel.instance - Channel instance
  * @param {string} inputChannel.scope - Channel scope
  */
 Script.registerFlowAPI = function(name, inputChannel) {
 
     if (typeof name !== "string") {
         throw new TypeError(`Name must be of type 'string'. Found '${name}'.`);
     }
 
     if (typeof flowAPI[name] !== "undefined") {
         throw new Error("Flow error already registered.")
     }
 
     if (typeof inputChannel !== "object") {
         throw new TypeError(`inputChannel must be of type 'object'. Found '${inputChannel}'.`);
     }
 
     flowAPI[name] = inputChannel;
 }
 
 
 /**
  * Fires a flow API. The API must be registered using Script.registerFlowAPI function.
  * If you would like the API response to go to all subscribers of the end flow use Script.publishToChannel
  * 
  * @param {*} name - Name of flow API to fire.
  * @param {*} value - Value to send through the API.
  * @param {*} callback - 
  */
 Script.fireApi = function(name, value, callback) {
 
     if (typeof name !== "string") {
         throw new TypeError(`Name must be of type 'string'. Found '${name}'.`);
     }
 
     if (typeof flowAPI[name] === "undefined") {
         throw new Error(`Flow error. API '${name}' not registered.`);
     }
 
     if (typeof callback !== "function" && typeof callback !== "undefined") {
         throw new TypeError("")
     }
 
     if (typeof value !== "string") {
         throw new TypeError(`Value must be of type 'string'. Found '${typeof value}'.`);
     }
 
     let channel = Object.assign({}, flowAPI[name]);
     if (channel) {
         channel.sysmeta = {
             ctid: "" + Math.round(Math.random() * 65535),
             source: "widget/" + fw.widgetName
         };
         channel.value = value;
         ctidCallbacks[channel.sysmeta.ctid] = callback;
         Script.publishToChannel(channel);
 
     } else {
         throw new Error(`API '${name}' has no been registered.`);
     }
 }
 
 
 /**
  * Allows flow APIs to be called sequentially.
  * 
  * @param {*} name - Name of flow function API
  * @param {*} value - Value to pass to the flow.
  * @returns {Promise} event data packet received from the server. 
  */
 Script.fireApiAsync = function(name, value) {
     if (typeof name !== "string") {
         throw new TypeError(`Name must be of type 'string'. Found '${name}'.`);
     }
 
     if (typeof flowAPI[name] === "undefined") {
         throw new Error(`Flow error. API '${name}' not registered.`);
     }
 
     return new Promise(function(myResolve, myReject) {
         Script.fireApi(name, value, myResolve);
     });
 }
 
 /**
  * Remove a channel from the server side state store.
  * 
  * @param {object} channel an object containing the following
  * @param {string} channel.category - The category portion of the channel namespace
  * @param {string} channel.className - The className portion of the channel namespace.
  * @param {string} channel.instance - The instance portion of the channel namespace.
  * @param {string} channel.scope - The scope portion of the channel namespace.
  * @param {any} options - Not used at this point.
  */
 Script.removeChannel = function (channel, options) {
 
     var defaults = {
         category: null,
         className: null,
         instance: null,
         scope: null
     };
 
     defaults = Object.assign(defaults, channel);
 
     if (typeof defaults.category !== "string") {
         throw new TypeError("Category must be of type string. Found " + typeof defaults.category);
     }
 
     if (typeof defaults.className !== "string") {
         throw new TypeError("className must be of type string. Found " + typeof defaults.className);
     }
 
     if (typeof defaults.instance !== "string") {
         throw new TypeError("Instance must be of type string. Found " + typeof defaults.instance);
     }
 
     if (typeof defaults.scope !== "string") {
         throw new TypeError("Scope must be of type string. Found " + typeof defaults.scope);
     }
 
     var channelString = defaults.category + "/" + defaults.className + "/" + defaults.instance + "/" + defaults.scope;
 
     fw.func("REMOVE_CHANNEL", channelString);
 }
 
 
 
 /**
  * Returns the widgets state by running fw_state.
  * 
  * @param {string} widgetName
  * @returns {object} Returns an object containing all the parameters relevent to that widgets state.
  * if the widget does not support fw_state or does not return an object the function will return null.
  */
 Script.getWidgetState = function (widgetName) {
     if (parent === null || parent.widgets === null || parent.selScreenName === null) {
         throw new TypeError("This is restricted to widgets. Could not locate widgets.");
     }
 
     if (typeof widgetName !== "string" || widgetName === "") {
         throw new TypeError("widgetName must be of type string and not empty.");
     }
 
     var currentScreen = parent.selScreenName;
     var widgets = parent.widgets;
 
     if (widgets[widgetName].screen.toLowerCase() === currentScreen.toLowerCase()
         && typeof widgets[widgetName].defView.fw_state === "function") {
         var ret = widgets[widgetName].defView.fw_state();
         // Make sure returned value is correct datastructure.
         if (typeof ret === "object") {
             return ret;
         }
     }
 
     return null;
 }
 
 /**
  * Gets the document containing the given widget name.
  *
  * @param {string} widgetName - Widget name of the document you would like to retreive.
  *
  * @return {HTMLDocument} - Document of the given widget.
  */
 Script.getWidgetDOM = function (widgetName) {
     // Check input types
     if (typeof widgetName !== "string") {
         throw new TypeError("widgetName must be of type 'string', found'" + typeof widgetName + "'.");
     }
 
     // Check that the widget actually exists.
     if (typeof fw.func("GETWIDGETS") !== "undefined" && typeof fw.func("GETWODGETS")[widgetName].defView !== "undefined") {
         return fw.func("GETWIDGETS")[widgetName].defView.document;
     } else {
         throw new Error("Widget '" + widgetName + "' could not be found.");
     }
 };
 
 
 /**
  * Find a child of a given html template. This is mostly with a HTML template from another scripting widget.
  *
  * @param {HTMLElement} element - HTML to search through
  * @param {string} childID - ID of element to return
  * @return {HTMLElement} - HTMLElement with the given childID.
  */
 Script.findChildById = function (element, childID) // isSearchInnerDescendant <= true for search in inner childern
 {
     // Check input types.
     if (!(element instanceof HTMLElement)) {
         throw new TypeError("Element must be an instance of HTMLElement.");
     }
 
     if (typeof childID !== "string") {
         throw new TypeError("childID must be of type 'string'.");
     }
 
     var retElement = null;
     var lstChildren = _getAllDescendant(element);
 
     // Find element.
     for (var i = 0; i < lstChildren.length; i++) {
         if (lstChildren[i].id == childID) {
             retElement = lstChildren[i];
             break;
         }
     }
     return retElement;
 };
 
 
 // Helper function fror Script.findChildById
 function _getAllDescendant(element, lstChildrenNodes) {
     lstChildrenNodes = lstChildrenNodes ? lstChildrenNodes : [];
 
     var lstChildren = element.childNodes;
 
     for (var i = 0; i < lstChildren.length; i++) {
         if (lstChildren[i].nodeType === 1) // 1 is 'ELEMENT_NODE'
         {
             lstChildrenNodes.push(lstChildren[i]);
             lstChildrenNodes = _getAllDescendant(lstChildren[i], lstChildrenNodes);
         }
     }
 
     return lstChildrenNodes;
 }