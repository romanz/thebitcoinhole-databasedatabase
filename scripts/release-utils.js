const longMonths = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

const shortMonths = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function getShortMonthByIndex(index) {
    return shortMonths[index]
}

function getShortMonth(date) {
    return shortMonths[date.getMonth()]
}

function getLongMonthIndex(month) {
    return longMonths.indexOf(month)
}

function isValidVersion(str) {
    const regex = /^v\d+(\.\d+)*$/;
    return regex.test(str);
}

function isValidDate(str) {
    const regex = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) [1-9]|[1-2][0-9]|3[01], \d{4}$/;
    return regex.test(str);
}

function updateReleasesFile(itemType, itemId, date, version, changelogUrl, platform = "") {
    const fileName = `releases.md`;
    const filePath = path.join(__dirname, "..", fileName);

    let content = "";
    if (fs.existsSync(filePath)) {
        content = fs.readFileSync(filePath, 'utf8');
    }

    const typeHeader = `## ${itemType}`;
    const idHeader = `### ${itemId}`;
    const versionString = platform ? `${version} (${platform})` : version;
    const newEntry = `- ${date} - ${versionString} - ${changelogUrl}`;

    if (content.includes(typeHeader)) {
        const typeIndex = content.indexOf(typeHeader) + typeHeader.length;
        const idIndex = content.indexOf(idHeader, typeIndex);

        if (idIndex !== -1) {
            // Append new entry under the existing item ID
            const splitContent = content.split(idHeader);
            splitContent[1] = splitContent[1].trim() + `\n${newEntry}\n`;
            content = splitContent.join(idHeader + "\n");
        } else {
            // Append new item ID under existing type
            content = content.replace(typeHeader, `${typeHeader}\n${idHeader}\n${newEntry}\n`);
        }
    } else {
        // Append new item type, item ID, and entry
        content += `\n${typeHeader}\n${idHeader}\n${newEntry}\n`;
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${fileName} with new entry.`);
}