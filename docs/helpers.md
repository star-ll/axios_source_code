# Helpers

helpers模块中存放的都是一些工具类函数，这些工具类函数与axios无关，理论上，这些模块可以自己发布给npm，并由其他模块或应用程序使用，Helpers模块的作用包括不限于：

- 浏览器Polyfills
- 管理cookie
- 解析HTTP头部

> 由于Helpers中的模块与axios无关，主要用于解决某一特定的问题，因此在本章会实现一些具体的例子。

## bind

在[Axios构造函数](/core.html#axios)中我们已经见过了`bind`，我们来看一下`bind`的具体代码：

```js
module.exports = function bind(fn, thisArg) {
  return function wrap() {
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }
    return fn.apply(thisArg, args);
  };
};
```

其实`bind`函数相当于`fn.bind()`方法的polyfill，两者实现的效果是相同的，可以用两者对照来看。

```js
function bind(fn, thisArg) {
	return function wrap() {
		var args = new Array(arguments.length);
		for (var i = 0; i < args.length; i++) {
			args[i] = arguments[i];
		}
		return fn.apply(thisArg, args);
	};
}

const context = {};
const fn1 = bind(function (...args) {
	console.log(this);
	console.log(args);
}, context);
const fn2 = function (...args) {
	console.log(this);
	console.log(args);
};

console.log(fn1(1, 2, 3)); // context  [1,2,3]
console.log(fn2.bind(context, 1, 2, 3)());  // context  [1,2,3]
```

## combineURLs

`combineURLs`的作用是拼接`baseURL`和`relativeURL`，并处理好中间的`/`字符，它的实现思路也很简单，将`baseURL`最后的`/`和relativeURL前面的`/`删除，然后拼接的时候加上，具体代码：

```js
module.exports = function combineURLs(baseURL, relativeURL) {
	return relativeURL
		? baseURL.replace(/\/+$/, "") + "/" + relativeURL.replace(/^\/+/, "")
		: baseURL;
};
```

可以执行看下效果。

```js
const config = {
	baseURL: "https://yujin123.cn/",
};
function handleURL(url) {
	return combineURLs(config.baseURL, url);
}
// 假设忘记baseURL末尾有/的时候
console.log(handleURL("/about"));
// https://yujin123.cn/about
```



## buildURL

buildURL函数的作用是`params`拼接到`url`中，此外还有一个可选的`paramsSerializer`参数，主要用于序列化`params`。

```js
function encode(val) {
	return encodeURIComponent(val)
		.replace(/%40/gi, "@")
		.replace(/%3A/gi, ":")
		.replace(/%24/g, "$")
		.replace(/%2C/gi, ",")
		.replace(/%20/g, "+")
		.replace(/%5B/gi, "[")
		.replace(/%5D/gi, "]");
}

function buildURL(url, params, paramsSerializer) {
	if (!params) {
		return url;
	}

	var serializedParams;
	if (paramsSerializer) {
        // 由paramsSerializer提供params序列化
		serializedParams = paramsSerializer(params);
	} else if (utils.isURLSearchParams(params)) {
        // 如果params是URLSearchParams，那么只需要调用toString方法转换成字符串即可。
		serializedParams = params.toString();
	} else {
        // 如果params是对象，并且没有提供paramsSerializer，则需要手动进行序列化
		var parts = [];

        // 遍历params对象
		utils.forEach(params, function serialize(val, key) {
			if (val === null || typeof val === "undefined") {
				return;
			}

			if (utils.isArray(val)) {
				key = key + "[]";
			} else {
				val = [val];
			}

			utils.forEach(val, function parseValue(v) {
				if (utils.isDate(v)) {
					v = v.toISOString();
				} else if (utils.isObject(v)) {
					v = JSON.stringify(v);
				}
				parts.push(encode(key) + "=" + encode(v));
			});
		});

		serializedParams = parts.join("&");
	}

	if (serializedParams) {
		var hashmarkIndex = url.indexOf("#");
		if (hashmarkIndex !== -1) {
			url = url.slice(0, hashmarkIndex);
		}

		url += (url.indexOf("?") === -1 ? "?" : "&") + serializedParams;
	}

	return url;
}
```

这里主要分为三种情况，根据三种不同的情况进行不同的处理：

- 用户提供了`paramsSerializer`函数来序列化`params`
- 没有提供`paramsSerializer`，但是`params`是一个`URLSearchParams`对象
- 没有提供`paramsSerializer`，params也不是一个`URLSearchParams`对象

这里重点来看第三种情况，在这种情况下需要axios自己去处理params，这里首先会判断params中是否有属性是数组，如果有则在key上加上`[]`标识，否则将该数组包裹一层变为数组，然后遍历数组。

在遍历的过程中需要处理`Object`和`Date`的情况：

- 如果params中有Date对象，则将其转换成ISOString格式。
- 如果params中有对象类型的属性，则将其转换成JSON字符串。

然后将params中所有的属性进行拼接，使用`&`字符分隔，`?`字符开头，如果`params`中某个属性是数组，例如`{a:[1,2]}`，那么将转换成`?a=1&a=2`的形式。这里还要注意的是`url`要删除`hash`片段，即`#`开头的部分。

我们使用使用一台nodejs服务器来看一下具体效果：

```js
// 浏览器
axios.get('/get/server', {
    params: {
        a: 1,
        b: {
            c: 2
        }
    }
})
// http://localhost:3000/get/server?a=1&b=%7B%22c%22:2%7D

// nodejs
console.log(new URLSearchParams(urlObj.parse(req.url).query));
// URLSearchParams { 'a' => '1', 'b' => '{"c":2}' }
```



## cookies

原生JavaScript操作cookie非常繁琐，通常都是先进行一层封装再使用。

> 注意：如果你对cookie不太了解，可以先看下这篇文章[MDN-Cookies](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Cookies)

```js
module.exports = (
  utils.isStandardBrowserEnv() ?

  // Standard browser envs support document.cookie
    (function standardBrowserEnv() {
      return {
        write: function write(name, value, expires, path, domain, secure) {
          var cookie = [];
          cookie.push(name + '=' + encodeURIComponent(value));

          if (utils.isNumber(expires)) {
            cookie.push('expires=' + new Date(expires).toGMTString());
          }

          if (utils.isString(path)) {
            cookie.push('path=' + path);
          }

          if (utils.isString(domain)) {
            cookie.push('domain=' + domain);
          }

          if (secure === true) {
            cookie.push('secure');
          }

          document.cookie = cookie.join('; ');
        },

        read: function read(name) {
          var match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
          return (match ? decodeURIComponent(match[3]) : null);
        },

        remove: function remove(name) {
          this.write(name, '', Date.now() - 86400000);
        }
      };
    })() :

  // Non standard browser env (web workers, react-native) lack needed support.
    (function nonStandardBrowserEnv() {
      return {
        write: function write() {},
        read: function read() { return null; },
        remove: function remove() {}
      };
    })()
);
```

`axios`会进行平台检测，如果是在`react-native`这类不存在`cookie`的平台运行，则不会对`document.cookie`进行任何操作。

axios主要对cookie实现了增、删和读三种操作，其中增加cookie字段的方式是使用一个数组cookie，然后将`name, value, expires, path, domain, secure`这几个字段分别加入到cookie中，然后在使用`;`字符作为分割符进行拼接。

```js
write('b','123',new Date().getTime() + 1000 * 60 * 60 * 24, '/')
// 相当于
document.cookie = 'b=123;path=/;expires=Sun, 02 Oct 2022 16:16:38 GMT;secure=true'
```

读取操作则使用了`String.match`进行正则匹配，cookie字符串的格式是`${name}=${value}`，使用`; ` 符号分割：

```js
console.log(document.cookie)
// 'a=123; b=123; c=123'
```

axios使用了一个正则表达式来提取`name`和`value`：

```js
function read(name) {
    var match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
    return (match ? decodeURIComponent(match[3]) : null);
},
```

为了简单起见，我们假设name传入的是字符串`a`，然后我们再来看正则表达式，`new RegExp('(^|;\\s*)(' + name + ')=([^;]*)')`就等于`/(^|;\s*)(a)=([^;]*)/`。我们简单来分析一下这个正则表达式。

```js
/(^|;\s*)(a)=([^;]*)/
```

第一个分组：` (^|;\s*)  `：`^`表示开头，`|`是或的意思，`\s`匹配空格，后面加上`*`表示空格是0个或者多个，也就是说这段匹配的是字符串开头或者以`; `开头的部分，而第二个分组包裹的就是`name`，第三个包裹的是`value`。

这里使用的是String.prototype.match方法，当不使用g标志时，该方法就会返回第一个匹配项和分组，也就是说：

```js
//假设当前cookie字符串是cookie ===  'a=1; b=2';
// 那么document.cookie.match(new RegExp('(^|;\\s*)(' + a + ')=([^;]*)'))的返回值就是
/*
 ['a=1', '', 'a', '1', index: 0, input: 'a=1; b=2', groups: undefined];
*/
```

很明显`match[3]`得到的正是匹配项的`value`值部分，在这个例子里是`1`。关于`String.prototype.match`更详细的介绍可以看[MDN-String.prototype.match()](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/String/match#%E8%BF%94%E5%9B%9E%E5%80%BC)。

最后的删除操作只需要修改cookie的expiress字段为过去的日期即可。

```js
function remove(name) {
    this.write(name, '', Date.now() - 86400000);
}
```

## isAbsoluteURL

`isAbsoluteURL`函数的作用是判断一个URL是否是绝对URL，判断的方法是利用正则表达式去检测是否有协议头，例如`http://`、`ftp://`等。

具体代码：

```js
module.exports = function isAbsoluteURL(url) {
  // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
  // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
  // by any combination of letters, digits, plus, period, or hyphen.
  return /^([a-z][a-z\d\+\-\.]*:)?\/\//i.test(url);
};
```



## isURLSameOrigin

`isURLSameOrigin`函数的作用是判断一个URL是否与当前页面URL同源。对于同源我们都知道需要协议(protocal)、域名(hostname)、以及端口(port)都相同才能算得上是同源，因此`isURLSameOrigin`函数的最终目的就是比较这三部分内容，只不过在此之前需要先提取`host`、`port`这些属性，`axios`使用的方法是通过创建`a`元素节点来获取这些属性。

```js
// 和cookie一样，需要检测当前环境
module.exports = utils.isStandardBrowserEnv()
	? // Standard browser envs have full support of the APIs needed to test
	  // whether the request URL is of the same origin as current location.
	  (function standardBrowserEnv() {
             // 这里的`msie`变量主要是表示是否是IE浏览器。
			var msie = /(msie|trident)/i.test(navigator.userAgent);
			var urlParsingNode = document.createElement("a");
			var originURL;

			/**
			 * Parse a URL to discover it's components
			 *
			 * @param {String} url The URL to be parsed
			 * @returns {Object}
			 */
			function resolveURL(url) {
				var href = url;

				if (msie) {
					// IE needs attribute set twice to normalize properties
					urlParsingNode.setAttribute("href", href);
					href = urlParsingNode.href;
				}

				urlParsingNode.setAttribute("href", href);

				// urlParsingNode provides the UrlUtils interface - http://url.spec.whatwg.org/#urlutils
				return {
					href: urlParsingNode.href,
					protocol: urlParsingNode.protocol
						? urlParsingNode.protocol.replace(/:$/, "")
						: "",
					host: urlParsingNode.host,
					search: urlParsingNode.search
						? urlParsingNode.search.replace(/^\?/, "")
						: "",
					hash: urlParsingNode.hash
						? urlParsingNode.hash.replace(/^#/, "")
						: "",
					hostname: urlParsingNode.hostname,
					port: urlParsingNode.port,
					pathname:
						urlParsingNode.pathname.charAt(0) === "/"
							? urlParsingNode.pathname
							: "/" + urlParsingNode.pathname,
				};
			}

			originURL = resolveURL(window.location.href);

			/**
			 * Determine if a URL shares the same origin as the current location
			 *
			 * @param {String} requestURL The URL to test
			 * @returns {boolean} True if URL shares the same origin, otherwise false
			 */
			return function isURLSameOrigin(requestURL) {
				var parsed = utils.isString(requestURL)
					? resolveURL(requestURL)
					: requestURL;
				return (
					parsed.protocol === originURL.protocol &&
					parsed.host === originURL.host
				);
			};
	  })()
	: // Non standard browser envs (web workers, react-native) lack needed support.
	  (function nonStandardBrowserEnv() {
			return function isURLSameOrigin() {
				return true;
			};
	  })();
```

这段代码里有两个主要的函数`resolveURL`和`isURLSameOrigin`，`resolveURL`的作用是将URL字符串转换成URL对象，而`isURLSameOrigin`函数的作用就是判断`requestURL`是否和当前`URL`同源，注意`isURLSameOrigin`函数只判断了`host`和`protocol`属性，这是因为`host`相当于`hostname + port`。

axios利用a元素节点来获取URL的host等信息，我们可以在控制台尝试一下：

```js
const a = document.createElement('a');
a.setAttribute('href', window.location.href);
console.log(
a.href,
a.host,
a.hostname,
a.port,
a.protocol,
a.search || 'null' ,
a.pathname,
a.hash || 'null'
)
// http://localhost:3000/get localhost:3000 localhost 3000 http: null /get null
```

可以看到，基本上都能得到我们需要的信息，只不过部分数据需要再处理一遍，例如`a.protocol`需要删除后面的`:`。

事实上，`axios`这样处理很大程度上是为了浏览器兼容性，如果不考虑浏览器兼容性，我们可以更简短的代码。

```js
function isURLSameOrigin(requestURL) {
    const parsed = typeof requestURL === 'string' ? new URL(requestURL) : requestURL
    console.log(parsed, window.location);
    return parsed.protocol === window.location.protocol &&
        parsed.host === window.location.host
}
console.log(isURLSameOrigin(window.location.href));  // true
console.log(isURLSameOrigin('https://xxx.com'));  // false
```

## normalizeHeaderName

`normalizeHeaderName`函数的作用是格式化`HTTP Header`字段。函数接收`headers`对象和`normalizedName`(格式化后的name)两个参数，并会将`headers`对象中原本错误的`name`修改成`normalizedName`。

```js
module.exports = function normalizeHeaderName(headers, normalizedName) {
  utils.forEach(headers, function processHeader(value, name) {
    if (name !== normalizedName && name.toUpperCase() === normalizedName.toUpperCase()) {
      headers[normalizedName] = value;
      delete headers[name];
    }
  });
};
```

看完代码后其实不难理解，这个函数主要是处理Header字段大小写错误的问题，例如将`content-type`改为`Content-Type`。

可以用ES6语法改成更易理解的代码：

```js
function normalizeHeaderName(headers, normalizedName) {
	for (let name of Object.keys(headers)) {
		const value = headers[name];
        // normalizedName和name相同，但是两者中有字符大小写不同
		if (
			name !== normalizedName &&
			name.toUpperCase() === normalizedName.toUpperCase()
		) {
			headers[normalizedName] = value;
			delete headers[name];
		}
	}
}

const headers = {
	"content-type": "application/json",
};
normalizeHeaderName(headers, "Content-type");
console.log(headers);
// { 'Content-type': 'application/json' }
```

## parseHeaders

`parseHeaders`函数的作用是处理响应头，将`Response Headers`字符串转换成对象。

```js
var ignoreDuplicateOf = [
  'age', 'authorization', 'content-length', 'content-type', 'etag',
  'expires', 'from', 'host', 'if-modified-since', 'if-unmodified-since',
  'last-modified', 'location', 'max-forwards', 'proxy-authorization',
  'referer', 'retry-after', 'user-agent'
];

module.exports = function parseHeaders(headers) {
  var parsed = {};
  var key;
  var val;
  var i;

  if (!headers) { return parsed; }

  utils.forEach(headers.split('\n'), function parser(line) {
    i = line.indexOf(':');
    key = utils.trim(line.substr(0, i)).toLowerCase();
    val = utils.trim(line.substr(i + 1));

    if (key) {
      if (parsed[key] && ignoreDuplicateOf.indexOf(key) >= 0) {
        return;
      }
      if (key === 'set-cookie') {
        parsed[key] = (parsed[key] ? parsed[key] : []).concat([val]);
      } else {
        parsed[key] = parsed[key] ? parsed[key] + ', ' + val : val;
      }
    }
  });

  return parsed;
};
```

HTTP响应的格式是这样的:

1. 首行（HTTP协议版本 状态码 状态码描述文本）
2. 响应头
3. 空行
4. 响应体

其中响应头的格式是`<name>: <value>`，多个响应头字段以`\n`分隔，请看下面的一个示例：

```
HTTP/1.1 200 OK
Content-Type: text/html
Date: Wed, 05 Oct 2022 03:41:36 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked
```

现在回过头来看axios处理headers的代码应该已经很好理解了，首先先将headers字符串以`\n`作为分隔转成数组，并遍历这个数组，然后以`:`为分隔符获取`name`和`value`。

axios额外做了两个处理，一个是忽略部分HTTP响应头字段，例如etag字段，这些字段通常用不上。

```js
var ignoreDuplicateOf = [
  'age', 'authorization', 'content-length', 'content-type', 'etag',
  'expires', 'from', 'host', 'if-modified-since', 'if-unmodified-since',
  'last-modified', 'location', 'max-forwards', 'proxy-authorization',
  'referer', 'retry-after', 'user-agent'
];
if (parsed[key] && ignoreDuplicateOf.indexOf(key) >= 0) {
    return;
}
```

另一个是对多次出现的字段进行处理，例如将多个`Set-Cookie`字段的值存到一个数组中，对于其他的多次出现的字段则用`,`分隔开。
