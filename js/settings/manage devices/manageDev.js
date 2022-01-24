/**
 * Description: Script to manage Sensahub devices
 * Create Author/Date: Dean Dobson 6/6/20
 * Modified Author/Date: DD 27/9/20
 * Version: 1.2 Changed options to after callback
 */

var distribs = [];
var selectedDistrib = "";
var selectedModel = "";
var selectedRec = "";
var currUser;
var selectedAttribKey = "";
var modelAttribs = ""; // Default model attribs
var devAttribs = ""; // Hold the device attribs
var modelDefaults = "";
var modelURL = "";
var recLong = 0;
var recLat = 0;
var existingRecs = []; // List of records for model
var existingNames = []; // List of record names (must be unique)
var oldName;
var recStatus;
var accMap = {};
var locale = Client.getLocale();
var allData;

// TODO Get the account names
// TODO: Multiple select / delete in the table (only for delete, how do we edit records multi-selected???
//TODO: device attributes
//TODO: Store the API key for M2M lookup with Distributor table

Script.on("init", function () {
	Client.setScreenVisible("New User", false);
	Client.setScreenVisible("New Account", false);
	Client.setScreenVisible("Account Details", false);
	Client.setScreenVisible("User Details", false);
});

/**
 * Initialise script state (run once at startup)
 */
Script.on("load", function () {
	ClientEvents.setOptions({
		persist: false,
	});

	// Get the distributor and model names
	Client.getTenants(function (data) {
		distribs = data.value;
		selectedDistrib = distribs[0];

		ClientEvents.publish("DevDistribList", distribs); // Update the distributor name dropdown

		loadModelForm();
	});

	currUser = Client.getUser();

	Database.readRecords("directory", "account", function (eventData) {
		var accountCollection = SensaCollection.load(eventData.value);
		var accountCol = accountCollection.filter(["accountid", "accountname"]);
		accountCol.setColumns(["value", "text"]);
		var accountDrop = Script.getWidget("DevAccount");
		accountDrop.receiveTextValues(accountCol);
		accMap = accountCol;
	});
});

// Load model into form based on selected distributor
function loadModelForm() {
	Devices.manageModels(
		"read",
		selectedDistrib,
		"",
		async function (data) {
			var models = Object.keys(data.value.data);
			if (models.length === 0) {
				await Client.alert("There are no models registered, go to the 'Manage Models' screen to initially create a device model template to use for creating Sensahub devices, then return here to add devices.", "No Models Defined");
			}
			clearRec();
			ClientEvents.publish("clear", "");
			ClientEvents.publish("DevRecvModels", models); // Update the model name dropdown
			ClientEvents.publish("DevDelAllRows", "");
			if (models.length !== 0) {
				Devices.manageModels(
					"read",
					selectedDistrib,
					"",
					function (data) {
						var retData = data.value.data;
						selectedModel = Object.keys(retData)[0];
						populateModelFields(retData[selectedModel]);
						// Load the entire record for the selected model into the table
						Devices.manageDevices(
							"read",
							selectedDistrib,
							selectedModel,
							function (data) {
								allData = data.value;
								populateTable(data.value);
							},
							{ columns: "*" }
						);
					},
					{ columns: "*", filter: "model='" + models[0] + "'" }
				);
			}
		},
		{ columns: "model" }
	);
}

/**
 * Response to message from server channel
 */
Script.on("server", function (eventData) { });

// New distributor selected
ClientEvents.subscribe("DevDistribSelected", async function (selected) {
	if (Client.checkDirtyFlag()) {
		let res = await Client.confirm(
			"Items on this form have changed, please confirm that you want to select a new distributor and ignore changes to the form.",
			"Confirm Changing Record"
		);
		if (res) {
			selectedDistrib = selected.value;
			loadModelForm();
		}
	} else {
		selectedDistrib = selected.value;
		loadModelForm();
	}
});

// When an input field has changed, set the dirty flag so users get a warning if they move away
ClientEvents.subscribe("changed", function () {
	Client.setDirtyFlag();
});

// Clear button - reset to model defaults
ClientEvents.subscribe("DevReset", async function () {
	if (Client.checkDirtyFlag()) {
		let res = Client.confirm(
			"Changes have been made to the form that will be deleted if cleared, please confirm you want to clear the form.",
			"Clear Record"
		);
		if (res) {
			populateModelFields(modelDefaults);
		}
	} else {
		clearRec();
		populateModelFields(modelDefaults);
	}
});

