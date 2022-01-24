/**
 * Description: 
 * Create Author/Date: 
 * Modified Author/Date Date: 
 * Version: 
 */

/**
 * Initialise script state (run once at startup)
 */

 var dataCollection = new SensaCollection(
	[
		"thumbnail",
		"camera name",
		"datetime",
		"viewed",
		"battery",
		"signal"
	],
	"camera name"
);
function get_table() {
	Database.readRecords(
		"photos",
		"photos",
		function (dbResponse) {
			var key = Object.keys(dbResponse.value.data)[0];
			var camName = String(dbResponse.value.data[key][1]);
			populate(dbResponse.value);
		},
		{
			columns: "filename,camname,datetime,viewed,account",
			filter: "deleted=0 AND account=" + User.accountid,
			order: "GROUP BY camname HAVING datetime=MAX(datetime) ORDER BY datetime DESC",
		}
	);
}

function populate(value){
	var collection = new SensaCollection(
		[
			"thumbnail",
			"camera name",
			"datetime",
			"viewed"
		],
		"camera name"
	);
	// add thumbnail column to headers
	value.headers.unshift("thumbnail");
	var index = value.headers.indexOf("camname");
	if (index === -1) {
		return;
	}
	value.headers[index] = "camera name";
	value.pk = "camera name";
	
	// rebuild data packet
	Object.keys(value.data).forEach(function (item) {
		// convert from Unix time
		value.data[item][2] = new Date(parseInt(value.data[item][2] * 1000)).toLocaleString("en-AU");
		// Create thumbnail
		var img = new Image();
		img.style.setProperty("width", "100%");
		img.style.setProperty("height", "auto");
		img.src = "../userfiles/photo_processor/" + value.data[item][4] + "/" + value.data[item][1].toUpperCase().replace(" ", "_") + "/" + item.split(".")[0] +"-thumb.JPG";
		
		//value.data[item][1] = value.data[item][1].toUpperCase();
		
		value.data[item].unshift(img.outerHTML);
		// Create viewed icon
		var viewedImg = new Image();
		viewedImg.style.setProperty("width", "35%");
		viewedImg.style.setProperty("height", "auto");
		viewedImg.style.setProperty("margin-left", "calc(50% - 17.5%)");
		if (value.data[item][4] === "0") {
			viewedImg.src = "../images/icons/bootstrap/eye-fill.svg";
		} else {
			viewedImg.src = "../images/icons/bootstrap/eye.svg";
		}
		value.data[item][4] = viewedImg.outerHTML;
		
		/*// Create favourite image
		var favImg = new Image();
		favImg.style.setProperty("width", "35%");
		favImg.style.setProperty("height", "auto");
		favImg.style.setProperty("margin-left", "calc(50% - 17.5%)");
		if (value.data[item][5] === "1") {
			favImg.src = "../images/icons/bootstrap/star-fill.svg";
		} else {
			favImg.src = "../images/icons/bootstrap/star.svg";
		}
		value.data[item][5] = favImg.outerHTML;
		*/
		value.data[item].splice(1, 1);
		value.data[item][1] = value.data[item][1].toLowerCase();
		var dataObj = {
			"thumbnail" : value.data[item][0],
			"camera name": value.data[item][1],
			"datetime": value.data[item][2],
			"viewed": value.data[item][3]
		};
		collection.add(dataObj);
	});
	dataCollection = dataCollection.merge(collection);
	ClientEvents.publish("camera-table-receive", dataCollection, false);
}

Script.on('load', function() {
	
	// Clear table
	ClientEvents.publish("camera-table-clear");
	
	ClientEvents.subscribe("camera-table-refresh-pressed", function (eventData, channel) {
		get_table();
	});
	
	ClientEvents.subscribe("camera-table-pressed", function (eventData, channel) {
		var key = Object.keys(eventData.value.data)[0];
		Script.setState("camera_name", eventData.value.data[key][1]);
		Client.jumpToScreen("Image Viewer");
	});
	get_table();
});

Script.on("server", function(e, c) {
	var value = null;
	if (e.value instanceof SensaCollection) {
		value = e.value;
	} else if (typeof e.value === "string") {
		value = JSON.parse(e.value);
	} else if (value == null) {
		return;
	}
	switch(c.split("/")[0]) {
		case User.accountid.toUpperCase():
			if (!Array.isArray(value.headers)) {
				break;
			}
			var pkIndex = value.headers.indexOf("instance");
			if (pkIndex === -1) {
				break;
			}
			value.headers[pkIndex] = "camera name";
			
			value.headers = value.headers.map(function (item) {return item.toLowerCase();});
			var collection = SensaCollection.load(value);
			
			collection = collection.filter(["camera name", "battery", "signal"]);
			collection.pk = "camera name";
			collection.forEach(function(item, key) {
				item["camera name"] = item["camera name"].toLowerCase();
				if (item.battery) {
					item.battery = item.battery && (item.battery !== "") ? item.battery += "%" : "-";
				}
				if (item.signal) {
					item.signal = item.signal && (item.signal !== "") ? item.signal += "%" : "-";
				}
				collection.add(item);
				collection.remove(key);
			});
			dataCollection = dataCollection.merge(collection);
			ClientEvents.publish("camera-table-receive", dataCollection, false);
			break;
			
	}
});