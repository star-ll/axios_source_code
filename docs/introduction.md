# Axios

## 什么是 Axios

Axios 是一个基于 Promise 的 HTTP 客户端，用于浏览器和 Node.js。它可以向服务器发送请求并对响应进行处理。

Axios 的特点包括：

1. 支持 Promise API，能够利用 async/await 进行更加简洁的异步编程；
2. 支持在浏览器和 Node.js 中运行；
3. 支持拦截请求和响应，并可以在其中进行修改；
4. 自动转换 JSON 数据；
5. 可以取消请求；
6. 支持 CSRF 保护。

Axios 相比于其他 HTTP 客户端库的优势在于其易用性、灵活性和兼容性，可以与现有的 Promise、async/await 等技术轻松集成。

## 源码结构

Axios 的源码结构主要分为以下几个部分：

1. 核心模块：位于/lib/core 目录下，包括创建 axios 实例、发送请求等核心功能代码。

2. 辅助模块：位于/lib/helpers 目录下，包括处理请求参数、响应数据等辅助函数的代码。

3. 适配器模块：位于/lib/adapters 目录下，包括处理不同环境下请求和响应的适配器代码，例如在浏览器中使用 XMLHttpRequest 发送请求，在 Node.js 中使用 http 或 https 模块发送请求。

4. 取消模块：位于/lib/cancel 目录下，包括用于取消请求的相关代码。

5. 错误处理模块：位于/lib/core/createError.js 文件中，用于处理请求和响应时发生的错误，并将错误信息封装成 Error 对象返回。

6. 配置模块：位于/lib/core/Axios.js 文件中，包括 axios 实例的默认配置和自定义配置的处理。

入口模块：位于/index.js 文件中，用于导出 axios 实例和相关方法。
