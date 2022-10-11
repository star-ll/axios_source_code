# Cancel

cancel模块主要的作用是提供取消网络请求的API。官网提供了两种方式来实现取消请求：

```js
const CancelToken = axios.CancelToken;
const source = CancelToken.source();

axios.get('/user/12345', {
  cancelToken: source.token
}).catch(function (thrown) {
  if (axios.isCancel(thrown)) {
    console.log('Request canceled', thrown.message);
  } else {
    // 处理错误
  }
});

axios.post('/user/12345', {
  name: 'new name'
}, {
  cancelToken: source.token
})

// 取消请求（message 参数是可选的）
source.cancel('Operation canceled by the user.');
```

也可以通过传递一个 executor 函数到 CancelToken 的构造函数来创建一个 cancel token：

```js
const CancelToken = axios.CancelToken;
let cancel;

axios.get('/user/12345', {
  cancelToken: new CancelToken(function executor(c) {
    // executor 函数接收一个 cancel 函数作为参数
    cancel = c;
  })
});

// 取消请求
cancel();
```

我们首先实现一个最基础的xhr请求，然后在此基础上实现cancelToken功能。

```js
function xhrAdapter(config) {
    const request = new XMLHttpRequest()
    request.open(config.method, config.url, true)

    if (config.cancelToken) {
        config.cancelToken.promise.then(() => {
            if (!request) {
                return;
            }

            request.abort();
            request = null
        })
    }

    request.send(null)
}

xhrAdapter({
    url: "/",
    method: "GET"
})
```

## 通过executor函数取消请求

```js
const CancelToken = axios.CancelToken;
let cancel;

axios.get('/user/12345', {
  cancelToken: new CancelToken(function executor(c) {
    // executor 函数接收一个 cancel 函数作为参数
    cancel = c;
  })
});

cancel() //     取消请求
```

`axios.CancelToken`函数中传递一个executor回调函数，该函数的第一个参数就是执行取消请求的函数。

现在我们来实现`axios.CancelToken`函数，首先可以明确，这函数是一个构造函数，另外该函数包含`promise`属性，这个属性是一个Promise，然后这个构造函数接收一个回调函数(executor)作为参数，我们将`this.promise`的`resolve`方法传递给`executor`作为参数。

```js
function CancelToken(executor) {
  if (typeof executor !== 'function') {
    throw new TypeError('executor must be a function.');
  }

  var resolvePromise;
  this.promise = new Promise(function promiseExecutor(resolve) {
    // 暴露this.promise 的resolve，当用户调用该函数就会触发promise.then回调函数，进而调用request.abort()
    resolvePromise = resolve;
  });

  var token = this;
  executor(function cancel(message) {
    if (token.reason) {
      // 避免重复调用
      return;
    }

    token.reason = new Cancel(message);
    resolvePromise(token.reason);
  });
}
```

## 通过CancelToken.source函数取消请求

CancelToken.source实际上只是对CancelToken进行了一层封装，它在函数内部对进行了CancelToken实例化操作，从而简化用户的操作。

```js
const CancelToken = axios.CancelToken;
const source = CancelToken.source();

axios.get('/user/12345', {
  cancelToken: source.token
}).catch(function (thrown) {
  if (axios.isCancel(thrown)) {
    console.log('Request canceled', thrown.message);
  } else {
    // 处理错误
  }
});

axios.post('/user/12345', {
  name: 'new name'
}, {
  cancelToken: source.token
})

// 取消请求（message 参数是可选的）
source.cancel('Operation canceled by the user.');
```

source是CancelToken上的一个静态方法，其返回一个对象，包含token和cancel两个属性，token属性就是`new CancelToken()`的结果，cancel则是取消请求的函数。

```js
CancelToken.source = function source() {
  var cancel;
  var token = new CancelToken(function executor(c) {
    cancel = c;
  });
  return {
    token: token,
    cancel: cancel
  };
};
```