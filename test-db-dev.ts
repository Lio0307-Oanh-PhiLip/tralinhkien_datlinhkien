import { db } from './src/db/index';
import { deviceIotBookings } from './src/db/schema';
async function main() {
  const itemsBefore = await db.select().from(deviceIotBookings);
  console.log("Device SQL Items Before:", itemsBefore.length);
  const res = await db.delete(deviceIotBookings);
  console.log("Delete result:", res);
  const itemsAfter = await db.select().from(deviceIotBookings);
  console.log("Device SQL Items After:", itemsAfter.length);
}
main();