// Save device button
ClientEvents.subscribe("DevSave", async function () {
	var formData = Script.getForm("DevForm");
	var oldRec = selectedRec;
	selectedRec = formData.DevSerial;
	// if existing record needs to be unique not including itself, or if a new record has to be unique
	if (
		formData.DevName === "" ||
		existingNames.indexOf(formData.DevName.toUpperCase()) === -1 ||
		(oldRec.toUpperCase() === selectedRec.toUpperCase() && formData.DevName.toUpperCase() === oldName.toUpperCase())
	) {
		saveRecs(formData);
	} else {
		await Client.alert("Can't save device '" + selectedRec + "' as device name '" + formData.DevName + "' isn't unique.", "Save Device");
	}
});

// Delete device button
ClientEvents.subscribe("DevDelRec", async function () {
	var formData = Script.getForm("devForm");
	selectedRec = formData.DevSerial;
	if (selectedRec !== "") {
		if (formData.DevModel !== "") {
			Client.status("Deleting device '" + selectedRec + "' (" + formData.DevModel + ")...", "IMPORTANT");
			let res = await Client.confirm(
				"Please confirm that you want to delete device '" + selectedRec + "' (" + formData.DevModel + ").",
				"Confirm Delete",
				{ confirmText: "Delete" }
			);
			if (res) {
				Client.status("Deleting device '" + selectedRec + "'...");
				Devices.manageDevices(
					"delete",
					selectedDistrib,
					selectedModel,
					async function (data) {
						if (data.value > 0) {
							Client.clearDirtyFlag();
							Client.status("Device '" + selectedRec + "' deleted.", "IMPORTANT");
							// Delete device channels
							Log.info("Deleting associated device channels");
							Devices.deleteDeviceChannels(selectedDistrib, selectedModel, formData.DevName, function () {
								// Do something?
							});

							// refresh the table
							Devices.manageDevices(
								"read",
								selectedDistrib,
								selectedModel,
								function (data) {
									populateTable(data.value);
								},
								{ columns: "*" }
							);
							populateModelFields(modelDefaults);
						} else {
							await Client.alert("Device template '" + selectedRec + "' didn't delete correctly. Please check input.", "Delete Record");
							Client.status(
								"WARNING - Device template '" + selectedRec + "' didn't delete correctly. Please check input.",
								"IMPORTANT"
							);
						}
					},
					{ columns: "serialnum", filter: "'" + selectedRec + "'" }
				);
			}
		} else {
			Client.status(
				"WARNING - Can't perform device delete, no model selected, create a device model template before adding devices...",
				"IMPORTANT"
			);
			await Client.alert(
				"Can't perform device delete, no model selected, create a device model template before adding devices.",
				"Confirm Delete"
			);
		}
	} else {
		Client.status(
			"WARNING - Can't perform device delete, no device selected, select a device name from the table and try again....",
			"IMPORTANT"
		);
		await Client.alert("Can't perform device delete, no device selected, select a device name from the table and try again", "Confirm Delete");
	}
});

// Selected model
ClientEvents.subscribe("DevModelSel", async function (selected) {
	if (Client.checkDirtyFlag()) {
		let res = await Client.confirm(
			"Items on this form have changed, please confirm that you want to select a new model and ignore changes to the form.",
			"Confirm Changing Model"
		);
		if (res) {
			selectedModel = selected.value;
			ClientEvents.publish("clear", "");
			Client.clearDirtyFlag();
		} else {
			ClientEvents.publish("DevModNameUpd", selectedModel); // Select old record
		}
	} else {
		selectedModel = selected.value;
		ClientEvents.publish("clear", "");
		// Get the  model fields from the selected model and populate the form as a default
		Devices.manageModels(
			"read",
			selectedDistrib,
			"",
			function (data) {
				var retData = data.value.data;
				populateModelFields(retData[Object.keys(retData)[0]]);
				// Load the entire record for the selected model into the table
				Devices.manageDevices(
					"read",
					selectedDistrib,
					selectedModel,
					function (data) {
						allData = data.value;
						populateTable(data.value);
					},
					{ columns: "*" }
				);
			},
			{ columns: "*", filter: "model='" + selected.value + "'" }
		);
	}
});

