async function main() {
  const res = await fetch('http://localhost:3000/api/shortages/clear/all', { method: 'DELETE' });
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", text);
}
main();
