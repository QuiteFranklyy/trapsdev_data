/**
 * Description: 
 * Create Author/Date: 
 * Modified Author/Date Date: 
 * Version: 
 */

/******************************************************************
				GLOBALS
******************************************************************/
var imageIndex;
var carouselIndex = 0;
var loaded = [];
var currentImage;
var camera_images;
var carouselPhotos;
var camname;
var offset = 0;
var video = false;
var filter = "ALL";

/******************************************************************
				FUNCTIONS
******************************************************************/
function create_popup() {
	var el = new Image();
	el.src = "../images/icons/bootstrap/camera-fill.svg";
	return el;
}

function map_array_to_carousel_obj(arr) {
	if (arr.length < 9) {
		throw new Error("Array too small");
	}
	var asso = (arr.length >= 10 ? arr[9]: "");
	var obj = {
		filename: arr[0],
		camname: arr[1],
		datetime: arr[2],
		viewed: arr[3],
		favourite: arr[4],
		deleted: arr[5],
		archive: arr[6],
		comments: arr[7],
		tags: arr[8],
		associated_video: asso,
		lat: arr[10],
		long: arr[11],
		account: arr[12]
	};
	return obj;
}

function dateChange(eventData, channel) {
	debugger;
	var start = Math.floor( Date.now() / 1000);
	var end = Math.floor(new Date(0).getTime() / 1000 );
	var obj = Script.getForm("DateFilter");
	var startDateArray = obj["Date#1"].split("-");
	var endDateArray = obj["Date#2"].split("-");
	if (obj["Date#2"] !== "") {
		end = Math.floor(new Date(endDateArray[0], endDateArray[1] - 1, endDateArray[2], 0).getTime() / 1000);
	}
	if (obj["Date#1"] !== "") {
		start = Math.floor(new Date(startDateArray[0], startDateArray[1] - 1, startDateArray[2], 24).getTime() / 1000);
	}
	var data = {};
	Object.keys(camera_images.data).forEach(function (key, index, array) {
		var datetime = camera_images.data[key][2];
		if (datetime <= start && datetime >= end) {
			data[key] = camera_images.data[key];
		}
	});
	var value = {
		data: data
	};
	Client.clearDirtyFlag();
	populate_carousel(value);
}

function get_carousel_images(camname, filter){
	ClientEvents.publish("iamge-set", "/images/blank.png");
	if (filter !== undefined) {
		filter = " AND " + filter;
	} else {
		filter = "";
	}
	Database.readRecords(
		"photos",
		"photos",
		function (dbResponse) {
			camera_images = dbResponse.value;
			populate_carousel(dbResponse.value);
		},
		{
			columns:"filename,camname,datetime,viewed,favourite,deleted,archive,comments,tags,associatedvideo,lat,long,account",
			// filter: "camname='"+camname+"' AND deleted=0 AND account='" + User.accountid + filter,
			filter: `camname='${camname}' AND deleted=0 AND account='${User.accountid}' ${filter}`,
			order: "ORDER BY datetime DESC"
		}
	);
}

function set_video(obj) {
	var loc = obj.camname.toUpperCase().replace(" ", "_");
	if (obj.associated_video === "") {
		 var i = parseInt(obj.filename.substr(obj.filename.length - 8, 4));
		 var j = i+2;
		 console.log(i, j);
		 var str = obj.filename.replace(i.toString(), j.toString());
		 ClientEvents.publish("iamge-set", str + ".MOV");
		//  ClientEvents.publish("iamge-set", "../userfiles/photo_processor/" +  obj.account + "/" + loc + "/" + str + ".MOV");
	} else {
		// ClientEvents.publish("iamge-set", "../userfiles/photo_processor/" + obj.account + "/" + loc + "/" + obj.associated_video);
		ClientEvents.publish("iamge-set", obj.associated_video);
	}
}

