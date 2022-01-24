// Interface layer between user script functions and Sensahub framework API. Version 1.1
var Script = {};
var Database = {};
var Directory = {};
var System = {};
var User = {
    accountid: null
};

var _flowMsg;
var _loaded;
var _scriptName;

//TODO: Can be minimised for performance

/**
 * The event driver for Scripting that response to the server events.
 * @param eventType {String} The event to attach to.
 *      "load": Ran once the server has finished starting up.
 *      "Flow": When a new message is received in the flow.
 * @param call {Function} Function to run when the event occurs.
 */
Script.on = function (eventType, call) {
    switch (eventType.toUpperCase()) {
        case "LOAD":
            _loaded = call;
            break;
        case "FLOW":
            _flowMsg = call;
            break;
    }
};


/**
 * Save a variable in the Scripting state store similar to a dictionary.
 * @param {string} namespace
 * @param {string} value
 * @returns {string} previous value defined
 */
Script.setState = function (namespace, value) {
    return _scriptAPI.APIFunc("SETSTATE", namespace, value);
};

/**
 * Get a variable in the Scripting state store similar to a dictionary.
 * @param {string} namespace
 * @returns {string} saved value
 */
Script.getState = function (namespace) {
    return _scriptAPI.APIFunc("GETSTATE", namespace);
};


System.writeLog = function (message) {
    return _scriptAPI.APIFunc("LOG", message);
};


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
 * Gets the current value of a given channel.
 * 
 * @param channel {String} The channel to look up . The channel must be in the following structure.
 *          For example, NETWORK/CATEGORY/INSTANCE/CLASS/SCOPE
 * @returns {String} Value of the given channel, null if the channel name is invalid or doesn't exist.
 */
System.getChannelValue = function (channel) {
    var result = _scriptAPI.APIFunc("GETCHANNELVALUE", channel);
    if (typeof result === "undefined") {
        result = null;
    }
    return result;
};


/**
 * Publish to a channel a given value
 * 
 * @param channel {String} Channel namespace to publish to.
 * @param reqdata
 * @returns true if publish is successful, null if channel is incorrect.
 */
System.publishToChannel = function (channel, reqdata) {
    return _scriptAPI.APIFunc("PUBLISHCHANNEL", channel, reqdata);
};


/**
 * Prints a message to the server console.
 * @param message, string to print in the console.
 */
System.writeconsole = function (message) {
    _scriptAPI.APIFunc("LOG", message);
};


/**
 * Prints error message to the server console.
 * @param message, string to print in the console.
 */
System.writeError = function (message) {
    _scriptAPI.APIFunc("ERROR", message);
};


// System function for system devs.
Database.func = function (func, dbName, table, rowFilter, colFilter, value, selStatement) {
    return _scriptAPI.APIFunc("DATABASE", func, dbName, table, rowFilter, colFilter, value, selStatement);
};

/**
 * Query the database and return any records that match the column filter.]
 * 
 * @param dbName {String} The database to query
 * @param tableName {String} The table in the given database to query
 * @param columns {String} A comma separated string of columns to return
 * @param filter {String} Filter to apply to query
 * @param order {String} Fields to order data by.
 * @returns {Object} A custom datbase object. See Scripting doumentation for more information.
 */
Database.readRecords = function (dbName, tableName, columns, filter = "", order = "") {
    return _scriptAPI.APIFunc("DATABASE", "READRECS", dbName, tableName, columns, filter, order);
};


/**
 * Save are record to the database. 
 * If the database does not already have the record it will be updated otherwise it will be added.
 * 
 * @param dbName {String} The database to query
 * @param tableName {String} The table in the given database to query
 * @param value {DatabaseObject} The value you would like to update the record with.
 * @returns {String} Number as a String representing the number of records that have been successfully updated.
 * -1 if there is an error.
 */
Database.saveRecord = function (dbName, tableName, value) {
    // Check input types.
    if (typeof dbName !== "string" || typeof tableName !== "string") {
        throw new Error("dbName or tableName has not been defined or are not strings.");
    }

    // Check dbRequest structure.
    if (typeof value !== "object") {
        throw new Error("Invalid DatabaseRequest structure.");
    }

    return _scriptAPI.APIFunc("DATABASE", "SAVERECS", dbName, tableName, "", "", JSON.stringify(value));
};


