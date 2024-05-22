import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const handler = async (event, context, callback) => {
  const html = fs.readFileSync(path.resolve(__dirname, "./index.html"), "utf8");

  return {
    statusCode: 200,
    body: html,
  };
};
