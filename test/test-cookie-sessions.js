var sessions = require('cookie-sessions');


exports['split'] = function(test){
    var hmac_sig = 'c82d1eacb4adb15a3250a6df7c8f190b586ab6b9',
        timestamp = 1264710287440,
        data_blob = 'somedata';

    var serialized_cookie = hmac_sig + timestamp + data_blob;
    test.same(
        sessions.split(serialized_cookie),
        {hmac_signature: hmac_sig, timestamp: timestamp, data_blob: data_blob},
        'split correctly seperates sig, timestamp and data blob'
    );
    test.done();
};

exports['valid'] = function(test){
    var secret = 'secret';
        current_valid_sig = '5eaaa22480acefd8b18d67bb194573dc1b75d9db',
        expired_valid_sig = '9c7ad86913ceeced1f6f249ba52868006c8dfdab',
        invalid_sig = '51a2a32485a6e7d8b9810711112513d14b15d16b',
        expired_timestamp = 1264700000000,
        current_timestamp = 1264710287440,
        session_timeout = 54000,
        data_blob = 'somedata';

    var Date_copy = global.Date;
    global.Date = function(){this.getTime = function(){return 1264710287000}};

    test.ok(
        sessions.valid(
            secret, session_timeout,
            current_valid_sig + current_timestamp + data_blob
        ) === true,
        'returns true for valid hmac sig within timeout'
    );
    test.ok(
        sessions.valid(
            secret, session_timeout,
            expired_valid_sig + expired_timestamp + data_blob
        ) === false,
        'returns false for valid hmac sig past timeout'
    );
    test.ok(
        sessions.valid(
            secret, session_timeout,
            invalid_sig + current_timestamp + data_blob
        ) === false,
        'returns false for invalid hmac sig within timeout'
    );
    test.ok(
        sessions.valid(
            secret, session_timeout,
            invalid_sig + expired_timestamp + data_blob
        ) === false,
        'returns false for invalid hmac sig past timeout'
    );

    // restore Date
    global.Date = Date_copy;
    test.done();
};

exports['decrypt'] = function(test){
    var r = sessions.decrypt(
        'secret', '686734eb9e0fff9adea53983210825ef'
    );
    test.same(r, 'somedata', 'decrypt sucessfully returns decrypted data');
    test.done();
};

exports['encrypt'] = function(test){
    var r = sessions.encrypt('secret', 'somedata');
    test.same(
        r, '686734eb9e0fff9adea53983210825ef',
        'encrypt sucessfully returns encrypted data'
    );
    test.done();
};

exports['deserialize valid cookie'] = function(test){
    test.expect(8);
    // copy some functions
    var valid = sessions.valid;
    var decrypt = sessions.decrypt;
    var parse = JSON.parse;

    sessions.valid = function(secret, timeout, str){
        test.equals(secret, 'secret', 'valid called with secret');
        test.equals(timeout, 123, 'valid called with timeout');
        test.equals(str, 'cookiestring', 'valid called with cookie string');
        return true;
    };
    sessions.split = function(str){
        test.equals(str, 'cookiestring', 'split called with cookie string');
        return {data_blob: 'datastr'};
    };
    sessions.decrypt = function(secret, str){
        test.equals(secret, 'secret', 'decrypt called with secret');
        test.equals(str, 'datastr', 'decrypt called with data string');
        return 'decrypted_data';
    };
    JSON.parse = function(str){
        test.equals(
            str, 'decrypted_data', 'JSON.parse called with decrypted data'
        );
        return {test:'test'};
    };
    var r = sessions.deserialize('secret', 123, 'cookiestring');
    test.same(r, {test:'test'}, 'deserialize returns parsed json data');

    // restore copied functions:
    sessions.valid = valid;
    sessions.decrypt = decrypt;
    JSON.parse = parse;
    test.done();
};

exports['deserialize invalid cookie'] = function(test){
    test.expect(1);
    // copy some functions
    var valid = sessions.valid;
    var decrypt = sessions.decrypt;
    var parse = JSON.parse;

    sessions.valid = function(secret, timeout, str){
        return false;
    };
    sessions.decrypt = function(secret, str){
        test.ok(false, 'should not attempt to decrypt invalid cookie');
    };
    JSON.parse = function(str){
        test.ok(false, 'should not attempt to parse invalid cookie');
    };
    try {
        sessions.deserialize('secret', 123, 'cookiestring');
    }
    catch(e){
        test.ok(true, 'throw exception on invalid cookie');
    }

    // restore copied functions:
    sessions.valid = valid;
    sessions.decrypt = decrypt;
    JSON.parse = parse;
    test.done();
};

exports['serialize'] = function(test){
    test.expect(7);
    // copy some functions
    var encrypt = sessions.encrypt;
    var hmac_signature = sessions.hmac_signature;
    var stringify= JSON.stringify;
    var Date_copy = global.Date;

    global.Date = function(){this.getTime = function(){return 1234;}};
    JSON.stringify = function(obj){
        test.same(
            obj, {test:'test'}, 'JSON.stringify called with cookie data obj'
        );
        return 'data';
    };
    sessions.encrypt = function(secret, str){
        test.equals(secret, 'secret', 'encrypt called with secret');
        test.equals(str, 'data', 'encrypt called with stringified data');
        return 'encrypted_data';
    };
    sessions.hmac_signature = function(secret, timestamp, data_str){
        test.equals(secret, 'secret', 'hmac_signature called with secret');
        test.equals(timestamp, 1234, 'hmac_signature called with timestamp');
        test.equals(
            data_str, 'encrypted_data',
            'hmac_signature called with encrypted data string'
        );
        return 'hmac';
    };
    var r = sessions.serialize('secret', {test:'test'});
    test.equals(
        r, 'hmac1234encrypted_data', 'serialize returns correct string'
    );

    // restore copied functions:
    sessions.encrypt = encrypt;
    sessions.hmac_signature = hmac_signature;
    JSON.stringify = stringify;
    global.Date = Date_copy;
    test.done();
};

