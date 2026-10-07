import { db } from './src/db/index';
import { shortageBookings } from './src/db/schema';
import { eq } from 'drizzle-orm';
async function main() {
  const items = await db.select().from(shortageBookings);
  console.log("SQL Items Before:", items.length);
  if (items.length > 0) {
    const id = items[0].id;
    const res = await db.delete(shortageBookings).where(eq(shortageBookings.id, id));
    console.log("Delete result:", res);
    const after = await db.select().from(shortageBookings);
    console.log("SQL Items After:", after.length);
  }
}
main();
