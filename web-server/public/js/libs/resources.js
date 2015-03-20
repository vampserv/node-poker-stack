
/* HELPERS */

// wrap jquery ajax function to reduce redundant code
var AJAX = function(loc, method, contentType, data, callback, failback, headers){
    var me = this;
    var dataStr = null;
    if(!$.isEmptyObject(data) && (contentType == 'application/json' || contentType == 'text/uri-list')){
        dataStr = JSON.stringify(data);
    }else{
        dataStr = data;
    }
    $.ajax({
        type        : method,
        url         : loc.charAt(0) == '/' ? loc : '/rest/'+loc,
        //dataType    : dataType,
        contentType : contentType,
        data        : dataStr,
        beforeSend  : function(xhr){
            if(headers){
                $.each(headers, function(i , header){
                    xhr.setRequestHeader(header.name, header.val);
                });
            }
        }
    }).done(function(result, status, xhr){
        if(typeof callback === typeof Function){
            callback(result, status, xhr);
        }
    }).fail(function(xhr, status, thrownError){
        // handle not authorized status codes to redirect to login page
        if(xhr.status == 403 || xhr.status == 401){

            failback(xhr, status, thrownError);
//            me.cookies.remove('magnet_auth');
//            window.location.replace('/login/');
        }else if(typeof failback === typeof Function){
            failback(xhr, status, thrownError);
        }
    });
};

// basic HTML5 upload component - Firefox, Google Chrome and Safari ONLY
function uploader(id, url, property, type){
    var file = document.getElementById(id).files[0];
    uploadFile(file);
	function uploadFile(file){
        var reader = new FileReader();
        reader.onload = (function(theFile){
            return function(evt){
                AJAX(evt, file);
            };
        }(file));
        reader.readAsArrayBuffer(file);
	}
    function AJAX(evt, file){
		var xhr = new XMLHttpRequest();
		xhr.open("put", url+'/'+property, true);
        if(file.type != ''){
            type = file.type;
        }
		xhr.setRequestHeader("Content-Type", type);
        xhr.send(evt.target.result);
    }
}
// cookies
function Cookie(){}
Cookie.prototype.create = function(name, val, days){
    if(days){
        var date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        var expires = '; expires=' + date.toGMTString();
    }else{
        var expires = '';
    }
    document.cookie = encodeURIComponent(name) + '=' + encodeURIComponent(val) + expires + '; path=/';
}
Cookie.prototype.get = function(name){
    var nameEQ = encodeURIComponent(name) + '=';
    var ca = document.cookie.split(';');
    for(var i=0;i<ca.length;i++){
        var c = ca[i];
        while(c.charAt(0) == ' '){
            c = c.substring(1, c.length)
        };
        if(c.indexOf(nameEQ) == 0){
            return decodeURIComponent(c.substring(nameEQ.length, c.length))
        }
    }
    return null;
}
Cookie.prototype.remove = function(name){
    this.create(name, "", -1);
}
function startLoading(id){
    $('#'+id+' .modal-footer').hide();
    $('#'+id+' .loading.modal-footer').show();
}
function endLoading(id, params){
    $('#'+id+' .modal-footer').show();
    $('#'+id+' .loading.modal-footer').hide();
    if(params){
        $('#'+id+' h4').html(params.title);
        $('#'+id+' .form-horizontal').hide();
        $('#'+id+' .subheading').html(params.text);
    }
}

// utility functions
timer = {
    loops : {},
    poll : function(action, delay, id){
        var me = this;
        //$(id).show();
        me.loops[id] = me.loops[id] || {};
        me.interval(action, delay, id);
        me.loops[id].timer = setInterval(function(){
            if(!me.loops[id].paused){
                me.interval(action, delay, id);
            }
        }, delay+1000);
    },
    interval : function(action, delay, id){
        var me = this;
        var cls = id.replace('#', '');
        ctr = (delay/1000) - 1;
        clearInterval(me.loops[id].ctr);
        me.loops[id].paused = true;
        action(me.loops[id]);
        me.loops[id].ctr = setInterval(function(){
            var html = 'refreshing content in ';
            var min = Math.floor(ctr/60);
            var sec = ctr-min*60;
            if(min > 0){
                html += min+' minutes and ';
            }
            html = 'Processing...';
            $(id).html(html);
            ctr -= 1;
            if(ctr < 0){
                $(id).html('Processing... <img src="/images/ajax-loader-sm.gif" />');
            }
        }, 1000);
    },
    stop : function(id){
        if(!id){
            $.each(this.loops, function(i, loop){
                clearInterval(loop.timer);
                clearInterval(loop.ctr);
            });
        }else{
            if(this.loops[id]){
                clearInterval(this.loops[id].timer);
                clearInterval(this.loops[id].ctr);
            }
        }
    }
}

