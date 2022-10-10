# Adapters

**Adapters**下的模块主要用于发送请求和将响应Promise化。

Adapters下主要有两个模块文件：

- http（Nodejs环境）
- xhr（浏览器环境）

## xhr

XMLHttpRequest（XHR）对象用于与服务器交互。通过 XMLHttpRequest 可以在不刷新页面的情况下请求特定 URL，获取数据。这允许网页在不影响用户操作的情况下，更新页面的局部内容。XMLHttpRequest 在 AJAX 编程中被大量使用。

### 基于xhr对象发送HTTP请求
> 注意：如果你对xhr不了解，可以先看这篇[介绍](https://developer.mozilla.org/zh-CN/docs/Web/API/XMLHttpRequest)
> 
用xhr发送一个Get HTTP请求的例子：

```js
function xhrAdapter(config) {
    const request = new XMLHttpRequest()
    // 构建请求url
     var fullPath = buildFullPath(config.baseURL, config.url);
     // 相较于fullPath多了params
     var fullPathAndParams = buildURL(fullPath, config.params, config.paramsSerializer)
    // 三个参数分别表示http方法，请求url，是否异步
    request.open(config.method.toUpperCase(), fullPathAndParams, true);
    // 发送请求
    request.send(config.data)
}
```

这是一个简单的示例，通过`buildFullPath`函数拼接baseURL和path，然后在调用`buildURL`来拼接params参数，最后发送Http请求。

但是这样的例子只能发送简单的请求，无法满足复杂的场景，通常情况下我们还需要做到：

- Basic身份验证
- 自定义请求头
- withCredentials
- XSRF Token
- 响应Promise化
- 超时机制
- 下载/上传进度
- 取消HTTP请求

### Basic身份验证

Basic身份验证是HTTP身份验证的其中一种方案，它将用户名和密码以`:`为分隔符拼接并base64后，直接明文传输给服务器，因此Basic身份验证方案是不安全的，通常需要与HTTPS一同使用。

使用Basic Authorization其实也非常简单，只需要在处理好后的base64字符串前面添加`Basic `作为标识，然后放到`Authorization`请求头字段中发送到服务器即可。

```js
function xhrAdapter(config) {
    const request = new XMLHttpRequest()
    // 构建请求url
    var fullPath = buildFullPath(config.baseURL, config.url);
    // 相较于fullPath多了params
    var fullPathAndParams = buildURL(fullPath, config.params, config.paramsSerializer)
    // 三个参数分别表示http方法，请求url，是否异步
    request.open(config.method.toUpperCase(), fullPathAndParams, true);

    // basic Authorization
    if (config.auth) {
            var username = config.auth.username || '';
            var password = config.auth.password || '';
            request.setRequestHeader('Authorization', 'Basic ' + btoa(username + ':' + password))
        }

    // 发送请求
    request.send(config.data)
}

xhrAdapter({
    method: "get",
    baseURL: "http://localhost:5500",
    url: "/api/getList",
    auth: {
        username: '123123',
        password: "123123"
    }
})
```
可以在浏览器开发者工具-网络中看到HTTP请求头信息：
```
GET //api/getList HTTP/1.1
Accept: */*
Accept-Encoding: gzip, deflate, br
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6
Authorization: Basic MTIzMTIzOjEyMzEyMw==
...
```

### 自定义请求头

前面其实已经演示过xhr如何添加请求头了，我们只需要遍历请求头对象，然后将调用`setRequestHeader`添加即可。


```js
function xhrAdapter(config) {
    const request = new XMLHttpRequest()
    // ...（省略部分代码）
    // 三个参数分别表示http方法，请求url，是否异步
    request.open(config.method.toUpperCase(), fullPathAndParams, true);

    var requestData = config.data;
    var requestHeaders = config.headers

    // 处理basic
    if (config.auth) {
        var username = config.auth.username || '';
        var password = config.auth.password || '';
        // 不再直接调用setRequestHeader，而且先添加到requestHeaders中，然后统一添加。
        requestHeaders.Authorization = 'Basic ' + btoa(username + ':' + password)
    }

    // HTTP Headers
    if ('setRequestHeader' in request) {
        for (const [key, val] of Object.entries(requestHeaders)) {
            if (typeof requestData === 'undefined' && key.toLowerCase() === 'content-type') {
                // 如果data为空，则移除content-type字段
                delete requestHeaders[key];
            } else {
                // 否则添加到请求头
                request.setRequestHeader(key, val);
            }
        }

    }

    // 发送请求
    request.send(requestData)
}

xhrAdapter({
    method: "get",
    baseURL: "http://localhost:5500",
    url: "/api/getList",
    auth: {
        username: '123123',
        password: "123123"
    },
    headers: {
        a: 1,
        b: 2
    }
})
```

这里有一个判断语句，如果请求体为空并且`config.headers`传递了`content-type`字段，则会删除该属性，不会将其添加到HTTP请求头上。这是因为`content-type`的作用是指明资源的MIME类型，在HTTP请求中该字段相当于告诉服务器发送的数据类型。

最终发送的HTTP请求头如下所示：

```
GET //api/getList HTTP/1.1
Accept: */*
Accept-Encoding: gzip, deflate, br
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6
Authorization: Basic MTIzMTIzOjEyMzEyMw==
a: 1
b: 2
...
```

### withCredentials

XMLHttpRequest.withCredentials 属性是一个 Boolean 类型，表示是否要在**跨域请求**中携带登录凭证（例如cookie、Authorization等），主要这只在跨域请求中有效，在同源请求中无效。

在xhr(XMLHttpRequest)中，可以通过设置withCredentials属性来控制。

```js
function xhrAdapter(config) {
    // ...(省略部分代码)

    if (config.withCredentials != null) {
        request.withCredentials = !!config.withCredentials;
    }

    // 发送请求
    request.send(requestData)
}

xhrAdapter({
    method: "POST",
    baseURL: "http://localhost:3000",  // 注意这里改了端口号，现在是非同源URL
    url: "/api/getList",
    withCredentials: true
})
```

然后设置一个cookie，查看在跨域请求中是否会被携带。

```js
document.cookie = 'a=1'
```

可以查看HTTP请求结果。

```
// withCredentials为true时
GET /api/getList HTTP/1.1
Accept: */*
Accept-Encoding: gzip, deflate, br
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6
Connection: keep-alive
Cookie: a=1
...

// withCredentials为false时
GET /api/getList HTTP/1.1
Accept: */*
Accept-Encoding: gzip, deflate, br
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6
Connection: keep-alive
...
```

### XSRF-Token

跨站请求伪造（CSRF/XSRF）是一种冒充受信任用户，向服务器发送非预期请求的攻击方式。通常是引诱用户进入攻击网站，然后网站发送携带包含登录凭证的第三方cookie的HTTP请求，来冒充用户进行某些敏感操作。最常见的防御手段是使用Token。

axios提供`xsrfCookieName`和`xsrfHeaderName`两个配置项，分别表示XSRF Token在cookie中的name和XSRF Token在HTTP请求头中的name，axios会根据`xsrfCookieName`从cookie读取XSRF Token，然后将其添加到每次HTTP请求的`xsrfHeaderName`头部字段中。

```js
function xhrAdapter(config) {
    // ...(省略部分代码)

    if (config.xsrfCookieName != null) {
        var cookies = require('./../helpers/cookies');

        // Add xsrf header
        var xsrfValue = (config.withCredentials || isURLSameOrigin(fullPath)) && config.xsrfCookieName ?
            cookies.read(config.xsrfCookieName) :
            undefined;

        if (xsrfValue) {
            requestHeaders[config.xsrfHeaderName] = xsrfValue;
        }
    }

    // 发送请求
    request.send(requestData)
}
```

> 注意： cookie.read()方法的作用是根据name读取cookie的值，具体见[Helpers-cookie](/helpers.html#cookies)

这段代码中对`xsrfValue`赋值进行了判断，只有当`xsrfCookieName`为真值，且请求URL与当前页面URL同源(`isURLSameOrigin(fullPath))`)或设置了withCredentials(`config.withCredentials`)才会生效。这是因为在跨域请求中需要设置`xhr.withCredentials`属性为true才能携带登录凭证(例如cookie，Authorization请求头)，如果请求是同源则不需要设置这个属性。**因此只有当请求是同源或者跨域请求但开启了withCredentials时，才会让XSRF-Token生效。**

### HTTP响应结果Promise化

axios一个很大的亮点在于它将xhr响应结果原本的异步回调的风格改为了Promise风格，使得可以使用Promise的方式来操作HTTP请求的响应结果。

实现起来比较简单，只需要在外套一层Promise，然后监听事件，要监听的事件主要有四个：
1. readystatechange 响应回调
2. error  错误回调
3. abort 取消回调
4. timeout 超时回调

```js
function xhrAdapter(config) {
    return new Promise((resolve, reject) => {
        // ...（省略部分代码）

        request.onreadystatechange = function () {
            if (this.readyState !== 4) {
                return;
            }

            var response = {
                data: !config.responseType || config.responseType === 'text' ? request
                    .responseText : request.response,
                status: request.status,
                statusText: request.statusText,
                headers: request.getAllResponseHeaders(),
                config: config,
                request: request
            };
            resolve(response)
            request = null;
        }
        request.onerror = function handleError() {
            reject({
                message: 'Network Error',
                config,
                request
            });

            request = null;
        };
        request.ontimeout = function handleTimeout() {

            reject({
                message: 'Request timeout',
                config,
                request
            });

            request = null;
        };
        request.onabort = function handleAbort() {
            // 当出现错误、超时或者已经得到响应结果时，不再触发abort事件。
            if (!request) {
                return;
            }

            reject({
                message: 'Request aborted',
                config,
                request
            });

            request = null;
        };

        // 发送请求
        request.send(requestData)
    })
}

xhrAdapter({
    method: "get",
    baseURL: "http://localhost:3000",
    url: "/api/getList",
    headers: {},
}).then((res) => {
    console.log(res);
}).catch((err) => {
    console.error(err);
})
```

### 超时机制

xhr自带超时机制，只需要传递`xhr.timeout`属性即可，超时会触发`xhr.onabort`回调，这在上面一节有讲。

```js
// Set the request timeout in MS
request.timeout = config.timeout;
```

### 下载/上传进度

在某些场景下需要获取下载/上传进度，这个时候可以传递一个回调函数，作为xhr `progress`事件的事件处理程序即可。

```js
// 下载进度回调
if (typeof config.onDownloadProgress === 'function') {
    request.addEventListener('progress', config.onDownloadProgress);
}

// request.upload确定平台是否支持upload功能
if (typeof config.onUploadProgress === 'function' && request.upload) {
    request.upload.addEventListener('progress', config.onUploadProgress);
}
```

### 取消请求

通过调用xhr.abort()方法可以取消请求，axios在这部分做了更复杂地处理，但是目前我们只需要实现最基本的功能，更细致的处理在Cancel模块讲解。

```js
if (config.cancelToken) {
    // Handle cancellation
    config.cancelToken.promise.then(function onCanceled(cancel) {
    if (!request) {
        return;
    }

    request.abort();
    reject(cancel);
    // Clean up request
    request = null;
    });
}
```

这里简单讲讲`config.cancelToken`，`config.cancelToken`是一个包含`promise`属性的对象，这个`promise`属性是一个Promise，并且它会将自己的`resolve`函数通过某种方式暴露给用户，当用户调用`resolve()`时就会触发上面的代码，从而取消请求。


### 小结

Adapter/xhr 模块主要是对xhr对象的封装，主要实现了以下功能：

- Basic身份验证
- 自定义请求头
- withCredentials
- XSRF Token
- 响应Promise化
- 超时机制
- 下载/上传进度
- 取消HTTP请求

根据axios的思路，我们基本上完成了xhr的简单封装，并且也实现了上面的功能，axios出于浏览器兼容性等方面的考虑，实际代码会比我们写的复杂一些，但是总体思路不变。

附完整代码：

```js
function xhrAdapter(config) {
    return new Promise((resolve, reject) => {
        var request = new XMLHttpRequest()

        // 实际代码会进行处理，这里为了方便直接拼接
        const fullPathAndParams = config.baseURL + config.url

        // 三个参数分别表示http方法，请求url，是否异步
        request.open(config.method.toUpperCase(), fullPathAndParams, true);

        var requestData = config.data;
        var requestHeaders = config.headers

        request.timeout = config.timeout;


        // basic Authorization
        if (config.auth) {
            var username = config.auth.username || '';
            var password = config.auth.password || '';
            requestHeaders.Authorization = 'Basic ' + btoa(username + ':' + password)
        }

        // withCredentials
        if (config.withCredentials != null) {
            request.withCredentials = !!config.withCredentials;
        }

        // xsrf Token
        if (config.xsrfCookieName != null) {
            // 见Helpers-cookie
            // var cookies = require('./../helpers/cookies');
            var cookies = {
                read(name) {
                    var match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
                    return (match ? decodeURIComponent(match[3]) : null);
                },
            }

            // Add xsrf header
            var xsrfValue = (config.withCredentials || isURLSameOrigin(fullPath)) && config.xsrfCookieName ?
                cookies.read(config.xsrfCookieName) :
                undefined;

            if (xsrfValue) {
                requestHeaders[config.xsrfHeaderName] = xsrfValue;
            }
        }

        request.onreadystatechange = function () {
            if (this.readyState !== 4) {
                return;
            }

            var response = {
                data: !config.responseType || config.responseType === 'text' ? request
                    .responseText : request.response,
                status: request.status,
                statusText: request.statusText,
                headers: request.getAllResponseHeaders(),
                config: config,
                request: request
            };
            resolve(response)
            request = null;
        }
        request.onerror = function handleError() {
            reject({
                message: 'Network Error',
                config,
                request
            });

            request = null;
        };
        request.ontimeout = function handleTimeout() {

            reject({
                message: 'Request timeout',
                config,
                request
            });

            request = null;
        };
        request.onabort = function handleAbort() {
            if (!request) {
                return;
            }

            reject({
                message: 'Request aborted',
                config,
                request
            });

            request = null;
        };

        // HTTP Headers
        if ('setRequestHeader' in request) {
            for (const [key, val] of Object.entries(requestHeaders)) {
                if (typeof requestData === 'undefined' && key.toLowerCase() === 'content-type') {
                    // 如果data为空，则移除content-type字段
                    delete requestHeaders[key];
                } else {
                    // 否则添加到请求头
                    request.setRequestHeader(key, val);
                }
            }
        }

        if (typeof config.onDownloadProgress === 'function') {
            request.addEventListener('progress', config.onDownloadProgress);
        }


        if (typeof config.onUploadProgress === 'function' && request.upload) {
            request.upload.addEventListener('progress', config.onUploadProgress);
        }

        if (config.cancelToken) {
            // Handle cancellation
            config.cancelToken.promise.then(function onCanceled(cancel) {
                if (!request) {
                    return;
                }

                request.abort();
                reject(cancel);
                // Clean up request
                request = null;
            });
        }

        // 发送请求
        request.send(requestData || null)
    })
}

xhrAdapter({
    method: "get",
    baseURL: "http://localhost:3000",
    url: "/api/getList",
    headers: {},
}).then((res) => {
    console.log(res);
}).catch((err) => {
    console.error(err);
})
```

附上axios源码：

```js
'use strict';

var utils = require('./../utils');
var settle = require('./../core/settle');
var buildURL = require('./../helpers/buildURL');
var buildFullPath = require('../core/buildFullPath');
var parseHeaders = require('./../helpers/parseHeaders');
var isURLSameOrigin = require('./../helpers/isURLSameOrigin');
var createError = require('../core/createError');

module.exports = function xhrAdapter(config) {
  return new Promise(function dispatchXhrRequest(resolve, reject) {
    var requestData = config.data;
    var requestHeaders = config.headers;

    if (utils.isFormData(requestData)) {
      delete requestHeaders['Content-Type']; // Let the browser set it
    }

    var request = new XMLHttpRequest();

    // HTTP basic authentication
    if (config.auth) {
      var username = config.auth.username || '';
      var password = config.auth.password || '';
      requestHeaders.Authorization = 'Basic ' + btoa(username + ':' + password);
    }

    var fullPath = buildFullPath(config.baseURL, config.url);
    request.open(config.method.toUpperCase(), buildURL(fullPath, config.params, config.paramsSerializer), true);

    // Set the request timeout in MS
    request.timeout = config.timeout;

    // Listen for ready state
    request.onreadystatechange = function handleLoad() {
      if (!request || request.readyState !== 4) {
        return;
      }

      // The request errored out and we didn't get a response, this will be
      // handled by onerror instead
      // With one exception: request that using file: protocol, most browsers
      // will return status as 0 even though it's a successful request
      if (request.status === 0 && !(request.responseURL && request.responseURL.indexOf('file:') === 0)) {
        return;
      }

      // Prepare the response
      var responseHeaders = 'getAllResponseHeaders' in request ? parseHeaders(request.getAllResponseHeaders()) : null;
      var responseData = !config.responseType || config.responseType === 'text' ? request.responseText : request.response;
      var response = {
        data: responseData,
        status: request.status,
        statusText: request.statusText,
        headers: responseHeaders,
        config: config,
        request: request
      };

      settle(resolve, reject, response);

      // Clean up request
      request = null;
    };

    // Handle browser request cancellation (as opposed to a manual cancellation)
    request.onabort = function handleAbort() {
      if (!request) {
        return;
      }

      reject(createError('Request aborted', config, 'ECONNABORTED', request));

      // Clean up request
      request = null;
    };

    // Handle low level network errors
    request.onerror = function handleError() {
      // Real errors are hidden from us by the browser
      // onerror should only fire if it's a network error
      reject(createError('Network Error', config, null, request));

      // Clean up request
      request = null;
    };

    // Handle timeout
    request.ontimeout = function handleTimeout() {
      var timeoutErrorMessage = 'timeout of ' + config.timeout + 'ms exceeded';
      if (config.timeoutErrorMessage) {
        timeoutErrorMessage = config.timeoutErrorMessage;
      }
      reject(createError(timeoutErrorMessage, config, 'ECONNABORTED',
        request));

      // Clean up request
      request = null;
    };

    // Add xsrf header
    // This is only done if running in a standard browser environment.
    // Specifically not if we're in a web worker, or react-native.
    if (utils.isStandardBrowserEnv()) {
      var cookies = require('./../helpers/cookies');

      // Add xsrf header
      var xsrfValue = (config.withCredentials || isURLSameOrigin(fullPath)) && config.xsrfCookieName ?
        cookies.read(config.xsrfCookieName) :
        undefined;

      if (xsrfValue) {
        requestHeaders[config.xsrfHeaderName] = xsrfValue;
      }
    }

    // Add headers to the request
    if ('setRequestHeader' in request) {
      utils.forEach(requestHeaders, function setRequestHeader(val, key) {
        if (typeof requestData === 'undefined' && key.toLowerCase() === 'content-type') {
          // Remove Content-Type if data is undefined
          delete requestHeaders[key];
        } else {
          // Otherwise add header to the request
          request.setRequestHeader(key, val);
        }
      });
    }

    // Add withCredentials to request if needed
    if (!utils.isUndefined(config.withCredentials)) {
      request.withCredentials = !!config.withCredentials;
    }

    // Add responseType to request if needed
    if (config.responseType) {
      try {
        request.responseType = config.responseType;
      } catch (e) {
        // Expected DOMException thrown by browsers not compatible XMLHttpRequest Level 2.
        // But, this can be suppressed for 'json' type as it can be parsed by default 'transformResponse' function.
        if (config.responseType !== 'json') {
          throw e;
        }
      }
    }

    // Handle progress if needed
    if (typeof config.onDownloadProgress === 'function') {
      request.addEventListener('progress', config.onDownloadProgress);
    }

    // Not all browsers support upload events
    if (typeof config.onUploadProgress === 'function' && request.upload) {
      request.upload.addEventListener('progress', config.onUploadProgress);
    }

    if (config.cancelToken) {
      // Handle cancellation
      config.cancelToken.promise.then(function onCanceled(cancel) {
        if (!request) {
          return;
        }

        request.abort();
        reject(cancel);
        // Clean up request
        request = null;
      });
    }

    if (requestData === undefined) {
      requestData = null;
    }

    // Send the request
    request.send(requestData);
  });
};
```