function populate_fields(obj) {
	// Will need to change this to look in right folder when updating to that build
	var cameraFolder = obj.camname.toUpperCase().replace(" ", "_");
	if (obj == undefined) {
		return;
	}
	if (obj.camname == undefined || obj.filename == undefined) {
		return;
	}
	if (video) {
		set_video(obj);
	} else {
		ClientEvents.publish("iamge-set", "../userfiles/photo_processor/" + obj.account + "/" + cameraFolder + "/" +obj.filename + "-preview.JPG");
	}
	ClientEvents.publish("image-viewer-map-clear", "", false);
	var content = create_popup();
	var loc = {lat: parseFloat(obj.lat), lng: parseFloat(obj.long)};
	ClientEvents.publish("image-viewer-map-receive", {id: obj.filename, loc: loc, content: content}, false);
	ClientEvents.publish("image-viewer-set-map", loc);
	ClientEvents.publish("image-viewer-map-set-zoom", 15);
	
	set_filename(obj.filename);
	var fav = (obj.favourite === "1" ? true : false);
	var arch = (obj.archive === "1" ? true : false);
	
	var datetime = new Date(parseInt(obj.datetime * 1000)).toLocaleString("en-AU").split(",");
	
	ClientEvents.publish("time-receive", datetime[1]);
	ClientEvents.publish("date-receive", datetime[0]);
	//ClientEvents.publish("customer-receive", "");
	//ClientEvents.publish("address-receive", "");
	ClientEvents.publish("camera-name-receive", obj.camname);

	set_favourite(fav);
	set_archive(arch);
	view_image(obj);
	set_tags(obj.tags);
	set_comments(obj.comments);
}

function populate_carousel(value){
	carouselPhotos = {};
	ClientEvents.publish("thumb-clear");
	loaded = [];
	
	imageIndex = 0;
	carouselIndex = 0;
	var keys = Object.keys(value.data);
	var len = keys.length;
	ClientEvents.publish("file-count-receive", len);
	ClientEvents.publish("file-index-receive", 1);
	keys.forEach(function (key, index) {
		// Add entry to carouselPhotos
		var data = map_array_to_carousel_obj(value.data[key]);
		var cameraFolder = data.camname.toUpperCase().replace(" ", "_");
		carouselPhotos[data.filename] = data;
		// Send to Image viewer
		if (index === 0) {
			populate_fields(data);
		}
		
		if (index < 10) {
			if (loaded.indexOf(data.filename) === -1) {
				loaded.push(data.filename);
			}
			var packet = {
				method: "append",
				src: "/userfiles/photo_processor/" + data.account + "/" + cameraFolder + "/" + data.filename + "-thumb.JPG",
				label: new Date(parseInt(data.datetime * 1000)).toLocaleString("en-AU").replace(",", ""),
			};
			ClientEvents.publish("thumb-receive", packet);
		}
	});
}

function view_image(obj) {
	debugger;
	var dbRec = {};
	dbRec.filename = obj.filename;
	dbRec.camname = obj.camname;
	// dbRec.customer = "";
	dbRec.viewed = "1";
	var dbReq = {};
	dbReq[obj.filename] = dbRec;
	Database.updateRecord("photos", "photos", dbReq, function (dbResponse) {
		if (dbResponse.value == 0) {
			Log.warn("Unable to update the viewed status of image. :(");
		}
		var options = {
			category: User.accountid.toUpperCase(),
			className: "TRAIL4G",
			instance: obj.camname,
			scope: "viewed",
			value: "1",
		};
		Script.publishToChannel(options);
	});
	//set_viewed(true);
}

function set_filename(name) {
	currentImage = carouselPhotos[name];
	ClientEvents.publish("filename-receive", name);
}

function set_favourite(fav) {
	if (fav === true) {
		ClientEvents.publish("favourite-receive", "star-fill");
		return;
	}
	ClientEvents.publish("favourite-receive", "star");
}

function favourite_image(img, favourite) {
	var dbRec = {};
	dbRec.filename = img;
	dbRec.favourite = (favourite === true ? 1 : 0);
	dbRec.camname = camname;
	dbRec.account = User.accountid;
	var dbReq = {};
	dbReq[img] = dbRec;
	Database.updateRecord("photos", "photos", dbReq, function (dbResponse) {
		var req = JSON.parse(dbResponse.usrmeta.order);
		var key = Object.keys(req)[0];
		var entry = req[key];
		if (dbResponse.value === 0) {
			System.status("Unable to favourite image '" + entry.filename + "'.");
			return;
		}
		carouselPhotos[entry.filename].favourite = "" + entry.favourite.toString();
		var favourite = (entry.favourite === 1 ? true : false);
		set_favourite(favourite);
	});
}

function set_archive(archived) {
	if (archived === true) {
		ClientEvents.publish("archive-receive", "archive-fill");
		return;
	}
	ClientEvents.publish("archive-receive", "archive");
}

