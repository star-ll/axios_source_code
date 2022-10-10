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
- 超时机制
- 取消HTTP请求
- 下载进度
- 上传
- 响应Promise化

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