utils = {
    isCanvasSupported : function(){
        var elem = document.createElement('canvas');
        return !!(elem.getContext && elem.getContext('2d'));
    },
    magnetId : function(str){
        return str.slice(str.lastIndexOf('/')+1);
    },
    cleanName : function(str){
        return str.replace(new RegExp(' ', 'g'), '').replace(new RegExp('-', 'g'), '').replace(new RegExp('_', 'g'), '');
    },
    baseUrl : window.location.href.replace(window.location.hash, '').substr(0, window.location.href.replace(window.location.hash, '').lastIndexOf('/')),
    txtDefaults : function(sel){
        $(sel).focus(function(){
            if(this.value == this.defaultValue){
                this.value = '';
                $(this).css('color', '#000');
            }
        }).blur(function(){
            if(this.value == ''){
                this.value = this.defaultValue;
                $(this).css('color', '#555');
            }
        })
    },
    setIndexOf : function(){
        if(!Array.prototype.indexOf){
            Array.prototype.indexOf = function(elt /*, from*/){
                var len = this.length >>> 0;
                var from = Number(arguments[1]) || 0;
                from = (from < 0) ? Math.ceil(from) : Math.floor(from);
                if(from < 0){
                    from += len;
                }
                for(; from < len; from++){
                    if(from in this && this[from] === elt){
                        return from;
                    }
                }
                return -1;
            };
        }
    },
    getValidJSON : function(str){
        try{
            return JSON.parse(str);
        }catch(e){
            return false;
        }
    },
    convertHeaderStrToObj : function(xhr){
        var dataObj = {};
        $.each(xhr, function(i, val){
            if(($.type(val) == 'string' || $.type(val) == 'number')  && i != 'responseText'){
                dataObj[i] = val;
            }
        });
        $.each(xhr.getAllResponseHeaders().split('\n'), function(i, line){
            var ary = $.trim(line).split(': ');
            if(ary.length > 1){
                dataObj[ary[0]] = ary[1];
            }
        });
        return dataObj;
    },
    hasAllOptionalProperties : function(properties, prefix, total){
        var ctr = 0;
        $.each(properties, function(prop, val){
            if(prop.indexOf(prefix) != -1 && val != ''){
                ++ctr;
            }
        });
        return ctr == total;
    },
    cleanJavaKeywords: function(str){
        var renamed = str.toLowerCase();
        var keywords = ['abstract','assert','boolean','break','byte','case','catch','char','class','const','continue','default','do','double','else','enum','extends','final','finally','float','for','goto','if','implements','import','instanceof','int','interface','long','native','new','package','private','protected','public','return','short','static ','strictfp','super','switch','synchronized','this','throw','throws','transient','try','void','volatile','while'];
        for(var i=keywords.length;i--;){
            if(keywords[i] == renamed){
                str += ' project';
            }
        }
        return str;
    },
    // collect project details from form fields into data object
    collect : function(dom){
        var obj = {}, me = this;
        dom.find('.btn-group:not(.disabled)').each(function(){
            obj[$(this).attr('did')] = $(this).find('button.btn-primary').attr('did');
        });
        dom.find('input[type="radio"]:checked').each(function(){
            var name = $(this).attr('name');
            if(name.indexOf('authMethod') != -1){
                name = name.substr(0, name.indexOf('-'));
            }
            obj[name] = $(this).val();
        });
        dom.find('input[type="text"], select, input[type="password"], textarea').each(function(){
            var val = $(this).val();
            if(typeof $(this).attr('name') != 'undefined'){
                if($(this).attr('name') && $(this).attr('name').indexOf('Port') != -1 && $.trim(val).length == 0){
                    val = 0;
                }
                obj[$(this).attr('name')] = val;
            }
        });
        dom.find('.pill-group > .pill > span:first-child').each(function(){
            var did = $(this).closest('.pillbox').attr('name');
            obj[did] = obj[did] || [];
            obj[did].push($(this).text());
        });
        $.each(obj, function(name, val){
            if(val === 'true'){
                obj[name] = true;
            }
            if(val === 'false'){
                obj[name] = false;
            }
        });
        return obj;
    },
    // remove an item from associative array given a property name
    removeByProp : function(ary, prop, val){
        for(var i=ary.length;i--;){
            if(ary[i][prop] == val){
                ary.splice(i, 1);
            }
        }
    },
    ISO8601ToDT: function(str, isNow){
        try{
            var date = isNow ? new Date() : new Date(str);
            if(isNaN(date)){
                date = this.fromISO8601(str);
            }
            var yyyy = date.getFullYear();
            var mm = this.formatDT(date.getMonth()+1);
            var dd = this.formatDT(date.getDate());
            var hh = this.formatDT(date.getHours());
            var m = this.formatDT(date.getMinutes());
            var ss = this.formatDT(date.getSeconds());
            return mm+'-'+dd+'-'+yyyy+' '+hh+':'+m+':'+ss;
        }catch(e){
            return '';
        }
    },
    formatDT: function(str){
        return str < 10 ? '0'+str : str;
    },
    fromISO8601: function(s){
        var re = /(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(\.\d+)?(Z|([+-])(\d\d):(\d\d))/;
        var d = [];
        d = s.match(re);
        if(!d){
            throw "Couldn't parse ISO 8601 date string '" + s + "'";
        }
        var a = [1,2,3,4,5,6,10,11];
        for(var i in a){
            d[a[i]] = parseInt(d[a[i]], 10);
        }
        d[7] = parseFloat(d[7]);
        var ms = Date.UTC(d[1], d[2] - 1, d[3], d[4], d[5], d[6]);
        if(d[7] > 0){
            ms += Math.round(d[7] * 1000);
        }
        if(d[8] != "Z" && d[10]){
            var offset = d[10] * 60 * 60 * 1000;
            if(d[11]){
                offset += d[11] * 60 * 1000;
            }
            if(d[9] == "-"){
                ms -= offset;
            }else{
                ms += offset;
            }
        }
        return new Date(ms);
    },
    toISO8601 : function(d){
        function pad(n){return n<10 ? '0'+n : n}
        return d.getUTCFullYear()+'-'
          + pad(d.getUTCMonth()+1)+'-'
          + pad(d.getUTCDate())+'T'
          + pad(d.getUTCHours())+':'
          + pad(d.getUTCMinutes())+':'
          + pad(d.getUTCSeconds())+'Z';
    },
    isNumeric : function(n){
        return !isNaN(parseFloat(n)) && isFinite(n);
    },
    // returns whether current browser is an iOS device
    isIOS : function(){
        return /iPhone|iPad|iPod/i.test(navigator.userAgent);
    },
    urlRE: /https?:\/\/([-\w\.]+)+(:\d+)?(\/([^\s]*(\?\S+)?)?)?/g,
    toStaticHTML: function(inputHtml) {
        inputHtml = inputHtml.toString();
        return inputHtml.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    },
    zeroPad: function(digits, n) {
        n = n.toString();
        while(n.length < digits)
            n = '0' + n;
        return n;
    },
    timeString: function(date) {
        var minutes = date.getMinutes().toString();
        var hours = date.getHours().toString();
        return this.zeroPad(2, hours) + ":" + this.zeroPad(2, minutes);
    },
    isBlank: function(text) {
        var blank = /^\s*$/;
        return(text.match(blank) !== null);
    },
    getGUID : function(){
        var d = new Date().getTime();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){
            var r = (d + Math.random()*16)%16 | 0;
            d = Math.floor(d/16);
            return (c=='x' ? r : (r&0x7|0x8)).toString(16);
        });
    },
    getPlural : function(str){
        var lastChar = str.slice(-1);
        if(lastChar === 'y')
            if(['a', 'e', 'i', 'o', 'u'].indexOf(str.charAt(str.length - 2)) != -1)
                return str + 's';
            else
                return str.slice(0, -1) + 'ies';
        else if(str.substring(str.length - 2) === 'us')
            return str.slice(0, -2) + 'i';
        else if (['ch', 'sh'].indexOf(str.substring(str.length - 2)) !== -1 || ['x','s'].indexOf(lastChar) !== -1)
            return str + 'es';
        else
            return str + 's';
    }
};

