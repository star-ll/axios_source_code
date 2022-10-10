const http = require("http");
const fs = require("fs");
const path = require("path");

http.createServer((req, res) => {
	if (req.url === "/") {
		const files = fs.readdirSync(__dirname);
		res.end(
			files
				.map((item) => `<a href="/${item}" >${item}</a>`)
				.join("<br />")
		);
	}
	// api
	else if (req.url.indexOf("/api") > -1) {
		res.setHeader("access-control-allow-origin", "*");
		res.setHeader("access-control-allow-headers", "Authorization");
		res.setHeader("access-control-allow-method", ["POST", "GET"]);
		res.setHeader("credentials", true);

		res.end("axios");
	} else if (/\.html$/.test(req.url)) {
		res.end(fs.readFileSync(path.join(__dirname, req.url)).toString());
	} else {
		res.statusCode = 404;
		res.end("Not Founded");
	}
}).listen(5319, () => {
	console.log("服务已启动，请打开: http://localhost:5319");
});
