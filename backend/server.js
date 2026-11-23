import "dotenv/config";
import { app } from "./app.js";
import { getPool } from "./config/db.js";

const PORT = process.env.PORT || 5000;

getPool()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to the database:", err.message);
    process.exit(1);
  });
