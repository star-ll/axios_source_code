# Axios 源码分析

# 介绍

axios 源码解析，版本： 0.19.2。

Axios 是一个基于 _[promise](https://javascript.info/promise-basics)_ 网络请求库，作用于[`node.js`](https://nodejs.org/) 和浏览器中。 它是 _[isomorphic](https://www.lullabot.com/articles/what-is-an-isomorphic-application)_ 的(即同一套代码可以运行在浏览器和 node.js 中)。在服务端它使用原生 node.js `http` 模块, 而在客户端 (浏览端) 则使用 XMLHttpRequests。

本项目详细讲解 Core、Helpers、Adapters、Cancel 四大模块，并将针对 axios 以下内容进行重点解析：

- 拦截器的实现
- xhr 和 http 的封装
- HTTP 响应结果 Promise 化
- Axios 构造函数

## 目录

- [introduction](/introduction)

- [core](/core)

- [helpers](/helpers)

- [adapters](/adapters)

- [cancel](/cancel)