/**
 * Deletes a single record out of the database.
 * 
 * @param {string} dbName - The database to query
 * @param {string} tableName - The table in the given database to query
 * @param {string} column - The column to filter the delete by.
 * @param {string} value - The value of the column that you would like to delete.
 * @returns {String} Number as a String representing the number of records that have been successfully deleted.
 *  -1 of there was an error.
 */
Database.deleteRecord = function (dbName, tableName, column, value) {
    // Check input types.
    if (typeof dbName !== "string" || typeof tableName !== "string" || typeof column !== "string") {
        throw new TypeError("dbName, tableName, or column has not been defined or are not strings.");
    }

    if (typeof value !== "string" && typeof value !== "number") {
        throw new TypeError("Value must be of type string or number, found '" + typeof value + "'.")
    }

    // wrap in '' for sql
    if (typeof value === "string") {
        value = "'" + value + "'";
    } else {
        value = "" + value;
    }

    return _scriptAPI.APIFunc("DATABASE", "DELETEREC", dbName, tableName, column, value, "");
};


/**
 * Delete multiple records out of the database.
 * 
 * @param {string} dbName - The database to query
 * @param {string} tableName - The table in the given database to query
 * @param {string} column - The column to filter the delete by.
 * @param {Array<String>} values - The values of the column that you would like to delete.
 * @returns {String} Number as a String representing the number of records that have been successfully deleted.
 *  -1 of there was an error.
 */
Database.deleteRecords = function (dbName, tableName, column, values) {
    // Error checking
    if (typeof dbName !== "string" || typeof tableName !== "string" || typeof column !== "string" || typeof values === "undefined") {
        throw new Error("dbName, tableName, column, or values has not been defined or are not strings.");
    }

    if (!Array.isArray(values)) {
        throw new Error("Values must be of type Array. Not '" + typeof values + "'.");
    }

    if (column === "*") {
        throw new Error("Column value can not be '*'.");
    }

    var totalDeletedRows = 0;
    // Look over all row keys.
    values.forEach(function (row) {
        totalDeletedRows += parseInt(Database.deleteRecord(dbName, tableName, column, row));
    });

    return totalDeletedRows.toString();
};


/**
 * Query the database and return any records that match the column filter.]
 *
 * The database responses will return via the system channel $DB/ADMIN/MANAGE/RESPONSE.
 * Response will be in the form of a {SensaCollection}.
 *
 * @param {string} dbName -  The database to query
 * @param {string} tableName - The table in the given database to query
 * @param {object} [compoundTables] - A json object describing how to build entity relationship between tables and apply filters/order/group queries.
 */
Database.readCompound = function (dbName, tableName, compoundTables) {
    // Check input types.
    if (typeof dbName !== "string" || typeof tableName !== "string") {
        throw new Error("dbName or tableName has not been defined or are not strings.");
    }
    
    return _scriptAPI.APIFunc("DBPARAMS", "READRECSC", dbName, tableName, JSON.stringify(compoundTables));
};


/**
 * Query the database and return any records that match the column filter.]
 *
 * The database responses will return via the system channel $DB/ADMIN/MANAGE/RESPONSE.
 * Response will be in the form of a {SensaCollection}.
 *
 * @param {string} dbName -  The database to query
 * @param {string} tableName - The table in the given database to query
 * @param {object} [compoundTables] - A json object describing how to build entity relationship between columns that are referenced as composite key.
 * @param {string} primaryKeyComp - The composite value passed for comparison in the sql query (Pass in the value only the column name is generated at runtime)
 */
Database.readComposite = function (dbName, tableName, compoundTables, primaryKeyComp) {
    // Check input types.
    if (typeof dbName !== "string" || typeof tableName !== "string") {
        throw new Error("dbName or tableName has not been defined or are not strings.");
    }

    return _scriptAPI.APIFunc("DBPARAMS", "READRECSCOMPOSITE", dbName, tableName, JSON.stringify(compoundTables), JSON.stringify(primaryKeyComp));
};

