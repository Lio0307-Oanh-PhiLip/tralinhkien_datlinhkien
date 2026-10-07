import { db } from './src/db/index';
import { shortageBookings } from './src/db/schema';
async function main() {
  const items = await db.select().from(shortageBookings);
  console.log("SQL Items:", items.length);
}
main();
