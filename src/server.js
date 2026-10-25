import { createApp } from "./app.js";
import { openDb } from "./db.js";

const port = Number(process.env.PORT ?? 3000);
const db = openDb(process.env.DB_PATH ?? ":memory:");

createApp(db).listen(port, () => console.log(`taskly listening on http://localhost:${port}`));
