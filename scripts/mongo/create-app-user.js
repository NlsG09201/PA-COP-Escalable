const username = process.env.MONGO_APP_USERNAME;
const password = process.env.MONGO_APP_PASSWORD;
if (!/^[A-Za-z0-9_]{3,32}$/.test(username || "") || !/^[a-fA-F0-9]{32,128}$/.test(password || "")) {
  throw new Error("Invalid application user configuration");
}

const appDb = db.getSiblingDB("cop");
const existing = appDb.getUser(username);
if (existing) {
  appDb.updateUser(username, { pwd: password, roles: [{ role: "readWrite", db: "cop" }] });
} else {
  appDb.createUser(username, { pwd: password, roles: [{ role: "readWrite", db: "cop" }] });
}
