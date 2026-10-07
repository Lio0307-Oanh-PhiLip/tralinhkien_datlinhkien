import { db } from './src/db/index';
import { shortageBookings } from './src/db/schema';
async function main() {
  const itemsBefore = await db.select().from(shortageBookings);
  console.log("SQL Items Before:", itemsBefore.length);
  const res = await db.delete(shortageBookings);
  console.log("Delete result:", res);
  const itemsAfter = await db.select().from(shortageBookings);
  console.log("SQL Items After:", itemsAfter.length);
}
main();