exports['serialize data over 4096 chars'] = function(test){
    test.expect(1);
    // copy some functions
    var encrypt = sessions.encrypt;
    var hmac_signature = sessions.hmac_signature;
    var stringify= JSON.stringify;
    var Date_copy = global.Date;

    global.Date = function(){this.getTime = function(){return 1234;}};
    JSON.stringify = function(obj){
        return 'data';
    };
    sessions.encrypt = function(secret, str){
        // lets make this too long!
        var r = '';
        for(var i=0; i<4089; i++){
            r = r + 'x';
        };
        return r;
    };
    sessions.hmac_signature = function(secret, timestamp, data_str){
        return 'hmac';
    };
    try {
        var r = sessions.serialize('secret', {test:'test'});
    }
    catch(e){
        test.ok(
            true, 'serializing a cookie over 4096 chars throws an exception'
        );
    }

    // restore copied functions:
    sessions.encrypt = encrypt;
    sessions.hmac_signature = hmac_signature;
    JSON.stringify = stringify;
    global.Date = Date_copy;
    test.done();
};

exports['readCookies'] = function(test){
    var req = {headers: {cookie: "name1=data1; test=\"abcXYZ%20123\""}};
    var r = sessions.readCookies(req);
    test.same(r, {name1: 'data1', test: '"abcXYZ 123"'}, 'test header read ok');
    test.done();
};

exports['readCookies no cookie in headers'] = function(test){
    var req = {headers: {}};
    var r = sessions.readCookies(req);
    test.same(r, {}, 'returns empty object');
    test.done();
};

exports['readSession'] = function(test){
    test.expect(5);
    var readCookies = sessions.readCookies;
    var deserialize = sessions.deserialize;

    sessions.readCookies = function(r){
        test.equals(r, 'request_obj', 'readCookies called with request object');
        return {'node_session': 'cookie_data'};
    };
    sessions.deserialize = function(secret, timeout, str){
        test.equals(secret, 'secret', 'readCookies called with secret');
        test.equals(timeout, 12, 'readCookies called with timeout');
        test.equals(str, 'cookie_data', 'readCookies called with cookie data');
        return {test: 'test'};
    };

    var r = sessions.readSession(
        'node_session', 'secret', 12, 'request_obj'
    );
    test.same(r, {test: 'test'}, 'session with key node_session read ok');

    // restore copied functions
    sessions.readCookies = readCookies;
    sessions.deserialize = deserialize;
    test.done();
};

exports['readSession no cookie'] = function(test){
    test.expect(2);
    var readCookies = sessions.readCookies;
    var deserialize = sessions.deserialize;

    sessions.readCookies = function(r){
        test.equals(r, 'request_obj', 'readCookies called with request object');
        return {};
    };
    sessions.deserialize = function(secret, timeout, str){
        test.ok(false, 'should not call deserialize');
    };

    var r = sessions.readSession(
        'node_session', 'secret', 12, 'request_obj'
    );
    test.same(r, {}, 'return empty session');

    // restore copied functions
    sessions.readCookies = readCookies;
    sessions.deserialize = deserialize;
    test.done();
};

exports['onRequest'] = function(test){
    test.expect(5);
    var readSession = sessions.readSession;
    var s = {
        session_key:'_node',
        secret: 'secret',
        timeout: 86400
    };
    var req = {};

    sessions.readSession = function(key, secret, timeout, req){
        test.equals(key, '_node', 'readSession called with session key');
        test.equals(secret, 'secret', 'readSession called with secret');
        test.equals(timeout, 86400, 'readSession called with timeout');
        return 'testsession';
    };
    var next = function(){
        test.ok(true, 'chain.next called');
        test.equals(
            req.session, 'testsession', 'req.session equals session data'
        );
    };
    sessions.filter(s)(req, 'res', next);

    // restore copied functions
    sessions.readSession = readSession;
    test.done();
};

exports['writeHead'] = function(test){
    test.expect(5);

    var s = {
        session_key:'_node',
        secret: 'secret',
        timeout: 86400
    };
    var req = {
        headers: {},
        writeHead: function(headers){
            test.equals(headers['Set-Cookie'], '_node=serialized_session');
            test.equals(headers['original'], 'header');
        }
    };

    var serialize = sessions.serialize;
    sessions.serialize = function(secret, data){
        test.equals(secret, 'secret', 'serialize called with secret');
        test.same(data, {test:'test'}, 'serialize called with session data');
        return 'serialized_session';
    };

    var next = function(){
        test.ok(true, 'chain.next called');
        req.session = {test:'test'};
        req.writeHead({'original':'header'});
        // restore copied functions
        sessions.serialize = serialize;
        test.done();
    };
    sessions.filter(s)(req, 'res', next);
};

exports['onInit secret set'] = function(test){
    test.expect(0);
    var s = {secret: 'secret'};
    try {
        sessions.filter({secret: 'secret'});
    }
    catch(e){
        test.ok(false, 'do nothing if secret set in server settings');
    }
    test.done();
};

exports['onInit no secret set'] = function(test){
    test.expect(1);
    try {
        sessions.filter({});
    }
    catch(e){
        test.ok(true, 'throw exception if no secret set in server settings');
    }
    test.done();
};