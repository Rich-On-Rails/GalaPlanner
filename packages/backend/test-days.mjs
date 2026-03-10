import { PDFParse, VerbosityLevel } from 'pdf-parse';
import { readFileSync } from 'fs';

async function test() {
  const buffer = readFileSync('../../samples/Winter-Steam-TT-2025.pdf');

  const parser = new PDFParse({
    verbosity: VerbosityLevel.ERRORS,
    data: new Uint8Array(buffer),
  });

  const textResult = await parser.getText();

  // Check the pages structure
  console.log('Number of pages:', textResult.pages?.length);

  textResult.pages?.forEach((page, i) => {
    console.log(`\n=== Page ${i + 1} ===`);
    console.log('Text preview:', page.text?.substring(0, 300));

    // Look for day indicators
    const dayMatch = page.text?.match(/(?:Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)\s+\d+\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)/i);
    if (dayMatch) {
      console.log('Day found:', dayMatch[0]);
    }
  });
}

test().catch(console.error);