// Selected device from table
ClientEvents.subscribe("DevTableSelected", async function (selected) {
	if (Client.checkDirtyFlag()) {
		let res = Client.confirm("Items on this form have changed, please confirm that you want to select a new model and ignore changes to the form.", "Confirm Changing Record");
		//TODO: Can consolidate this with the other confirms for changing record.
		if (res) {
			selectedModel = selected.value;
			ClientEvents.publish("clear", "");
			Client.clearDirtyFlag();
		} else {
			ClientEvents.publish("DevModNameUpd", selectedModel); // Select old record
		}
	} else {
		selectedRec = Object.keys(selected.value.data)[0];
		Devices.manageDevices(
			"read",
			selectedDistrib,
			selectedModel,
			function (data) {
				var retData = data.value.data;
				// Populate a selected template based on the initial value
				if (data.usrmeta.columns === "*" && data.usrmeta.filter != "") {
					populateDeviceFields(retData[Object.keys(retData)[0]]);
				} else {
					// Read all records to send to table (but not the model data)
					if (data.usrmeta.columns !== "model") {
						populateTable(eventData.value);
					}
				}
			},
			{ columns: "*", filter: "serialnum='" + selectedRec + "'" }
		);
		ClientEvents.publish("DevSerialSetVal", selectedRec);
		ClientEvents.publish("DevTableSelRowInp", selectedRec);
	}
});

// Attrib save button pressed
ClientEvents.subscribe("DevSaveAttrib", async function (value) {
	await Client.alert("Not available yet.", "Update Key");
	return;
	var formData = Script.getForm("AttribForm");
	var tableAttribs = formData.DevAttribs;
	if (typeof selectedAttribKey !== "undefined" && selectedAttribKey !== "") {
		tableAttribs.data[selectedAttribKey] = [selectedAttribKey, formData.DevAttribVal];
		devAttribs.data[selectedAttribKey] = [selectedAttribKey, formData.DevAttribVal];
		ClientEvents.publish("DevAttribsSetValues", tableAttribs);
		Client.status("Attribute '" + selectedAttribKey + "' updated.");
		ClientEvents.publish("DevValueSetVal", "");
		selectedAttribKey = ""; // reset, user has to select another attrib
		Client.setDirtyFlag();
	} else {
		Client.alert("No attribute has been updated due to no attribute being selected. Click on an attribute in the table to select it.", "Update Key");
	}
});

// Row in attrib table selected event
ClientEvents.subscribe("DevAttribSelected", function (selected) {
	selectedAttribKey = Object.keys(selected.value.data)[0];
	ClientEvents.publish("DevValueSetVal", selected.value.data[selectedAttribKey][1]);
});

// Clear the record back to defaults
function clearRec() {
	ClientEvents.publish("DevSerialSetVal", "");
	ClientEvents.publish("DevNameSetVal", "");
	ClientEvents.publish("DevLastServicedSetVal", "");
	ClientEvents.publish("DevICCIDSetVal", "");
	ClientEvents.publish("DevIMEISetVal", "");
	ClientEvents.publish("DevNumberSetVal", "");
	ClientEvents.publish("DevAddedSetVal", "--");
	ClientEvents.publish("DevModSetVal", "--");
	ClientEvents.publish("DevBattlevelSetVal", "--");
	ClientEvents.publish("DevSignalSetVal", "--");
	ClientEvents.publish("DevTotConnSetVal", "--");
	ClientEvents.publish("DevLastValSetVal", "--");
	ClientEvents.publish("DevLastSeenSetVal", "--");
	selectedRec = "";
}

// Main table
function populateTable(collection) {
	//TODO: remap column names to more friendly
	existingRecs = [];
	existingNames = [];
	Object.keys(collection.data).forEach(function (item) {
		switch (collection.data[item][9]) {
			case "0":
				collection.data[item][9] = "Disabled";
				break;
			case "1":
				collection.data[item][9] = "Enabled";
				break;
			case "2":
				collection.data[item][9] = "Inactive";
				break;
		}
		collection.data[item][13] = convertDateTime(+collection.data[item][13] * 1000);
		existingNames.push(collection.data[item][1]);
		existingRecs.push(item.toUpperCase()); // For testing if new record
	});
	ClientEvents.publish("DevDelAllRows", ""); // Clear table first
	ClientEvents.publish("DevSetValues", collection);
	//if (selectedRec !== "") { // Once table has been reloaded, select the record previously selected to highlight it
	//	ClientEvents.publish("DevTableSelRowInp", selectedRec);
	//}
}

function convertDateTime(dateTime) {
	if (dateTime == 0) {
		return "never";
	} else {
		return new Date(dateTime).toLocaleDateString(locale) + " " + new Date(dateTime).toLocaleTimeString(locale);
	}
}

