const fs = require('fs');
const jsonlint = require('jsonlint');

function validateJsonFile(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  try {
    const parsedJson = jsonlint.parse(fileContent);
    if (JSON.stringify(parsedJson, null, 2) === fileContent) {
      console.log(`JSON file '${filePath}' is valid and well-formatted.`);
    } else {
      console.error(`Error in JSON file '${filePath}': The JSON is not well-formatted.`);
      process.exit(1); // Exit with a non-zero status code
    }
  } catch (error) {
    console.error(`Error in JSON file '${filePath}':`, error.message);
    process.exit(1); // Exit with a non-zero status code
  }
}

const itemTypesDir = 'item-types';

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