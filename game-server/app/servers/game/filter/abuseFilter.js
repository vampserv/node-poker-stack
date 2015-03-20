
module.exports = function(){
    return new Filter();
};

var Filter = function(){};

Filter.prototype.before = function (msg, session, next){
    if(msg.content && msg.content.indexOf ('fuck') !== -1){
        session.__abuse__ = true;
        msg.content = msg.content.replace ('fuck', '****');
    }
    next();
};

Filter.prototype.after = function (err, msg, session, resp, next){
    if(session.__abuse__){
        var user_info = session.uid.split ('*');
        console.log ('abuse:' + user_info[0] + "at room" + user_info[1]);
    }
    next(err);
};