// Save form to database
async function saveRecs(formData) {
	if (selectedRec !== "") {
		if (formData.DevModels !== "") {
			var currDate = Date.now();
			var dbRec = {};
			Client.status("Saving device details for '" + formData.DevSerial + "' (" + formData.DevModel + ")...");
			if (formData.DevStatus === "Enabled" && status !== 1) {
				dbRec.whoenabled = currUser;
				dbRec.whenenabled = currDate;
			}
			if (formData.DevStatus === "Disabled" && status !== 0) {
				dbRec.whodisabled = currUser;
				dbRec.whendisabled = currDate;
			}
			var status = 0;
			switch (formData.DevStatus) {
				case "Enabled":
					status = 1;
					break;
				case "Inactive":
					status = 2;
					break;
			}

			// Populate a dbRequest object to send to server
			dbRec.serialnum = formData.DevSerial;
			dbRec.name = formData.DevName;
			dbRec.account = formData.DevAccount;
			dbRec.version = formData.DevVersion;
			dbRec.groupname = formData.DevGroup;
			dbRec.iccid = formData.DevICCID;
			dbRec.imei = formData.DevIMEI;
			dbRec.number = formData.DevNumber;
			dbRec.apn = formData.DevAPN;
			dbRec.branch = formData.DevBranch;
			dbRec.department = formData.DevDepartment;
			dbRec.location = formData.DevLocation;
			dbRec.application = formData.DevApplication;
			dbRec.lastserviced = formData.DevLastServiced;
			dbRec.status = status;
			dbRec.owner = formData.DevOwner;
			dbRec.notes = formData.DevNotes;
			dbRec.whenmodified = currDate;
			dbRec.whomodified = currUser;
			if (existingRecs.indexOf(selectedRec.toUpperCase()) === -1) {
				// New record
				dbRec.whenadded = currDate;
				dbRec.whoadded = currUser;
			}
			// Get attribs
			//dbRec.attribs = JSON.stringify(devAttribs);
			var dbReq = {};
			dbReq[formData.DevSerial] = dbRec;
			Devices.manageDevices(
				"save",
				selectedDistrib,
				formData.DevModel,
				async function (data) {
					if (data.value > 0) {
						Client.clearDirtyFlag();
						Client.status("Device '" + selectedRec + "' (" + selectedModel + ") saved.");

						// Check if account is different. If so delete all device channels
						// Get prev device
						var oldData = allData.get(formData.DevSerial);

						// If account has changed delete all previous channels
						if (oldData && formData.DevAccount !== oldData.account) {
							Log.info(`Device moved between accounts. Deleting old channels for device '${formData.DevSerial}'`);
							Devices.deleteDeviceChannels(selectedDistrib, selectedModel, formData.DevName, function () {
								Log.info(`Channels deleted.`);
							});
						}

						// Refresh table for changes
						Devices.manageDevices(
							"read",
							selectedDistrib,
							selectedModel,
							function (data) {
								populateTable(data.value);
								allData = data.value;
							},
							{ columns: "*" }
						);
						Client.clearDirtyFlag();
					} else {
						await Client.alert("Device template '" + selectedRec + "' didn't save correctly. Please check input.", "Save Record");
						Client.status("WARNING - Device template '" + selectedRec + "' didn't save correctly. Please check input.", "IMPORTANT");
					}
				},
				{ data: dbReq }
			);
		} else {
			Client.status(
				"WARNING - No model name specified. Please select a device model name and enter a unique device ID like a serial number.",
				"IMPORTANT"
			);
			await Client.alert("No model name specified. Please select a device model name and enter a unique device ID like a serial number.", "New or Update Device");
		}
	} else {
		Client.status("WARNING - No unique ID specified. Please select a device model name and enter a unique device ID like a serial number or select a table record.", "IMPORTANT");
		await Client.alert("No unique ID specified. Please select a device model name and enter a unique device ID like a serial number or select a table record.", "New or Update Device");
	}
}

