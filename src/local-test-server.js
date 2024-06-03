import http from "http";
import { handler } from "./index.js";

const server = http.createServer(async (_, response) => {
  const { statusCode, body } = await handler();
  response.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8",
  });
  response.write(body);
  response.end();
});

server.listen(3000);