function archive_image(img, camname, archived) {
	var dbRec = {};
	dbRec.filename = img;
	dbRec.archive = (archived === true ? 1 : 0);
	dbRec.camname = camname;
	dbRec.account = User.accountid;

	var dbReq = {};
	dbReq[img] = dbRec;
	Database.saveRecordParam("photos", "photos", dbReq, function (dbResponse) {
		 
		var req = JSON.parse(dbResponse.usrmeta.order);
		var key = Object.keys(req)[0];
		var entry = req[key];
		
		// this here wont ever work update records returns 1 if the record has been inserted, save records param actually returns the last database insrted id, database needs cleaning 
		//if (dbResponse.value === 0) {
		//	System.status("Unable to favourite image '" + entry.filename + "'.");
		//	return;
		//}
		carouselPhotos[entry.filename].archive = entry.archive.toString();
		var archived = (entry.archive === 1 ? true : false);
		set_archive(archived);
	});
	//set_archive(archived);
	//carouselPhotos[img][6] = (archived === true ? "1" : "0");
}

function download_image(img) {
	var camname = img.camname.toUpperCase().replace(" ", "_");
	var filename = img.filename;
	var vid_file = img.associated_video;
  var element = document.createElement('a');
	if (video) {
		if (vid_file === "") {
			return;
		}
		element.setAttribute('href', "../userfiles/photo_processor/" + img.account + "/" + camname + "/" + vid_file);
	} else {
		element.setAttribute('href', "/userfiles/photo_processor/" + img.account +  "/" + camname + "/" + filename + ".JPG");
	}
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

async function delete_image(img) {
	let res = await Client.confirm(`Are you sure you want to delete ${img}?`, "Delete Image", {confirmText: "Delete", cancelText: "Cancel"});
	if (res) {
		var dbRec = {};
		dbRec.filename = img;
		dbRec.deleted = 1;
		dbRec.camname = camname;
		dbRec.account = User.accountid;
		var dbReq = {};
		dbReq[img] = dbRec;
		Database.updateRecord("photos", "photos", dbReq, function (dbResponse) {
			 var req = JSON.parse(dbResponse.usrmeta.order);
			var key = Object.keys(req)[0];
			var entry = req[key];
			if (dbResponse.value === 0) {
				System.status("Unable to delete image '" + entry.filename + "'.");
				return;
			}
			//carouselPhotos[entry.filename].deleted = entry.deleted.toString();
			get_carousel_images(camname);
			//ClientEvents.publish("thumb-remove", carouselIndex);
			//delete carouselPhotos[entry.filename];
			//Client.status("Photo '" + img + "' deleted.", "IMPORTANT");
			//carouselIndex--;
			//imageIndex--;
			//populate_fields(carouselPhotos[Object.keys(carouselPhotos)[imageIndex]]);
		});
	}
}

function set_tags(tags) {
	ClientEvents.publish("tags-receive", tags);
}

function set_comments(comments) {
	ClientEvents.publish("comments-receive", comments);
}

/**
 * Initialise script state (run once at startup)
 */
Script.on('load', function() {
	
	ClientEvents.publish("video-receive", "camera-video");
	
	ClientEvents.subscribe("image-viewer-back-pressed", function(event) {
		Client.jumpToScreen("Traps Desktop");
	});
	
	ClientEvents.subscribe("image-viewer-start-date-change", dateChange);
	ClientEvents.subscribe("image-viewer-end-date-change", dateChange);
	
	//File Index Change
	ClientEvents.subscribe("file-index-change", function(eventData, channel) {
		Client.clearDirtyFlag();
		var index = parseInt(eventData.value) - 1;
		if (isNaN(index)) {
			console.error("index '" + eventData.value + "'could not be parsed to an integer");
			return;
		}
		if (index < 0) {
			console.error("index '" + eventData.value + "' is less than 0");
			return;
		}
		
		ClientEvents.publish("file-index-receive", index+1);
		
		var fileNames = Object.keys(carouselPhotos);
		// Clear all slides from carousel
		ClientEvents.publish("thumb-clear", "", false);
		loaded = [];
		
		var j = 0;
		for (var i = index - 15; i < index + 15; i++) {
			if (i < 0 || i > fileNames.length - 1) {
				continue;
			}
			if (loaded.indexOf(fileNames[i]) !== -1) {
				continue;
			}
			if (j < 15 && i < index) j++;
			var cameraFolder = carouselPhotos[fileNames[i]].camname.toUpperCase().replace(" ", "_");
			var packet = {
				method: "append",
				src: "/userfiles/photo_processor/" + carouselPhotos[fileNames[i]].account + "/" + cameraFolder + "/" + carouselPhotos[fileNames[i]].filename + "-thumb.JPG",
				label: new Date(parseInt(carouselPhotos[fileNames[i]].datetime * 1000)).toLocaleString("en-AU"),
			};
			ClientEvents.publish("thumb-receive", packet, false);
			loaded.push(fileNames[i]);
		}
		imageIndex = index;
		populate_fields(carouselPhotos[fileNames[imageIndex]]);
		ClientEvents.publish("thumb-goTo", j, false);
		//carouselIndex = 15;
	});
	
	// Filter Selected
	ClientEvents.subscribe("filter-selected", function (eventData, channel) {
		if (currentImage == undefined) {
			Client.alert("No images available to filter");
			return;
		}
		var camname = currentImage.camname;
		ClientEvents.publish("image-viewer-start-date-receive", "");
		ClientEvents.publish("image-viewer-end-date-receive", "");
		switch (eventData.value.toUpperCase()) {
			case "FAVOURITE":
				filter = "FAVOURITE";
				get_carousel_images(camname, "favourite=1");
				break;
			case "ARCHIVED":
				filter = "ARCHIVED";
				get_carousel_images(camname, "archive=1");
				break;
			case "NOT VIEWED":
				filter = "NOT VIEWED";
				get_carousel_images(camname, "viewed=0");
				break;
			case "ALL":
				filter = "ALL";
				ClientEvents.publish("filter-reset");
				get_carousel_images(camname);
				break;
			default:
				console.error("unknown option");
				break;
		}
	});
	
	// Clear Button Pressed
	ClientEvents.subscribe("clear-pressed", function (eventData, channel) {
		ClientEvents.publish("tags-receive", "");
		ClientEvents.publish("comments-receive", "");
		System.dirtyFlag("set");
	});
	
	// Download Pressed
	ClientEvents.subscribe("download-pressed", function (eventData, channel) {
		download_image(currentImage);
	});
	
	// Favourite Pressed
	ClientEvents.subscribe("favourite-pressed", function (eventData, channel) {
		 
		var fav = (currentImage.favourite === "1" ? true : false );
		favourite_image(currentImage.filename, !fav);
	});
	
	// Archive Pressed
	ClientEvents.subscribe("archive-pressed", function (eventData, channel) {
		 
		var archived = currentImage.archive;
		archived = (archived === "1" ? true : false);
		archive_image(currentImage.filename, currentImage.camname, !archived);
	});
	
	// Delete Pressed
	ClientEvents.subscribe("delete-pressed", function (eventData, channel) {
		delete_image(currentImage.filename);
	});
	
	// Save Pressed
	ClientEvents.subscribe("save-pressed", function (eventData, channel) {
		
		var formData = Script.getForm("image-tagging");
		var dbRec = {};
		dbRec.filename = currentImage.filename;
		dbRec.camname = camname;
		dbRec.account = User.accountid;
		dbRec.tags = formData["image-tags"];
		dbRec.comments = formData["image-comments"];
		var dbReq = {};
		dbReq[currentImage.filename] = dbRec;
		Database.updateRecord("photos", "photos", dbReq, function (dbResponse) {
			 
			var req = JSON.parse(dbResponse.usrmeta.order);
			var key = Object.keys(req)[0];
			var entry = req[key];
			if (dbResponse.value === 0) {
				System.status("Unable to save comments and tags for image '" + entry.filename + "'.");
				return;
			}
			Client.clearDirtyFlag();
			carouselPhotos[entry.filename].comments = entry.comments;
			carouselPhotos[entry.filename].tags = entry.tags;
		});
	});
	
	// Refresh Pressed
	ClientEvents.subscribe("refresh-pressed", function (eventData, channel) {
		ClientEvents.publish("table-clear");
		get_table_entries();
	});
	
	// Table Pressed
	ClientEvents.subscribe("table-pressed", function (eventData, channel) {
		// Request entries for carousel
		ClientEvents.publish("filter-reset");
		var key = Object.keys(eventData.value.data)[0];
		get_carousel_images(eventData.value.data[key][1]);
	});
	
	// Carousel Thumbnail Pressed
	ClientEvents.subscribe("thumb-pressed", function (eventData, channel) {
		var filename = eventData.value.src.split("/").pop().replace("-thumb.JPG", "");
		imageIndex = Object.keys(carouselPhotos).indexOf(filename);
		populate_fields(carouselPhotos[filename]);
		ClientEvents.publish("file-index-receive", imageIndex+1);
	});
	
	//Thumbnail Changed
	ClientEvents.subscribe("thumb-changed", function (eventData, channel) {
		if (eventData.value.method === "goto") {
			return;
		}
		var direction = (eventData.value.direction === "right" ? "append" : "prepend");
		imageIndex += eventData.value.step;
		//if (eventData.value.method !== "swipe") {
		//	carouselIndex += event.value.step;
		//}
		
		var fileNames = Object.keys(carouselPhotos);
		var packet;
		for (var i = imageIndex; i > imageIndex - 15; i--) {
			if (i < 0 || i > fileNames.length - 1) {
				continue;
			}
			if (loaded.indexOf(fileNames[i]) !== -1) {
				continue;
			}
			var cameraFolder = carouselPhotos[fileNames[i]].camname.toUpperCase().replace(" ", "_");
			packet = {
				method: direction,
				src: "../userfiles/photo_processor/" + carouselPhotos[fileNames[i]].account + "/" + cameraFolder + "/" + carouselPhotos[fileNames[i]].filename + "-thumb.JPG",
				label: new Date(parseInt(carouselPhotos[fileNames[i]].datetime * 1000)).toLocaleString("en-AU"),
			};
			ClientEvents.publish("thumb-receive", packet, false);
			loaded.push(fileNames[i]);
			carouselIndex++;
		}
		
		for (i = imageIndex; i < imageIndex + 15; i++) {
			
			if (i < 0 || i > fileNames.length -1) {
				continue;
			}
			if (loaded.indexOf(fileNames[i]) !== -1) {
				continue;
			}
			var cameraFolder = carouselPhotos[fileNames[i]].camname.toUpperCase().replace(" ", "_");
			packet = {
				method: direction,
				src: "../userfiles/photo_processor/" +carouselPhotos[fileNames[i]].account + "/" + cameraFolder + "/" + carouselPhotos[fileNames[i]].filename + "-thumb.JPG",
				label: new Date(parseInt(carouselPhotos[fileNames[i]].datetime * 1000)).toLocaleString("en-AU"),
			};
			ClientEvents.publish("thumb-receive", packet, false);
			loaded.push(fileNames[i]);
		}
		if (eventData.value.method !== "swipe") {
			ClientEvents.publish("file-index-receive", parseInt(imageIndex) + 1);
			populate_fields(carouselPhotos[fileNames[imageIndex]]);
		}
	});
	
	 ClientEvents.subscribe("video-pressed", function(eventData, channel) {
		 var photo = currentImage;
		 var cameraFolder = photo.camname.toUpperCase().replace(" ", "_");
		 if (video) {
			 video = !video;
			 ClientEvents.publish("video-receive", "camera-video");
			 ClientEvents.publish("iamge-set", "../userfiles/photo_processor/" + photo.account + "/" + cameraFolder + "/" + photo.filename + "-preview.JPG");
		 } else {
			 video = !video;
			 ClientEvents.publish("video-receive", "camera-video-fill");
			 set_video(photo);
		 }
	 });
	
	// ImageViewer Next
	ClientEvents.subscribe("next-pressed", function(eventData, channel) {
		//imageIndex++;
		//populate_fields(carouselPhotos[Object.keys(carouselPhotos)[imageIndex]]);
		ClientEvents.publish("thumb-next");
	});
	
	// ImageViewer Previous
	ClientEvents.subscribe("previous-pressed", function(eventData, channel) {
		//imageIndex--;
		//populate_fields(carouselPhotos[Object.keys(carouselPhotos)[imageIndex]]);
		ClientEvents.publish("thumb-previous");
	});
	
	ClientEvents.subscribe("date-filter-reset-pressed", function(eventData, channel) {
		ClientEvents.publish("image-viewer-end-date-receive", "");
		ClientEvents.publish("image-viewer-start-date-receive", new Date().toISOString().split("T")[0]);
		dateChange();
	});
	
	// Request data for carousel
	ClientEvents.publish("image-viewer-start-date-receive", new Date().toISOString().split("T")[0]);
	camname = Script.getState("camera_name");
	if (camname) {
		ClientEvents.publish("image-viewer-camera-name-receive", camname);
		camname = camname.toLowerCase();
		get_carousel_images(camname);
	}
	
	Script.subscribeToChannel(
		"IMAGE_VIEWER_TRAP_SUBURB",
		{
			category: User.accountid.toUpperCase(),
			className: "Trail4G",
			scope: "suburb"
		}, function(e) {
		});
});

/**
 * Response to message from server channel
 */
Script.on('server', function(eventData, channel) {
});