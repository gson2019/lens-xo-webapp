var http = require("http");
var fs = require("fs");
var path = require("path");

var PORT = process.env.PORT || 3000;

var mimeTypes = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png"
};

var server = http.createServer(function(req, res) {
  var cleanPath = req.url.split("?")[0];
  var filePath = "." + (cleanPath === "/" ? "/index.html" : cleanPath);
  if (filePath.endsWith("/")) {
    filePath += "index.html";
  }
  var resolved = path.resolve(filePath);
  var root = path.resolve(".");

  if (resolved.indexOf(root) !== 0) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Forbidden");
    return;
  }

  fs.readFile(resolved, function(error, content) {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/html" });
      res.end("<h1>404 Not Found</h1>");
      return;
    }

    var contentType = mimeTypes[path.extname(resolved)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  });
});

server.listen(PORT, function() {
  console.log("Glass View running at http://localhost:" + PORT);
});
