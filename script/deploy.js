const path = require("path");
const FtpDeploy = require("ftp-deploy");

const ftpDeploy = new FtpDeploy();

const config = {
	user: "root",
	// Password optional, prompted if none given
	password: "$yujin8088",
	host: "119.23.106.221",
	port: 22,
	localRoot: path.join(__dirname, "../", "./docs/.vitepress/dist"),
	remoteRoot: "/www/wwwroot/axios.yujin123.cn",
	include: ["*", "**/*"], // this would upload everything except dot files
	// include: ["*.php", "dist/*", ".*"],
	// e.g. exclude sourcemaps, and ALL files in node_modules (including dot files)
	exclude: [
		"dist/**/*.map",
		"node_modules/**",
		"node_modules/**/.*",
		".git/**",
	],
	// delete ALL existing files at destination before uploading, if true
	deleteRemote: false,
	// // Passive mode is forced (EPSV command is not sent)
	// forcePasv: true,
	// use sftp or ftp
	sftp: true,
};

ftpDeploy
	.deploy(config)
	.then((res) => console.log("finished:", res))
	.catch((err) => console.log(err));