/**
 * Save are record to the database.
 * If the database does not already have the record it will be updated otherwise it will be added.
 *
 * @requires Utils.js Utils API
 *
 * @param {string} dbName - The database to query
 * @param {string} tableName - The table in the given database to query
 * @param {DatbaseRequest} value - The value you would like to update the record with.
 * @example
 * {pri_key0: {col0:"col0_val",col1:"col1_val",...},pri_key1: {col0:"col0_val",col1:"col1_val",...},...}
 */
Database.saveRecordParam = function (dbName, tableName, value) {
    // Check input types.
    if (typeof dbName !== "string" || typeof tableName !== "string") {
        throw new Error("dbName or tableName has not been defined or are not strings.");
    }

    return _scriptAPI.APIFunc("DATABASE", "SAVERECSPARAM", dbName, tableName,"","", JSON.stringify(value));
};

/**
 * Inserts an entity and if it fails on insert it updates the record in the database.
 * 
 * @param dbName {String} The database to query
 * @param tableName {String} The table in the given database to query
 * @param recordJson {String} The column to filter the delete by.
 * @returns {String} Number as a String representing the number of records that have been successfully deleted.
 *  -1 of there was an error.
 */
Database.updateRecord = function (dbName, tableName, record) {
    if (typeof record !== "object") {
        // TODO check record object.
        throw new Error("Invalid record format. Record must be an object with SensaCollection format.");
    }

    recordJson = JSON.stringify(record);

    if (typeof dbName !== "string" || typeof tableName !== "string" || recordJson !== "string") {
        throw new Error("dbName, tableName, or recordJson has not been defined or are not strings.");
    }

    return _scriptAPI.APIFunc("DATABASE", "UPDATEREC", dbName, tableName, "", "", recordJson);
}

/**
 * Tries to Insert and if it fails updates a single existing record in the database.
 * 
 * @param dbName {String} The database to query
 * @param tableName {String} The table in the given database to query
 * @param recordJson {String} The column to filter the delete by.
 * @returns {String} Number as a String representing the number of records that have been successfully deleted.
 *  -1 of there was an error.
 */
Database.updateEntity = function (dbName, tableName, record) {
    if (typeof record !== "object") {
        // TODO check record object.
        throw new Error("Invalid record format. Record must be an object with SensaCollection format.");
    }

    
    if (typeof dbName !== "string" || typeof tableName !== "string") {
        throw new Error("dbName, tableName, or recordJson has not been defined or are not strings.");
    }

    return _scriptAPI.APIFunc("DATABASE", "UPDATEENTITY", dbName, tableName, "", "", JSON.stringify(record));
}

/**
 * Query the database and return any records that match the column filter.]
 *
 * The database responses will return via the system channel $DB/ADMIN/MANAGE/RESPONSE.
 * Response will be in the form of a {SensaCollection}.
 *
 * @param {Array<string} [options.users=[]] - Array containing all the users to retrieve.
 * @param {Array<string>} [options.columns=[]] - Array containing all the columns to retreive.
 *  These columns username, first, last, email, address, state, pcode, recoveryquestion, mobile, status, passwordexp, notes, lastlogged, 
 *  lastmodified, dashboard, city
 * @param {any} [options.cbParam] - Any parameters you would like to pass to the callback. These are passed by reference.
 */
Directory.getUsers = function (options) {
    var validColumns = ['username', 'first', 'last',
        'email', 'address', 'state',
        'pcode', 'recoveryquestion', 'mobile',
        'status', 'passwordexp', 'notes',
        'lastlogged', 'lastmodified', 'dashboard',
        'city'];

    var defaults = {
        columns: validColumns
    };

    if (typeof options === "object") {
        defaults = Object.assign(defaults, options)
    }

    // Check that columns type
    if (!Array.isArray(defaults.columns)) {
        throw new TypeError("options.columns must an array of strings. Found " + typeof defaults.columns);
    }

    // Check user type
    if (typeof defaults.users !== "undefined" && !Array.isArray(defaults.users)) {
        throw new TypeError("options.users must be an array of strings. Found " + typeof defaults.users);
    }

    if (typeof defaults.users !== "undefined") {
        defaults.users = defaults.users.toString();
    }

    defaults.columns = defaults.columns.toString();

    return _scriptAPI.APIFunc("DIRECTORY", "sqlite", "DIRLIST", JSON.stringify(defaults));

};


