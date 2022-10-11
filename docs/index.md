

# Axios源码分析

# 介绍

axios源码解析，版本： 0.19.2。

Axios 是一个基于 *[promise](https://javascript.info/promise-basics)* 网络请求库，作用于[`node.js`](https://nodejs.org/) 和浏览器中。 它是 *[isomorphic](https://www.lullabot.com/articles/what-is-an-isomorphic-application)* 的(即同一套代码可以运行在浏览器和node.js中)。在服务端它使用原生 node.js `http` 模块, 而在客户端 (浏览端) 则使用 XMLHttpRequests。

本项目详细讲解Core、Helpers、Adapters、Cancel四大模块，并将针对axios以下内容进行重点解析：

- 拦截器的实现
- xhr和http的封装
- HTTP响应结果Promise化
- Axios构造函数

## 目录

- introduction

- [core](/core)

- [helpers](/helpers)

- [adapters](/adapters)

- [cancel](/cancel)

  