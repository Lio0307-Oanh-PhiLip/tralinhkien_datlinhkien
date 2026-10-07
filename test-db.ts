import { db } from './src/db/index';
import { shortageBookings } from './src/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  try {
    const res = await db.delete(shortageBookings);
    console.log("Delete result:", res);
  } catch(e) {
    console.error("Delete error:", e);
  }
}
main();