// DATA TYPES
/**
 * SensaCollection class used to send data to and from the table.
 * 
 * @param {string[]} columns - array containing all the column names
 * @param {string} primaryKeyColumn - The primary key column that contains a unique value for each row in the collection
 * @param {object} options - Options object
 * @param {object} options.data - Import data object, key-value with key being the primary key and value array of each row.
 */
var SensaCollection = function (columns, primaryKeyColumn, options) {
    var defaultOptions = {
        data: {},
        lazy: true
    };

    if (Array.isArray(columns) !== true) {
        console.error("Headers must be a string[]");
        throw new TypeError("Headers must be a string[]");
    }

    if (typeof primaryKeyColumn === "undefined") {
        console.error("primaryKeyColumn must be defined.");
        throw new TypeError("primaryKeyColumn must be defined.");
    }

    if (typeof options !== "undefined" && typeof options !== "object") {
        console.error("Options is optional however must be an object. Found: " + typeof options);
        throw new TypeError("Data is optional however must be an object. Found: " + typeof options);
    }

    if (typeof options === "object" && typeof options.data !== "undefined" && typeof options.data !== "object") {
        console.error("options.data is optional however must be an object. Found: " + typeof options.data);
        throw new TypeError("options.data is optional however must be an object. Found: " + typeof options.data);
    }

    defaultOptions = Object.assign(defaultOptions, options);

    this.pk = primaryKeyColumn;
    this.headers = Object.assign([], columns);
    this.columns = this.headers;
    this._columnMap = {};

    // map headers to dict for quick lookup.
    for (var i = 0; i < this.columns.length; i++) {
        this._columnMap[this.columns[i]] = i;
    }

    this.data = Object.assign({}, defaultOptions.data);
    this._options = defaultOptions;
    delete this._options.data;
};

