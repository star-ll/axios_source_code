# Core模块

`“core”` 目录下的模块应该是与axios相关的模块。这些模块在axios模块之外使用很可能没有意义，因为它们的逻辑太具体了。核心模块的作用包括不限于：

- 调度请求
- 管理拦截器
- 处理配置

## Axios

`Axios.js`文件存放的是`axios`的构造函数`Axios`，通常情况下我们是直接`import axios`来使用。

```tsx
import axios from "axios"
axios.get()
```

事实上我们导入的`axios`对象就是Axios创造的使用默认配置的实例，实例化过程如下。

```tsx
function createInstance(defaultConfig) {
	var context = new Axios(defaultConfig);
	var instance = bind(Axios.prototype.request, context);
  // ...
	return instance;
}

// 创建默认配置的Axios实例
var axios = createInstance(defaults);

// 将构造函数挂载到实例属性上
axios.Axios = Axios;
```

这里我们暂时不去关注`bind`函数内部逻辑，只需要了解Axios构造函数的逻辑。

### Axios构造函数

我们来看下Axios的声明代码：

```tsx
/**
 * Create a new instance of Axios
 *
 * @param {Object} instanceConfig The default config for the instance
 */
function Axios(instanceConfig) {
  this.defaults = instanceConfig;
  this.interceptors = {
    request: new InterceptorManager(),
    response: new InterceptorManager()
  };
}
```

