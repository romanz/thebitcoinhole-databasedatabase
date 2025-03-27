const fs = require('fs');
const path = require('path');
const jsonlint = require('jsonlint');

function validateJsonFile(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  try {
    const parsedJson = jsonlint.parse(fileContent);

    // Check for exact string "sample" (case-insensitive, including the quotes)
    if (fileContent.toLowerCase().includes('"sample"')) {
      console.error(`Validation failed for '${filePath}': Found forbidden string "sample" (with quotes, case-insensitive).`);
      process.exit(1);
    }

    if (JSON.stringify(parsedJson, null, 2) === fileContent) {
      console.log(`JSON file '${filePath}' is valid.`);
    } else {
      console.error(`Error in JSON file '${filePath}': The JSON is not well-formatted.`);
      process.exit(1); // Exit with a non-zero status code
    }
  } catch (error) {
    console.error(`Error in JSON file '${filePath}':`, error.message);
    process.exit(1); // Exit with a non-zero status code
  }
}

const itemTypesDir = '../item-types';

fs.readdirSync(itemTypesDir, { withFileTypes: true }).forEach((entry) => {
  if (entry.isDirectory()) {
    const itemsDir = path.join(itemTypesDir, entry.name, 'items');

    if (fs.existsSync(itemsDir)) {
      fs.readdirSync(itemsDir).forEach((file) => {
        if (file.endsWith('.json')) {
          const filePath = path.join(itemsDir, file);
          validateJsonFile(filePath);
        }
      });
    }
  }
});

console.log("*** JSONs validation finised OK ***")