SensaCollection = {

    /**
     * Loads a SensaCollection object into the SensaCollection Class
     * 
     * @param {SensaCollection} sensacollection
     * 
     * @returns {SensaCollection} SensaCollection class representing the given object.
     */
    load: function(sensacollection) {

        // For pre-existing scripts that are still converting.
        if (sensacollection instanceof SensaCollection) return sensacollection;

        return new SensaCollection(sensacollection.headers, sensacollection.pk, {data:sensacollection.data});
    },


    /**
     * Sets the column values for the SensaCollection.
     * 
     * @param {string[]} columns - Columns to set the SensaCollection. The array must have the same number of columns as the current SensaCollection.
     */ 
    setColumns: function (columns) {
        if (!Array.isArray(columns)) {
            throw new TypeError("Columns must be String[].");
        }

        if (columns.length !== this.columns.length) {
            throw new Error("Expected " + this.columns.length + "columns but found " + columns.length + ".");
        }

        this.columns = Object.assign([], columns);
        this.headers = Object.assign([], columns);

        // map headers to dict for quick lookup.
        this._columnMap = {};
        for (var i = 0; i < this.columns.length; i++) {
            this._columnMap[this.columns[i]] = i;
        }
    },


    /**
     * Adds a new column to the SensaCollection with the given default value.
     * 
     * @param {string} columnName - Name of the column to add
     * @param {string} [defaultValue=''] - The default value for the column. The default is an empty string ''
     */
    addColumn: function(columnName, defaultValue) {
        if (typeof defaultValue === "undefined") {
            defaultValue = "";
        }

        if (typeof columnName !== "string") {
            throw new TypeError("columnName must be a string, found '" + typeof columnName + "' instead.");
        }

        if (this.columns.indexOf(columnName) !== -1) {
            throw new TypeError("'" + columnName + "' already exists in the SensaCollection.");
        }

        this.columns.push(columnName);
        this._columnMap[columnName] = this.columns.length;

        var keys = Object.keys(this.data);
        for (var i = 0; i < keys.length; i++) {
            this.data[keys[i]].push(defaultValue);
        }

    },

    /**
     * Adds a new row to the SensaCollection
     * 
     * @param {object} dataObj, Key-value pair with each key representing the associated column. The row primary key must be present.
     */
    add: function (dataObj) {
        if (typeof dataObj !== "object") {
            console.error("dataObj must be an object. Found " + typeof dataObj + ".");
            throw new TypeError("dataObj must be an object. Found " + typeof dataObj + ".");
        }

        if (this.columns.length !== Object.keys(dataObj).length) {
            console.error("dataObj data must be the same number items as the collection columns. Columns is of length " + this.columns.length + " but found " + Object.keys(dataObj).length + ".");
            throw new TypeError("dataObj data must be the same number of items as the columns. Columns is of length " + this.columns.length + " but found " + Object.keys(dataObj).length + ".");
        }

        if (typeof dataObj[this.pk] === undefined) {
            console.error("Primary key column could not be found in the row data.");
            throw new TypeError("Primary key column could not be found in the row data.");
        } 

        var primaryKey = dataObj[this.pk];
        var dataArray = Object.keys(dataObj);

        this.data[primaryKey] = Object.assign([], dataArray);

        this.set(dataObj);

    },


    /**
     * Removes a row from the SensaCollection;
     * @param {any} primaryKey, the primary key of the row you want to remove.
     * 
     * @returns {boolean} returns true of the item is successfully removed from the SensaCollection, False otherwise.
     */
    remove: function (primaryKey) {
        if (this.data[primaryKey]) {
            delete this.data[primaryKey];
            return true;
        }
        return false;
    },


    /**
     * Reduces the SensaCollection by columnns and rows. The new filtered SensaCollection is then returned.
     * 
     * @param {any} columns, The columns of the new SensaCollection, all missing columns will be removed.
     * @param {array} [rowKeys=*], Option array containing all the rows that you would like to keep. Otherwise all rows will be kept.
     * 
     * @returns {SensaCollection} Collection containing the filtered results.
     */
    filter: function(columns, primaryKeys) {
        if (!Array.isArray(columns)) {
            console.error("Columns must be an array. Found " + typeof columns + ".");
            throw new TypeError("Columns must be an array. Found " + typeof columns + ".");
        }

        if (columns === this.columns && typeof primaryKeys === "undefined")
            return this;

        // Check that column items are actually in the array.
        var valid = [];
        var indexes  = [];
        for (var i in columns) {
            var value = columns[i];
            if (this.columns.indexOf(value) === -1) {
                console.warn("Columns '" + value + "' could not be found in the SensorCollection.");               
            } else {
                valid.push(value);
                indexes.push(this.columns.indexOf(value));
            }
        };

        var data = {}

        if (primaryKeys === undefined) {
            primaryKeys = Object.keys(this.data);
        }

        for (var i in primaryKeys){
            var key = primaryKeys[i];
            var row = this.data[key];
            var resultArr = indexes.map(function (i) {
                return row[i];
            });
            data[key] = resultArr;
        };

        return new SensaCollection(valid, this.pk, {data:data});
    },


    /**
     * Query the SensaCollection.
     * 
     * @param {function callback(record, pk)} - Function that receives the record as a column-value pair and primary key as paramaters. If the function returns true the row is added to the returned collection. 
     * 
     * @returns {sensacollection} Contains all rows that returned true in the callback.
     */
    query: function(callback) {
        if (typeof callback !== "function") {
            throw new TypeError("callback must of type 'function'. Found '" + typeof callback + "'.");
        }

        var returnCollection = new SensaCollection(this.columns, this.pk);

        this.forEach(function(record, pk) {
            if (callback(record, pk) === true) {
                returnCollection.add(record);
            }   
        });
        return returnCollection;
    },


    /**
     * Returns the row and column values for a given primary key.
     * 
     * @param {string} primaryKey - Primary key of the row to reteive.
     * @param {string} [column=*] If a column is specified, the specific column value for the row is return.
     * 
     * @returns {any} Returns a key-value object where the keys represent the columns. If the column parameter is used the column value is returned. If the primary key does not exist then null is returned.
     */
    get: function(primaryKey, column) {

        if (typeof primaryKey !== "string") {
            console.error("primaryKey must be of type 'string'. Found '" + typeof primaryKey + "'.");
            throw new TypeError("primaryKey must be of type 'string'. Found '" + typeof primaryKey + "'.");
        }

        var row = this.data[primaryKey]
        if (row === undefined) {
            return null;
        }

        if (typeof column === "string") {
            var index = this._columnMap[column];
            if (typeof index === "undefined") {
                return null;
            }
            return row[index];
        }

        var retObj = {};
        for (var i = 0; i < this.columns.length; i++) {
            retObj[this.columns[i]] = row[i];
        }

        return retObj;
    },

    
    /**
     * Returns an array of all the columns values.
     * 
     * @param {string} column - Column to return
     * 
     * @returns {array} - Array of all the values in the column. Null If the column does not exist.
     */
    getColumn: function (column) {
        if (this.columns.indexOf(column) === -1) {
            return null
        }

        var results = [];

        this.forEach(function(row) {
            results.push(row[column]);
        });
        return results;
    },


    /**
     * Returns the first item in the SensaCollection
     * 
     * @returns {object} Returns an object with keys representing columns, and values the row value.
     */
    getFirst: function() {
        var keys = Object.keys(this.data);

        if (keys.length === 0) {
            return null;
        }

        var firstRow = this.data[Object.keys(this.data)[0]];

        // Create object
        var retObj = {};
        for (var i = 0; i < this.columns.length; i++) {
            retObj[this.columns[i]] = firstRow[i];
        }

        return retObj;
    },

    /**
     * Sets the value for given row and column.
     * 
     * @param {string} primaryKey - The primary key associated with the row.
     * @param {object} dataObj - Key-Value pair containing the column names and values. dataObj must contain the row's primary key.
     */
    set: function(dataObj) {
        if (typeof dataObj[this.pk] === undefined) {
            console.error("Primary key column could not be found in the row data.");
            throw new TypeError("Primary key column could not be found in the row data.");
        } 

        if (typeof dataObj !== "object") {
            console.error("dataObj must be of type 'object'. Found '" + typeof dataObj + "'.");
            throw new TypeError("dataObj must be of type 'object'. Found '" + typeof dataObj + "'.");
        }

        var primaryKey = dataObj[this.pk];

        // iterate over each item in collection and update.
        var keys = Object.keys(dataObj);
        for (var i = 0; i < keys.length; i++) {
            var column = keys[i];
            var value = dataObj[column];

            // Check type.
            if (typeof value !== "string" && typeof value !== "number") {
                throw new TypeError("All SensaCollection entries must be either a number or string. " + column + " is of type " + typeof value);
            }

            var index = this.columns.indexOf(column);
            if (index === -1) {
                throw new TypeError("Column '" + column + "' does not exist in the SensaCollection.");
            }

            var row = this.data[primaryKey];
            if (row === undefined) {
                throw new TypeError("Primary key '" + primaryKey + "' does not exist in the SensaCollection.");
            }

            row[index] = value;
        }

    },


    /**
     * Merges two SensaCollections together. Both collections must have the same primary key. 
     * Additional columns will be added if collection contains additional columns. 
     * Collection values will overwrite the current values. If this is unwanted behaviour consider using the filter function first.
     * 
     * @param {SensaCollection} collection - Collection to merge
     * 
     * @returns {SensaCollection} A new SensaCollection containing the merged data is returned.
     */
    merge: function (collection) {
        if (!(collection instanceof SensaCollection)) {
            throw new TypeError("Invalid input type. Expected a SensaCollection.");
        }

        if (this.pk !== collection.pk) {
            throw new Error("Both collections must have the same primary keys.");
        }

        // Add columns that do not exist already.
        var differenceColumns = difference(new Set(collection.columns), new Set(this.columns));
        var differenceColumnsInverse = difference(new Set(this.columns), new Set(collection.columns));

        // Convert set to array es5 style
        var diffArray = [];
        differenceColumns.forEach(function (value) {
            diffArray.push(value);
        })

        var diffArrayInverse = [];
        differenceColumnsInverse.forEach(function (value) {
            diffArrayInverse.push(value);
        });

        var newCollection = new SensaCollection(this.headers, this.pk, {data: this.data});

        // Add additional columns
        for (var i = 0; i < diffArray.length; i++) {
            var column = diffArray[i];
            newCollection.addColumn(column, "");
        }

        // Merge new data over.
        collection.forEach(function (value, pk) {
            if (newCollection.has(pk)) {
                newCollection.set(value);
            } else {
                for (var i = 0; i < diffArrayInverse.length; i++) {
                    value[diffArrayInverse[i]] = "";                    
                }

                newCollection.add(value);
            }
        });

        return newCollection;
    },


    /**
     * Checks if a row exists in the SensaCollection
     * @param {string} primaryKey - Primary key of the row.
     * 
     * @returns {boolean} true if it exists, false otherwise.
     * 
     */
    has: function (primaryKey) {
        if (typeof this.data[primaryKey] !== "undefined") {
            return true;
        } else {
            return false;
        }
    },

    /**
     * Returns all row primary keys in the SensaCollection.
     * 
     * @returns {string[]} - Array of row keys.
     */
    keys: function() {
        return Object.keys(this.data);
    },


    /**
     * Returns all the primary keys are not in or are different from the original collection.
     * 
     * @param {SensaCollection} otherCollection - Collection to check the difference against.
     * 
     * @returns {SensaCollection} - returns an array of all the primary keys that need to be added or updated.
     */
    difference: function(otherCollection) {
        if (!(otherCollection instanceof SensaCollection)) {
            console.error('Could not calculate difference in SensaCollections. otherCollection must be a SensaCollection class.');
            throw new TypeError('Could not calculate difference in SensaCollections. otherCollection must be a SensaCollection class.');
        }

        // Similar columns
        var col1 = new Set(this.columns);
        var col2 = new Set(otherCollection.headers);

        var sameHeaders = intersection(col1, col2); 
        var compareCollection = this.filter(sameHeaders);
        otherCollection = otherCollection.filter(sameHeaders);

        var set2 = new Set(Object.keys(otherCollection.data));
        var set1 = new Set(Object.keys(this.data));
        
        var checkSet = new Set();
        var updateArray = [];
        set2.forEach(function(item) {
            if (set1.has(item)) {
                checkSet.add(item);
            } else {
                updateArray.push(item);
            }
        });

        var newCol = new SensaCollection(sameHeaders, otherCollection.pk);

        // Check if arrays are different.
        checkSet.forEach(function(item) {
            var origRow = compareCollection.get(item);
            var row2 = otherCollection.get(item);
            if (JSON.stringify(origRow) !== JSON.stringify(row2)) {
                // Difference - Needs to be updated.
                newCol.add(row2);
            }
        });

        updateArray.forEach(function(item) {
            newCol.add(otherCollection.get(item));
        });

        return newCol;
    },



    /**
     * For Each function for the SensaCollection to iterate over the rows in a SensaCollection. The callback provides 2 variables:
     *  - 1. A key-value pair with the keys representing the columns
     *  - 2. The row primary key
     *  
     * @param {any} callbackFn - The function that is called for each row in the SensaCollection.

     */
    forEach: function(callbackFn) {

        if (typeof callbackFn !== "function") {
            console.error("Expected a callback function but found '" + typeof callbackFn + "'.");
            throw new TypeError("Expected a callback function but found '" + typeof callbackFn + "'.");
        }

        var dataKeys = Object.keys(this.data);

        for (var i in dataKeys) {
            var key = dataKeys[i];
            var row = this.data[key];
            // Map headers to row object.
            var result = {};
            this.columns.forEach(function (key, i) {
                return result[key] = row[i];
            });

            try {
                callbackFn(result, key);
            } catch(err) {
                console.error("Error executing SensaCollection forEach function. " + err.message);
                throw err;
            }
        }
    },

    /**
     * Returns the number of rows in the SensaCollection.
     * 
     * @returns {number} Number of rows.
     */
    size: function () {
        return Object.keys(this.data).length;
    },

    /**
     * Exports a stripped down object of the SensaCollection ideal for sending to the server.
     * 
     * @returns {object} Object containing only the necessary items required for a SensaCollection.
     */
    export: function() {
        return {
            headers: this.columns,
            pk: this.pk,
            data: this.data
        };
    },


    /**
     * Returns a clone of the current SensaCollection without any references.
     */
    clone: function () {
        return new SensaCollection(this.columns, this.pk, { data: JSON.parse(JSON.stringify(this.data)) });
    },

    /**
     * Exports a csv string  of the SensaCollectio n
     * 
     * @returns {string} - Formatted string
     */
    toCSV: function() {
        var csv = [];

        // Add headers
        var row = this.columns
        csv.push(row.join(","));

        // Get rows
        var keys = Object.keys(collection.data);
        for (var i = 0; i < keys.length; i++) {
            row = this.data[keys[i]]
            csv.push(row.join(","))
        }

        return csv.join("\n");
    }
}


