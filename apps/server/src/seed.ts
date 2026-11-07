import { openDatabase } from "./db.js";
import { products, gstRegistry, udyamRegistry } from "./catalogue.js";
const store = openDatabase();
console.log(
  JSON.stringify({
    products: products.length,
    gstRecords: gstRegistry.size,
    udyamRecords: udyamRegistry.size,
    database: "ready",
  }),
);
store.sqlite.close();