var RegexValidation = {
    validate : function(input, type){
        if(!input) return false;
        if(type == 'url' && input.indexOf('https://') == -1 && input.indexOf('http://') == -1 && input.indexOf('ftp://') == -1){
            input = 'http://'+input;
        }
        return typeof input == 'string' ? this.validators[type].test(input) : false;
    },
    validators : {
        url : new RegExp(
            "^" +
                // protocol identifier
                "(?:(?:https?|ftp)://)" +
                // user:pass authentication
                "(?:\\S+(?::\\S*)?@)?" +
                "(?:" +
                // IP address exclusion
                // private & local networks
                "(?!10(?:\\.\\d{1,3}){3})" +
                "(?!127(?:\\.\\d{1,3}){3})" +
                "(?!169\\.254(?:\\.\\d{1,3}){2})" +
                "(?!192\\.168(?:\\.\\d{1,3}){2})" +
                "(?!172\\.(?:1[6-9]|2\\d|3[0-1])(?:\\.\\d{1,3}){2})" +
                // IP address dotted notation octets
                // excludes loopback network 0.0.0.0
                // excludes reserved space >= 224.0.0.0
                // excludes network & broacast addresses
                // (first & last IP address of each class)
                "(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])" +
                "(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}" +
                "(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))" +
                "|" +
                // host name
                "(?:(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)" +
                // domain name
                "(?:\\.(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)*" +
                // TLD identifier
                "(?:\\.(?:[a-z\\u00a1-\\uffff]{2,}))" +
                ")" +
                // port number
                "(?::\\d{2,5})?" +
                // resource path
                "(?:/[^\\s]*)?" +
                "$", "i"
        ),
        email : new RegExp("^[-a-z0-9~!$%^&*_=+}{\'?]+(\.[-a-z0-9~!$%^&*_=+}{\'?]+)*@([a-z0-9_][-a-z0-9_]*(\.[-a-z0-9_]+)*\.(aero|arpa|biz|com|coop|edu|gov|info|int|mil|museum|name|net|org|pro|travel|mobi|[a-z][a-z])|([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}))(:[0-9]{1,5})?$", "i")
    }
}