/* Basic Set operations */

/**
 * 
 * @param {Set} set
 * @param {Set} subset
 * 
 * @returns {Set}
 */
function isSuperset(set, subset) {
    for (var elem of subset) {
        if (!set.has(elem)) {
            return false
        }
    }
    return true
}


/**
 * Returns the union of two sets.
 * 
 * @param {Set} setA
 * @param {Set} setB
 *
 * @example
 *   let setA = new Set([1, 2, 3, 4])
 *   let setB = new Set([3, 4, 5, 6])
 *   union(setA, setB) // => Set [1, 2, 3, 4, 5, 6]
 *
 * @returns {Set}
 */
function union(setA, setB) {
    var _union = new Set(setA)
    for (var elem of setB) {
        _union.add(elem)
    }
    return _union
}


/**
 * Returns the intersecting items between two sets.
 * 
 * @param {any} setA
 * @param {any} setB
 * 
 * @example
 *   let setA = new Set([1, 2, 3, 4])
 *   let setB = new Set([3, 4, 5, 6])
 *   intersection(setA, setB) // => Set [3, 4]
 *   
 * @returns {array}
 */
function intersection(setA, setB) {
    var _intersection = []
    for (var elem of setB) {
        if (setA.has(elem)) {
            _intersection.push(elem)
        }
    }
    return _intersection;
}


