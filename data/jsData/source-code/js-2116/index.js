// Load modules

var Http = require('http');
var NodeUtil = require('util');
var Hoek = require('hoek');


// Declare internals

var internals = {};


exports = module.exports = internals.Error = function (code, message) {

    var self = this;

    Hoek.assert(this.constructor === internals.Error, 'Error must be instantiated using new');
    Hoek.assert(code instanceof Error || (!isNaN(parseFloat(code)) && isFinite(code) && code >= 400), 'code must be an Error or a number (400+)');

    Error.call(this);

    if (code instanceof Error) {
        for (var d in code) {
            if (code.hasOwnProperty(d)) {
                this[d] = code[d];
            }
        }

        this.code = this.code || 500;
        this.name = code.name;
        this.message = code.message || message;
        if (code.message && message) {
            this.info = message;
        }

        this.toResponse = code.toResponse;          // Required if toRepsonse is a prototype function
    }
    else {
        this.code = code;
        this.message = message;
    }

    // Response format

    if (!this.toResponse ||
        typeof this.toResponse !== 'function') {

        this.toResponse = internals.toResponse;
    }

    return this;
};

NodeUtil.inherits(internals.Error, Error);


internals.toResponse = function () {

    // { code, payload, type, headers }

    var response = {
        code: this.code,
        payload: {
            error: Http.STATUS_CODES[this.code] || 'Unknown',
            code: this.code,
            message: this.message
        }
    };

    for (var d in this) {
        if (['error', 'code', 'message'].indexOf(d) === -1 &&
            this.hasOwnProperty(d) &&
            typeof this[d] !== 'function') {

            response.payload[d] = this[d];
        }
    }

    return response;
};


// Utilities

internals.Error.badRequest = function (message) {

    return new internals.Error(400, message);
};


internals.Error.unauthorized = function (error, scheme, attributes) {           // Or function (error, wwwAuthenticate[])

    var err = new internals.Error(401, error);

    if (!scheme) {
        return err;
    }

    var wwwAuthenticate = '';

    if (typeof scheme === 'string') {

        // function (error, scheme, attributes)

        wwwAuthenticate = scheme;
        if (attributes) {
            var names = Object.keys(attributes);
            for (var i = 0, il = names.length; i < il; ++i) {
                if (i) {
                    wwwAuthenticate += ',';
                }

                var value = attributes[names[i]];
                if (value === null ||
                    value === undefined) {              // Value can be zero

                    value = '';
                }
                wwwAuthenticate += ' ' + names[i] + '="' + Hoek.escapeHeaderAttribute(value.toString()) + '"';
            }
        }

        if (error) {
            if (attributes) {
                wwwAuthenticate += ',';
            }
            wwwAuthenticate += ' error="' + Hoek.escapeHeaderAttribute(error) + '"';
        }
        else {
            err.isMissing = true;
        }
    }
    else {

        // function (error, wwwAuthenticate[])

        var wwwArray = scheme;
        for (var i = 0, il = wwwArray.length; i < il; ++i) {
            if (i) {
                wwwAuthenticate += ', ';
            }

            wwwAuthenticate += wwwArray[i];
        }
    }

    err.toResponse = function () {

        var response = internals.toResponse.call(this);
        response.headers = { 'WWW-Authenticate': wwwAuthenticate };
        return response;
    };

    return err;
};


internals.Error.clientTimeout = function (message) {

    return new internals.Error(408, message);
};


internals.Error.serverTimeout = function (message) {

    return new internals.Error(503, message);
};


internals.Error.forbidden = function (message) {

    return new internals.Error(403, message);
};


internals.Error.notFound = function (message) {

    return new internals.Error(404, message);
};


internals.Error.internal = function (message, data) {

    var err = new internals.Error(500, message);
    err.trace = Hoek.displayStack(1);
    err.data = data;

    err.toResponse = function () {

        var response = internals.toResponse.call(this);
        response.payload.message = 'An internal server error occurred';                 // Hide actual error from user
        return response;
    };

    return err;
};


internals.Error.passThrough = function (code, payload, contentType, headers) {

    var err = new internals.Error(500, 'Pass-through');                     // 500 code is only used internally and is not exposed when sent

    err.passThrough = {
        code: code,
        payload: payload,
        type: contentType
    };

    err.toResponse = function () {

        var response = {
            code: code,
            payload: payload,
            type: contentType,
            headers: headers
        };

        return response;
    };

    return err;
};