这里创建了Axios构造函数，并声明了将实例配置`instanceConfig` 挂载到了`defaults`实例属性上，并且还挂载拦截器对象`interceptors` ，这里暂时不去管`InterceptorManager`函数，后面[interceptormanager](#interceptormanager)会讲到 。

### Axios.prototype.request()

接下来就是为Axios添加原型方法，其中最重要的就是这个`Axios.prototype.request` 方法，使用它来发送http请求，并实现全局请求配置、拦截器等功能，此外后面讲到的别名api(例如`axios.get`)本质上也是依靠这个API实现的。

```tsx
/**
 * Dispatch a request
 *
 * @param {Object} config The config specific for this request (merged with this.defaults)
 */
Axios.prototype.request = function request(config) {
	/*eslint no-param-reassign:0*/
	// 处理request(url,config)和request(config)这两种情况
	if (typeof config === "string") {
		config = arguments[1] || {};
		config.url = arguments[0];
	} else {
		config = config || {};
	}

	// 未声明的配置项使用默认配置
	config = mergeConfig(this.defaults, config);

	// 将http方法统一转换成小写，默认是get
	if (config.method) {
		config.method = config.method.toLowerCase();
	} else if (this.defaults.method) {
		config.method = this.defaults.method.toLowerCase();
	} else {
		config.method = "get";
	}

	// 利用Promise+队列实现拦截器（请求拦截器和响应拦截器）
  // 这部分后面再讲
	var chain = [dispatchRequest, undefined];
	var promise = Promise.resolve(config);

	this.interceptors.request.forEach(function unshiftRequestInterceptors(
		interceptor
	) {
		chain.unshift(interceptor.fulfilled, interceptor.rejected);
	});

	this.interceptors.response.forEach(function pushResponseInterceptors(
		interceptor
	) {
		chain.push(interceptor.fulfilled, interceptor.rejected);
	});

	while (chain.length) {
		promise = promise.then(chain.shift(), chain.shift());
	}

	return promise;
};
```

`axios.prototype.request()`方法主要实现了全局请求配置，转换http方法名称、发送http请求以及实现拦截器的功能。

axios实现全局请求配置其实是通过合并配置项来实现的，axios实现了一个工具函数`mergeConfig` ，它的作用是合并配置对象，前面说了`axios`对象其实就是使用默认配置创建的一个`Axios`实例而已，而当使`用axios.create(config)`方法创建一个自定义请求配置的Axios实例时，它会合并自定义配置(config)和默认配置(defaults)，然后在调用`axios.prototype.request(config)` 发送请求的时候，还会再次合并一下`config`参数。

```tsx
axios.create = function create(instanceConfig) {
// createInstance函数的作用是创建Axios实例，参数是config配置对象
// 在create时就已经合并了一次配置对象
	return createInstance(mergeConfig(axios.defaults, instanceConfig));
};

Axios.prototype.request = function request(config) {
  // ...
	// 未声明的配置项使用默认配置或者全局请求配置
	config = mergeConfig(this.defaults, config);
  // ...
}
```

`axios.get()`这类别名API也会使用全局配置对象，原理是因为其底层使用的也是`axios.request()`方法，这部分后面会讲到。

### 拦截器

这里着重讲讲拦截器，我们暂时不去关注`dispatchRequest` 函数的具体逻辑，我们目前只需要知道它的作用是发送http请求即可。我们重点来看下`chain`这个数组。

```tsx
Axios.prototype.request = function request(config) {
  // ...
	// 利用Promise+队列实现拦截器（请求拦截器和响应拦截器）
	var chain = [dispatchRequest, undefined];
	var promise = Promise.resolve(config);

	this.interceptors.request.forEach(function unshiftRequestInterceptors(
		interceptor
	) {
		chain.unshift(interceptor.fulfilled, interceptor.rejected);
	});

	this.interceptors.response.forEach(function pushResponseInterceptors(
		interceptor
	) {
		chain.push(interceptor.fulfilled, interceptor.rejected);
	});

	while (chain.length) {
		promise = promise.then(chain.shift(), chain.shift());
	}

	return promise;
};
```

axios对拦截器的处理非常巧妙，它使用了一个类似队列的结构，不过这个chain结构比较特殊，它可以两端入队(`unshift`和`push`)。

为什么要采用队列这种结构？因为拦截器本身分为请求拦截器和响应拦截器，而请求拦截器的触发事件是在发送请求前(即`dispatchRequest` 调用前)，而响应拦截器事件是在发送请求后(即`dispatchRequest` 调用后)，因此很容易想到**将请求拦截器事件加入发送请求函数(`dispatchRequest`)的前端，将响应拦截器事件加入发送请求函数的后端，然后按从左到右的顺序出队，这样就可以确保拦截器触发的时机是正确的。**

**光靠chain来确保拦截器触发时机还不够，我们还需要实现一种链式数据传递的功能**，即可以在axios请求拦截器中修改config并将修改后的config传递到`dispatchRequest` ，然后将`dispatchRequest` 函数收到的响应结果传递到响应拦截器中。

即下面这种效果：

```tsx
// 添加请求拦截器
axios.interceptors.request.use(function (config) {
    // 在发送请求之前做些什么
    return config;
  }, function (error) {
    // 对请求错误做些什么
    return Promise.reject(error);
  });

// 添加响应拦截器
axios.interceptors.response.use(function (response) {
    // 2xx 范围内的状态码都会触发该函数。
    // 对响应数据做点什么
    return response;
  }, function (error) {
    // 超出 2xx 范围的状态码都会触发该函数。
    // 对响应错误做点什么
    return Promise.reject(error);
  });
```

这里很容易想到Promise，Promise的链式调用正好可以实现这种效果。axios拦截器的成功回调函数和失败回调函数正好对应着`Promise.then(resolveFn,rejectFn)`中的`resolveFn`和`rejectFn` ，于是我们循环出队将拦截器函数与`**dispatchRequest`**  函数挂载到一个Promise对象上，最终的效果可能是这样：

```tsx
Promise.resolve(config).then(请求拦截器成功回调1,请求拦截器失败回调1)
 .then(请求拦截器成功回调2,请求拦截器失败回调2)
 .then(dispatchRequest,undefined)
 .then(响应拦截器成功回调1,响应拦截器失败回调1)
 .then(响应拦截器成功回调2,响应拦截器失败回调2)
```

为了确保请求拦截器的config对象和响应拦截器的response对象能顺序传到下一个Promise对象，需要用户使用时显示返回`config`或者`response` ，如果出现错误的情况应该返回一个`Promise.reject(error)` ，这也正是为什么你在写axios拦截器时需要显示返回`config`或者`response`的原因，假如没有按规则返回，就会导致拦截器功能失效。

### alias API

`axios`还提供了很多别名API，例如`axios.get()`、`axios.post()`等，但是其内部还是调用的是`axios.request()`方法。

```tsx
//为支持的请求方法提供别名API，这些APi在内部都是依靠request方法实现请求的
utils.forEach(
	["delete", "get", "head", "options"],
	function forEachMethodNoData(method) {
		Axios.prototype[method] = function (url, config) {
			return this.request(
				utils.merge(config || {}, {
					method: method,
					url: url,
				})
			);
		};
	}
);
utils.forEach(["post", "put", "patch"], function forEachMethodWithData(method) {
	Axios.prototype[method] = function (url, data, config) {
		return this.request(
			utils.merge(config || {}, {
				method: method,
				url: url,
				data: data,
			})
		);
	};
});

module.exports = Axios;
```

## InterceptorManager

在Axios构造函数那一节我们遇到了`InterceptorManager`，现在我们就来具体看一下`InterceptorManager`具体的内部逻辑。

```js
function Axios(instanceConfig) {
  this.defaults = instanceConfig;
  this.interceptors = {
    request: new InterceptorManager(),
    response: new InterceptorManager()
  };
}
```

`InterceptorManager`函数的声明位于`core/InterceptorManager`文件下。

```js
function InterceptorManager() {
  this.handlers = [];
}
```

很明显`InterceptorManager`是一个构造函数，这个构造函数拥有一个`handlers`实例属性，`handlers`数组用于存放**拦截器函数对象**，即：

```js
// 拦截器对象，包含fulfilled回调函数和rejected回调函数
{
    fulfilled: fulfilled,
    rejected: rejected
}
```

在这个构造函数上还挂载了三个原型方法。

```js
InterceptorManager.prototype.use = function use(fulfilled, rejected) {
  this.handlers.push({
    fulfilled: fulfilled,
    rejected: rejected
  });
  // 返回此拦截器函数的索引
  return this.handlers.length - 1;
};
InterceptorManager.prototype.eject = function eject(id) {
  if (this.handlers[id]) {
    this.handlers[id] = null;
  }
};

InterceptorManager.prototype.forEach = function forEach(fn) {
  utils.forEach(this.handlers, function forEachHandler(h) {
    // 有些拦截器函数可能已经被移除了
    if (h !== null) {
      fn(h);
    }
  });
};
```

`InterceptorManager.prototype.use(fulfilled, rejected)`的作用是`fulfilled`(成功的回调)和`rejected`(失败的回调)函数添加到`handlers`中，`axios`规定必须传递两个拦截器回调函数，用于处理`resolve`和`reject`两种情况，最后返回函数所在`handlers`数组中的索引，以便移除拦截器函数时使用。

`InterceptorManager.prototype.eject(id)`的作用是移除拦截器函数，id就是`InterceptorManager.prototype.use(fulfilled, rejected)`函数调用的返回值，axios通过id直接找到对应的拦截器函数，然后将`this.handlers[id]`设为`null`。

当前面Axios实例化时，其实就会创建一个包含`request`和`response`属性的对象`interceptors`，而`request`和`response`都是`InterceptorManager`的实例。所以当`Axios`实例化后`axios.interceptors` 内部是这样的：

```js
// axios.interceptors  
{
    "request":{"handlers":[]},
    "response":{"handlers":[]}
}
```

再来看`InterceptorManager.prototype.forEach(fn)`函数，这个API是内部调用的。它的作用是遍历`handlers`中所有的拦截器函数对象，并将它们作为参数传入回调`fn`函数中执行。在上面的[Axios.prototype.request()](#axios-prototype-request)函数中调用了该方法将请求拦截器对象的`fulfilled`回调和`rejected`回调添加到`chain`数组中。