/**
 * Returns the elements missing from either set.
 * 
 * @param {Set} setA
 * @param {Set} setB
 * 
 * @example
 *   let setA = new Set([1, 2, 3, 4])
 *   let setB = new Set([3, 4, 5, 6])
 *   symmetricDifference(setA, setB) // => Set [1, 2, 5, 6]
 *   
 * @returns {Set}
 */
function symmetricDifference(setA, setB) {
    var _difference = new Set(setA)
    for (var elem of setB) {
        if (_difference.has(elem)) {
            _difference.delete(elem)
        } else {
            _difference.add(elem)
        }
    }
    return _difference
}

/**
 * Returns the elements in setA that setB does not have.
 * 
 * @param {Set} setA
 * @param {Set} setB
 * 
 * @example
 *   let setA = new Set([1, 2, 3, 4])
 *   let setB = new Set([3, 4, 5, 6])
 *   difference(setA, setB) // => Set [1, 2]
 *   
 * @returns {Set}
 */
function difference(setA, setB) {
    let _difference = new Set(setA)
    for (var elem of setB) {
        _difference.delete(elem)
    }
    return _difference
}





function _init(scriptName) {
    _scriptName = scriptName;
    if (_loaded) {
        return _loaded();
    }
}

function _action(input, inputChannel, usrmeta, sysmeta) {
    if (_flowMsg) {

        var ch = JSON.parse(inputChannel);

        var result = {
            usrmeta: usrmeta,
            sysmeta: sysmeta,
            value: input,
            startCh: JSON.parse(inputChannel)
        };

        User.accountid = typeof sysmeta.deviceInfo.accountID !== "undefined" ? sysmeta.deviceInfo.accountID : null;

        result.value = _flowMsg(result);
        return result;
    }
}