// populate the widget fields from model template data returned from server (when selecting a new device)
function populateModelFields(coll) {
	clearRec();
	ClientEvents.publish("clear", "");
	//if (typeof coll !== "undefined") {
	const newForm = {};
	newForm.app = coll[1];
	newForm.make = coll[2];
	newForm.ver = coll[3];
	newForm.loc = coll[4];
	newForm.group = coll[5];
	newForm.branch = coll[6];
	newForm.dept = coll[7];

	ClientEvents.publish("DevSetImage", "../images/devices/" + selectedDistrib + "/" + coll[8]);
	
	var recStatus = "Disabled";
	switch (coll[9]) { // Status
		case "1":
			recStatus = "Enabled";
			break;
		case "2":
			recStatus = "Inactive";
			break;
	}
	newForm.status = recStatus;
	// get account name from id 
	let matchingAcct = accMap.query((record,pk) => pk == coll[10]).getColumn('text');
	newForm.acct = matchingAcct.length > 0 ? matchingAcct[0] : coll[10];
	newForm.owner = coll[12];
	newForm.type = coll[13];
	newForm.apn = coll[14];

	Script.setForm("DevForm", newForm);

	modelURL = coll[15];
	//ClientEvents.publish("DevValueSetVal","");
	/*	if (coll[14] !== "null" && coll[14] !== "") { // Custom attribs
             var currAttribs = JSON.parse(coll[14]);
             if (currAttribs && currAttribs.value) {
                 ClientEvents.publish("DevAttribsSetValues",currAttribs.value);
                 modelAttribs = currAttribs.value;
             }
         }*/
	modelDefaults = coll;
	//} else {
	//	alert("Can't populate model fields as record is blank");
	//}
}

// populate the widget fields from device data returned from server
function populateDeviceFields(coll) {
	const newForm = {};
	newForm.name = coll[1];
	newForm.app = coll[2];
	newForm.ver = coll[3];
	newForm.lastSer = coll[4];
	newForm.loc = coll[5];
	newForm.group = coll[6];
	newForm.dept = coll[7];
	newForm.branch = coll[8];
	oldName = coll[1];

	var recStatus = "Disabled";
	// Status
	switch (coll[9]) {
		case "1":
			recStatus = "Enabled";
			break;
		case "2":
			recStatus = "Inactive";
			break;
	}
	newForm.status = recStatus;
	// var drop = Script.getWidget("TempAccount");
	// drop.receiveTextValues(accMap.filter(["value", "text"], [coll[10]]));
	let matchingAcct = accMap.query((record,pk) => pk == coll[10]).getColumn('text');
	newForm.acct = matchingAcct.length > 0 ? matchingAcct[0] : coll[10];
	newForm.owner = coll[11];
	newForm.notes = coll[12];
	newForm.iccid = coll[14];
	newForm.imei = coll[15];
	newForm.apn = coll[16];
	newForm.cell = coll[17];

	Script.setForm("DevForm", newForm);

	ClientEvents.publish("DevLastSeenSetVal", convertDateTime(+coll[13] * 1000));

	if (coll[18] === "") {
		ClientEvents.publish("DevLastValSetVal", "--");
	} else {
		ClientEvents.publish("DevLastValSetVal", coll[18]);
	}
	ClientEvents.publish("DevTotConnSetVal", coll[19]);
	ClientEvents.publish("DevAddedSetVal", convertDateTime(+coll[20]));
	// Who added 21
	ClientEvents.publish("DevModSetVal", convertDateTime(+coll[22]));
	// WHo modified 23
	// WHen disabled 24
	// Who disabled 25
	// When enabled 26
	// WHo enabled 27
	recLong = coll[28];
	recLat = coll[29];
	ClientEvents.publish("DevSignalSetVal", coll[30]);
	ClientEvents.publish("DevBattLevelSetVal", coll[31]);
	ClientEvents.publish("DeleteAttribs", "");
	//ClientEvents.publish("DevAttribsSetValues",modelAttribs); // Reset to default attribs
	//if (coll[32] !== "null" && coll[32] !== "") { // Custom attribs
	//	devAttribs = JSON.parse(coll[32]);
	//	ClientEvents.publish("DevAttribsSetValues",devAttribs);
	//}
}

ClientEvents.subscribe("DevLaunchURL", async function () {
	if (modelURL !== "") {
		Client.launchTabURL(modelURL);
	} else {
		if (selectedModel === "") {
			selectedModel = "No Model Selected";
		}
		await Client.alert("No URL has been specified for the model '" + selectedModel + "'. Edit the model template and enter in the relevant manufacturer URL.", "Get Model Help");
	}
});

ClientEvents.subscribe("DevLaunchMap", async function () {
	if (recLong !== 0 && recLat !== 0) {
		Client.launchTabURL("https://maps.google.com/maps?t=m&q=" + recLat + "+" + recLong);
	} else {
		if (selectedRec === "") {
			selectedRec = "No Device Selected";
		}
		await Client.alert("This device '" + selectedRec + "' has not registered a GPS location, map can't be shown.", "Lookup Device Location");
	}
});

