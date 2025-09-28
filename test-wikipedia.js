// Simple test to see Wikipedia API response
async function testWikipedia() {
  const query = "quantum physics";
  const searchUrl = `https://en.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(
    query.toLowerCase()
  )}&limit=5`;

  console.log(`🔍 Testing Wikipedia search: ${searchUrl}`);

  try {
    const response = await fetch(searchUrl);
    console.log(`📊 Response status: ${response.status}`);
    console.log(
      `📊 Response headers:`,
      Object.fromEntries(response.headers.entries())
    );

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ SUCCESS! Wikipedia API Response:`);
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`❌ FAILED! Status: ${response.status}`);
      const errorText = await response.text();
      console.log(`Error body:`, errorText);
    }
  } catch (error) {
    console.log(`❌ ERROR:`, error.message);
  }
}

testWikipedia();
