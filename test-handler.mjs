import { handler } from './index.mjs';

console.log('Testing Handler Function');
console.log('=======================\n');

async function testHandler() {
  try {
    console.log('Calling handler...');
    const result = await handler();

    console.log('Handler result:');
    console.log('- Status Code:', result.statusCode);
    console.log('- Body type:', typeof result.body);
    console.log('- Body length:', result.body ? result.body.length : 0);

    // Check if HTML contains lunch data
    if (result.body) {
      const hasLunchesArray = result.body.includes('const lunches = [');
      const hasEmptyArray = result.body.includes('const lunches = [];');

      console.log('- Contains lunches array:', hasLunchesArray);
      console.log('- Is empty array:', hasEmptyArray);

      // Extract the lunches array from the HTML
      const lunchesMatch = result.body.match(/const lunches = (\[.*?\]);/s);
      if (lunchesMatch) {
        try {
          const lunches = JSON.parse(lunchesMatch[1]);
          console.log('- Number of lunch items:', lunches.length);

          if (lunches.length > 0) {
            console.log('\nFirst lunch item:');
            console.log('  Name:', lunches[0].name);
            console.log('  Place:', lunches[0].place);
            console.log('  Weekday:', lunches[0].weekday);
            console.log('  Week:', lunches[0].week);
            console.log('  Price:', lunches[0].price);
            console.log('  Description:', lunches[0].description ? lunches[0].description.substring(0, 50) + '...' : 'N/A');
          }
        } catch (parseError) {
          console.log('- Error parsing lunches array:', parseError.message);
        }
      }

      // Check if HTML structure is intact
      const hasHtmlStructure = result.body.includes('<!doctype html>') &&
                               result.body.includes('<div id="grid">') &&
                               result.body.includes('tui.Grid');
      console.log('- HTML structure intact:', hasHtmlStructure);
    }

  } catch (error) {
    console.error('Error testing handler:', error);
    console.error('Stack trace:', error.stack);
  }
}

testHandler();
